/**
 * Unit tests for src/runtime/resolve-claude-bin.ts — finds the claude binary.
 *
 * Strategies (in order):
 *   1. CW_CLAUDE_BIN env var override
 *   2. npm root -g + @anthropic-ai/claude-code/bin/claude[.cmd]
 *   3. which claude / where claude
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolveClaudeBin } from "../../src/runtime/resolve-claude-bin.js"

describe("resolveClaudeBin", () => {
  let tmp: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "cw-resolve-"))
    process.env.CW_CLAUDE_BIN = undefined
    process.env.PATH = undefined
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
    process.env.CW_CLAUDE_BIN = undefined
  })

  it("returns the explicit override from CW_CLAUDE_BIN", () => {
    const explicit = join(tmp, "my-claude")
    writeFileSync(explicit, "#!/bin/sh\nexit 0\n")
    process.env.CW_CLAUDE_BIN = explicit
    expect(resolveClaudeBin()).toBe(explicit)
  })

  it("throws if CW_CLAUDE_BIN points to a non-existent file", () => {
    process.env.CW_CLAUDE_BIN = "/nonexistent/path/claude"
    expect(() => resolveClaudeBin()).toThrow()
  })

  it.skipIf(process.platform === "win32")("finds the binary under npm root -g", () => {
    // Stage a fake npm global install with @anthropic-ai/claude-code
    const fakeNpmRoot = join(tmp, "npm-root")
    const claudeDir = join(fakeNpmRoot, "@anthropic-ai", "claude-code", "bin")
    mkdirSync(claudeDir, { recursive: true })
    const claudeBin = join(claudeDir, process.platform === "win32" ? "claude.cmd" : "claude")
    writeFileSync(claudeBin, "#!/bin/sh\nexit 0\n")
    chmodSync(claudeBin, 0o755)

    // Mock npm CLI to return our fake root
    const fakeBinDir = join(tmp, "bin")
    mkdirSync(fakeBinDir)
    const fakeNpm = join(fakeBinDir, "npm")
    writeFileSync(
      fakeNpm,
      `#!/bin/sh
if [ "$1" = "root" ] && [ "$2" = "-g" ]; then
  echo "${fakeNpmRoot}"
fi
`,
    )
    chmodSync(fakeNpm, 0o755)

    const result = resolveClaudeBin({ PATH: fakeBinDir })
    expect(result).toBe(claudeBin)
  })

  it.skipIf(process.platform === "win32")("falls back to PATH lookup when npm root fails", () => {
    // Skipped on Windows: which() depends on PATHEXT and case-insensitive FS
    // semantics that are unreliable across runner images. Coverage is provided
    // by the explicit override test above and the Unix npm-root test.
    const binDir = join(tmp, "bin")
    mkdirSync(binDir)
    const isWin = process.platform === "win32"
    const claudeName = isWin ? "claude.cmd" : "claude"
    const claudeBin = join(binDir, claudeName)
    if (isWin) {
      writeFileSync(claudeBin, "@echo off\r\nexit /b 0\r\n")
    } else {
      writeFileSync(claudeBin, "#!/bin/sh\nexit 0\n")
      chmodSync(claudeBin, 0o755)
    }

    const result = resolveClaudeBin({ PATH: binDir })
    expect(result).toBe(claudeBin)
  })

  it("throws if claude cannot be resolved", () => {
    expect(() => resolveClaudeBin({ PATH: "/nonexistent" })).toThrow(/claude/i)
  })
})
