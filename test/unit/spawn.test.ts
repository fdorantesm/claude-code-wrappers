/**
 * Unit tests for src/runtime/spawn.ts — child_process.spawn with env whitelist.
 *
 * Uses the fake-claude-bin fixture to verify:
 * - HOME points to isolated, REAL_HOME points to real
 * - CLAUDE_CONFIG_DIR points to isolated
 * - Only allowlisted + provider-specific env vars reach the child
 * - argv passes through verbatim
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "bun"
import { spawnClaude } from "../../src/runtime/spawn.js"

describe("spawnClaude", () => {
  let tmp: string
  let isolatedHome: string
  let realHome: string
  let recordFile: string
  let fakeBin: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "cw-spawn-"))
    isolatedHome = join(tmp, "isolated")
    realHome = join(tmp, "real")
    recordFile = join(tmp, "record.json")

    mkdirSync(join(isolatedHome, ".claude"), { recursive: true })
    mkdirSync(join(realHome, ".claude"), { recursive: true })
    writeFileSync(join(isolatedHome, ".claude", "settings.json"), "{}")
    writeFileSync(join(realHome, ".claude", ".credentials.json"), "{}")

    fakeBin = process.env.CW_TEST_FAKE_CLAUDE_BIN ?? ""
    if (!fakeBin || !existsSync(fakeBin)) {
      throw new Error("CW_TEST_FAKE_CLAUDE_BIN not set; bun test setup didn't run")
    }
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  const runSubprocess = (snippet: string): { stdout: string; stderr: string; code: number } => {
    const BUN = Bun.which("bun") ?? "bun"
    const code = `
      import { spawnClaude } from "./src/runtime/spawn.ts";
      ${snippet}
    `
    const result = spawnSync({
      cmd: [BUN, "-e", code],
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    })
    return {
      stdout: new TextDecoder().decode(result.stdout),
      stderr: new TextDecoder().decode(result.stderr),
      code: result.exitCode ?? -1,
    }
  }

  it("sets HOME to isolated and REAL_HOME to real", () => {
    const res = runSubprocess(`
      spawnClaude({
        provider: { id: "test", label: "Test", envSchema: {}, settingsTemplate: "x" },
        args: ["--print", "hello"],
        isolatedHome: ${JSON.stringify(isolatedHome)},
        realHome: ${JSON.stringify(realHome)},
        claudeBin: ${JSON.stringify(fakeBin)},
        env: {},
        recordPath: ${JSON.stringify(recordFile)},
      });
    `)
    expect(res.code).toBe(0)

    const rec = JSON.parse(readFileSync(recordFile, "utf8"))
    expect(rec.env.HOME).toBe(isolatedHome)
    expect(rec.env.REAL_HOME).toBe(realHome)
  })

  it("sets CLAUDE_CONFIG_DIR to isolated .claude", () => {
    const res = runSubprocess(`
      spawnClaude({
        provider: { id: "test", label: "Test", envSchema: {}, settingsTemplate: "x" },
        args: [],
        isolatedHome: ${JSON.stringify(isolatedHome)},
        realHome: ${JSON.stringify(realHome)},
        claudeBin: ${JSON.stringify(fakeBin)},
        env: {},
        recordPath: ${JSON.stringify(recordFile)},
      });
    `)
    expect(res.code).toBe(0)

    const rec = JSON.parse(readFileSync(recordFile, "utf8"))
    expect(rec.env.CLAUDE_CONFIG_DIR).toBe(`${isolatedHome}/.claude`)
  })

  it("passes argv through verbatim", () => {
    const res = runSubprocess(`
      spawnClaude({
        provider: { id: "test", label: "Test", envSchema: {}, settingsTemplate: "x" },
        args: ["--model", "opus", "--print", "hello world"],
        isolatedHome: ${JSON.stringify(isolatedHome)},
        realHome: ${JSON.stringify(realHome)},
        claudeBin: ${JSON.stringify(fakeBin)},
        env: {},
        recordPath: ${JSON.stringify(recordFile)},
      });
    `)
    expect(res.code).toBe(0)

    const rec = JSON.parse(readFileSync(recordFile, "utf8"))
    expect(rec.argv).toContain("--model")
    expect(rec.argv).toContain("opus")
    expect(rec.argv).toContain("hello world")
  })

  it("merges provider env vars into the child env", () => {
    const res = runSubprocess(`
      spawnClaude({
        provider: { id: "test", label: "Test", envSchema: {}, settingsTemplate: "x" },
        args: [],
        isolatedHome: ${JSON.stringify(isolatedHome)},
        realHome: ${JSON.stringify(realHome)},
        claudeBin: ${JSON.stringify(fakeBin)},
        env: { ANTHROPIC_BASE_URL: "https://api.example.com" },
        recordPath: ${JSON.stringify(recordFile)},
      });
    `)
    expect(res.code).toBe(0)

    const rec = JSON.parse(readFileSync(recordFile, "utf8"))
    expect(rec.env.ANTHROPIC_BASE_URL).toBe("https://api.example.com")
  })

  it("blocks other providers' credentials via blocklist", () => {
    const res = runSubprocess(`
      spawnClaude({
        provider: { id: "minimax", label: "M", envSchema: {}, settingsTemplate: "x" },
        args: [],
        isolatedHome: ${JSON.stringify(isolatedHome)},
        realHome: ${JSON.stringify(realHome)},
        claudeBin: ${JSON.stringify(fakeBin)},
        env: { MINIMAX_TOKEN: "secret" },
        parentEnv: { BEDROCK_SONNET_KEY: "should-not-pass" },
        recordPath: ${JSON.stringify(recordFile)},
      });
    `)
    expect(res.code).toBe(0)

    const rec = JSON.parse(readFileSync(recordFile, "utf8"))
    expect(rec.env.MINIMAX_TOKEN).toBe("secret")
    expect(rec.env.BEDROCK_SONNET_KEY).toBeUndefined()
  })
})
