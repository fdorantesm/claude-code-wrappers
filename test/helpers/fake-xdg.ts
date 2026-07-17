/**
 * Helpers for injecting a fake XDG layout into tests.
 *
 * Each test gets:
 *   - isolated XDG config/data/state dirs
 *   - a "real HOME" with a fake ~/.claude/.credentials.json
 *   - a fake claude binary path
 *
 * Usage:
 *   const xdg = createFakeXdg();
 *   afterEach(() => xdg.cleanup());
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export interface FakeXdg {
  root: string
  configDir: string
  dataDir: string
  stateDir: string
  realHome: string
  realClaudeConfigDir: string
  fakeClaudeBin: string
  cleanup: () => void
}

export function createFakeXdg(): FakeXdg {
  const root = mkdtempSync(join(tmpdir(), "cw-fake-xdg-"))
  const configDir = join(root, "config")
  const dataDir = join(root, "data")
  const stateDir = join(root, "state")
  const realHome = join(root, "real-home")
  const realClaudeConfigDir = join(realHome, ".claude")

  mkdirSync(configDir, { recursive: true })
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(stateDir, { recursive: true })
  mkdirSync(realClaudeConfigDir, { recursive: true })

  // Fake credentials file
  writeFileSync(
    join(realClaudeConfigDir, ".credentials.json"),
    JSON.stringify({ fakeCredentials: true, expiresAt: "2099-01-01" }),
    { mode: 0o600 },
  )

  // Fake claude settings.json
  writeFileSync(
    join(realClaudeConfigDir, "settings.json"),
    JSON.stringify({
      theme: "dark",
      permissions: { allow: [], deny: [] },
    }),
    { mode: 0o600 },
  )

  const fakeClaudeBin = join(root, "fake-claude-bin.mjs")

  return {
    root,
    configDir,
    dataDir,
    stateDir,
    realHome,
    realClaudeConfigDir,
    fakeClaudeBin,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

/**
 * Apply fake XDG paths to process.env for the duration of a test.
 * Restores previous values on cleanup.
 */
export function applyFakeXdg(xdg: FakeXdg): () => void {
  const previous: Record<string, string | undefined> = {}
  const mapping: Record<string, string> = {
    CW_TEST_XDG_CONFIG_HOME: xdg.configDir,
    CW_TEST_XDG_DATA_HOME: xdg.dataDir,
    CW_TEST_XDG_STATE_HOME: xdg.stateDir,
    CW_TEST_REAL_HOME: xdg.realHome,
    CW_TEST_FAKE_CLAUDE_BIN: xdg.fakeClaudeBin,
  }

  for (const [k, v] of Object.entries(mapping)) {
    previous[k] = process.env[k]
    process.env[k] = v
  }

  return () => {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}
