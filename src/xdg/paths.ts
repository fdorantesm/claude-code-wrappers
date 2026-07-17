/**
 * Platform-aware XDG paths.
 *
 * macOS / Linux: $XDG_*_HOME with sensible defaults under $HOME.
 * Windows: %APPDATA% / %LOCALAPPDATA% / %USERPROFILE%.
 *
 * Tests can override via env vars (used by test/helpers/fake-xdg.ts).
 */

import { homedir } from "node:os"
import { join } from "node:path"
import { platform as nodePlatform } from "node:process"

export interface XdgPaths {
  /** ~/.config/claude-wrappers (Unix) or %APPDATA%\claude-wrappers (Win) */
  configDir: string
  /** ~/.local/share/claude-wrappers (Unix) or %LOCALAPPDATA%\claude-wrappers (Win) */
  dataDir: string
  /** ~/.local/state/claude-wrappers (Unix) or %LOCALAPPDATA%\claude-wrappers\state (Win) */
  stateDir: string
  /** ~/.local/bin/cw (Unix) or %USERPROFILE%\bin\cw.exe (Win) */
  binDir: string
  /** Real user HOME — exported as REAL_HOME to the child */
  realHome: string
  /** Real ~/.claude (where credentials live) */
  realClaudeConfigDir: string
}

export function getPlatformPaths(env: NodeJS.ProcessEnv = process.env): XdgPaths {
  // Test override path
  if (env.CW_TEST_XDG_CONFIG_HOME) {
    const realHome = env.CW_TEST_REAL_HOME ?? homedir()
    return {
      configDir: env.CW_TEST_XDG_CONFIG_HOME,
      dataDir: env.CW_TEST_XDG_DATA_HOME ?? join(env.CW_TEST_XDG_CONFIG_HOME, "..", "data"),
      stateDir: env.CW_TEST_XDG_STATE_HOME ?? join(env.CW_TEST_XDG_CONFIG_HOME, "..", "state"),
      binDir: env.CLAUDE_WRAPPERS_BIN_DIR ?? join(realHome, ".local/bin"),
      realHome,
      realClaudeConfigDir: join(realHome, ".claude"),
    }
  }

  const currentPlatform = env.CW_TEST_PLATFORM ?? nodePlatform

  if (currentPlatform === "win32") {
    const home = env.USERPROFILE ?? homedir()
    const appData = env.APPDATA ?? join(home, "AppData", "Roaming")
    const localData = env.LOCALAPPDATA ?? join(home, "AppData", "Local")
    return {
      configDir: join(appData, "claude-wrappers"),
      dataDir: join(localData, "claude-wrappers"),
      stateDir: join(localData, "claude-wrappers", "state"),
      binDir: env.CLAUDE_WRAPPERS_BIN_DIR ?? join(home, "bin"),
      realHome: home,
      realClaudeConfigDir: join(home, ".claude"),
    }
  }

  // macOS / Linux
  const home = env.HOME ?? homedir()
  return {
    configDir: join(env.XDG_CONFIG_HOME ?? join(home, ".config"), "claude-wrappers"),
    dataDir: join(env.XDG_DATA_HOME ?? join(home, ".local/share"), "claude-wrappers"),
    stateDir: join(env.XDG_STATE_HOME ?? join(home, ".local/state"), "claude-wrappers"),
    binDir: env.CLAUDE_WRAPPERS_BIN_DIR ?? env.XDG_BIN_HOME ?? join(home, ".local/bin"),
    realHome: home,
    realClaudeConfigDir: join(home, ".claude"),
  }
}
