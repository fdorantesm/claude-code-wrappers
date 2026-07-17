/**
 * Resolves the path to the `claude` binary.
 *
 * Strategies (in order):
 *   1. CW_CLAUDE_BIN env var override
 *   2. PATH-only shim: if PATH includes a directory with a fake `npm` that
 *      prints a custom global root (used for tests), use it.
 *   3. Real `npm root -g` + @anthropic-ai/claude-code/bin/claude[.cmd]
 *   4. which claude (Unix) / where claude (Windows) on PATH
 */

import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { isWindows } from "../util/os.js"

export interface ResolveOptions {
  PATH?: string
}

function which(cmd: string, envPath: string): string | null {
  const exts = isWindows() ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""]
  const dirs = envPath.split(isWindows() ? ";" : ":")
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, cmd + ext)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

function runNpmRoot(): string | null {
  try {
    const out = execFileSync("npm", ["root", "-g"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    return out.trim() || null
  } catch {
    return null
  }
}

function shimNpmRoot(binDir: string): string | null {
  const shim = join(binDir, isWindows() ? "npm.cmd" : "npm")
  if (!existsSync(shim)) return null
  try {
    const out = execFileSync(shim, ["root", "-g"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: true,
    })
    return out.trim() || null
  } catch {
    return null
  }
}

export function resolveClaudeBin(opts: ResolveOptions = {}): string {
  const envPath = opts.PATH ?? process.env.PATH ?? ""

  // 1. Explicit override
  const override = process.env.CW_CLAUDE_BIN
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`CW_CLAUDE_BIN points to non-existent file: ${override}`)
    }
    return override
  }

  // 2. Try PATH-shim first (when opts.PATH is explicitly given, e.g., in tests)
  const shimRoot = opts.PATH ? shimNpmRoot(opts.PATH) : null
  // 3. Try real npm
  const realRoot = shimRoot ? null : runNpmRoot()
  const root = shimRoot ?? realRoot

  if (root) {
    const suffix = isWindows() ? "claude.cmd" : "claude"
    const candidate = join(root, "@anthropic-ai", "claude-code", "bin", suffix)
    if (existsSync(candidate)) return candidate
  }

  // 4. which / where
  const found = which("claude", envPath)
  if (found) return found

  throw new Error(
    "Could not resolve `claude` binary. Set CW_CLAUDE_BIN or install Claude Code:\n" +
      "  https://claude.com/code",
  )
}
