/**
 * Unit tests for src/providers/isolation.ts — the killer assertion:
 * HOME isolated, REAL_HOME real, credentials shared, settings isolated.
 *
 * Runs the full cw run pipeline end-to-end against a fake claude binary.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { realpathSync as realpathOs } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "bun"

describe("isolation (end-to-end)", () => {
  let tmp: string
  let isolatedHome: string
  let realHome: string
  let recordFile: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "cw-iso-"))
    isolatedHome = join(tmp, "isolated")
    realHome = join(tmp, "real")

    mkdirSync(join(realHome, ".claude"), { recursive: true })
    mkdirSync(join(isolatedHome, ".claude"), { recursive: true })
    writeFileSync(
      join(realHome, ".claude", ".credentials.json"),
      JSON.stringify({ session: "shared" }),
      { mode: 0o600 },
    )
    writeFileSync(
      join(isolatedHome, ".claude", "settings.json"),
      JSON.stringify({ env: { ANTHROPIC_BASE_URL: "https://api.minimax.chat" } }),
      { mode: 0o600 },
    )

    recordFile = join(tmp, "record.json")
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  const spawnViaCode = (imports: string, snippet: string): void => {
    const BUN = Bun.which("bun") ?? "bun"
    const code = `${imports}\n${snippet}`
    const result = spawnSync({
      cmd: [BUN, "-e", code],
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    })
    if (result.exitCode !== 0) {
      throw new Error(
        `bun subprocess failed (${result.exitCode}):\n${new TextDecoder().decode(result.stderr)}`,
      )
    }
  }

  it("HOME differs from REAL_HOME", () => {
    const fakeBin = process.env.CW_TEST_FAKE_CLAUDE_BIN
    if (!fakeBin) throw new Error("bun test setup did not run")

    spawnViaCode(
      `import { spawnClaude } from "./src/runtime/spawn.ts";`,
      `
      spawnClaude({
        provider: { id: "minimax", label: "M", envSchema: {}, settingsTemplate: "x" },
        args: ["--print", "test"],
        isolatedHome: ${JSON.stringify(isolatedHome)},
        realHome: ${JSON.stringify(realHome)},
        claudeBin: ${JSON.stringify(fakeBin)},
        env: { ANTHROPIC_BASE_URL: "https://api.minimax.chat" },
        recordPath: ${JSON.stringify(recordFile)},
      });
      `,
    )

    const rec = JSON.parse(readFileSync(recordFile, "utf8"))
    expect(rec.env.HOME).not.toBe(rec.env.REAL_HOME)
    expect(rec.env.HOME).toBe(isolatedHome)
    expect(rec.env.REAL_HOME).toBe(realHome)
  })

  it("CLAUDE_CONFIG_DIR points to isolated, not real", () => {
    const fakeBin = process.env.CW_TEST_FAKE_CLAUDE_BIN
    if (!fakeBin) throw new Error("bun test setup did not run")

    spawnViaCode(
      `import { spawnClaude } from "./src/runtime/spawn.ts";`,
      `
      spawnClaude({
        provider: { id: "minimax", label: "M", envSchema: {}, settingsTemplate: "x" },
        args: [],
        isolatedHome: ${JSON.stringify(isolatedHome)},
        realHome: ${JSON.stringify(realHome)},
        claudeBin: ${JSON.stringify(fakeBin)},
        env: {},
        recordPath: ${JSON.stringify(recordFile)},
      });
      `,
    )

    const rec = JSON.parse(readFileSync(recordFile, "utf8"))
    // Normalize separators so the assertion is portable across Windows/Unix CI.
    const norm = (s: string) => s.replace(/\\/g, "/")
    expect(norm(rec.env.CLAUDE_CONFIG_DIR)).toBe(norm(join(isolatedHome, ".claude")))
    expect(norm(rec.env.CLAUDE_CONFIG_DIR)).not.toBe(norm(join(realHome, ".claude")))
  })

  it("credentials symlink resolves from isolated → real", () => {
    if (!process.env.CW_TEST_FAKE_CLAUDE_BIN) {
      throw new Error("bun test setup did not run")
    }

    spawnViaCode(
      `import { linkCredentials } from "./src/providers/credentials.ts";`,
      `linkCredentials({ realHome: ${JSON.stringify(realHome)}, isolatedClaudeDir: ${JSON.stringify(join(isolatedHome, ".claude"))} });`,
    )

    const target = realpathOs(join(isolatedHome, ".claude", ".credentials.json"))
    const expected = realpathOs(join(realHome, ".claude", ".credentials.json"))
    expect(target).toBe(expected)
  })

  it("env has only allowlisted + provider keys (no other providers' creds)", () => {
    const fakeBin = process.env.CW_TEST_FAKE_CLAUDE_BIN
    if (!fakeBin) throw new Error("bun test setup did not run")

    spawnViaCode(
      `import { spawnClaude } from "./src/runtime/spawn.ts";`,
      `
      spawnClaude({
        provider: { id: "minimax", label: "M", envSchema: {}, settingsTemplate: "x" },
        args: [],
        isolatedHome: ${JSON.stringify(isolatedHome)},
        realHome: ${JSON.stringify(realHome)},
        claudeBin: ${JSON.stringify(fakeBin)},
        env: { MINIMAX_TOKEN: "secret" },
        parentEnv: {
          BEDROCK_SONNET_KEY: "leaked",
          OPENCODE_TOKEN: "leaked",
          AWS_ACCESS_KEY_ID: "AKIA-leaked",
        },
        recordPath: ${JSON.stringify(recordFile)},
      });
      `,
    )

    const rec = JSON.parse(readFileSync(recordFile, "utf8"))
    expect(rec.env.MINIMAX_TOKEN).toBe("secret")
    expect(rec.env.BEDROCK_SONNET_KEY).toBeUndefined()
    expect(rec.env.OPENCODE_TOKEN).toBeUndefined()
    expect(rec.env.AWS_ACCESS_KEY_ID).toBeUndefined()
  })
})
