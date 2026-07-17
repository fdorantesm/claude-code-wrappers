/**
 * Unit tests for src/providers/credentials.ts — symlink .credentials.json
 * from isolated HOME to real ~/.claude/.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { linkCredentials } from "../../src/providers/credentials.js"

describe("linkCredentials", () => {
  let realHome: string
  let isolatedClaudeDir: string
  let realCredentials: string
  let isolatedCredentials: string

  beforeEach(() => {
    realHome = mkdtempSync(join(tmpdir(), "cw-cred-real-"))
    const isolatedBase = mkdtempSync(join(tmpdir(), "cw-cred-isolated-"))
    isolatedClaudeDir = join(isolatedBase, ".claude")

    // real ~/.claude/.credentials.json
    realCredentials = join(realHome, ".claude", ".credentials.json")
    mkdirSync(join(realHome, ".claude"), { recursive: true })
    writeFileSync(realCredentials, JSON.stringify({ fake: true }), { mode: 0o600 })

    // isolated .claude/ (must exist)
    mkdirSync(isolatedClaudeDir, { recursive: true })
    writeFileSync(join(isolatedClaudeDir, "settings.json"), "{}", { mode: 0o600 })

    isolatedCredentials = join(isolatedClaudeDir, ".credentials.json")
  })

  afterEach(() => {
    rmSync(realHome, { recursive: true, force: true })
    rmSync(join(isolatedClaudeDir, ".."), { recursive: true, force: true })
  })

  it("creates a symlink from isolated to real", () => {
    linkCredentials({ realHome, isolatedClaudeDir })
    expect(lstatSync(isolatedCredentials).isSymbolicLink()).toBe(true)
  })

  it("the symlink resolves to the real credentials file", () => {
    linkCredentials({ realHome, isolatedClaudeDir })
    const target = readlinkSync(isolatedCredentials)
    expect(target).toBe(realCredentials)
  })

  it("is idempotent — re-running does not error", () => {
    linkCredentials({ realHome, isolatedClaudeDir })
    expect(() => linkCredentials({ realHome, isolatedClaudeDir })).not.toThrow()
    expect(lstatSync(isolatedCredentials).isSymbolicLink()).toBe(true)
  })

  it("throws if real credentials do not exist", () => {
    rmSync(realCredentials)
    expect(() => linkCredentials({ realHome, isolatedClaudeDir })).toThrow(/credentials/i)
  })

  it("throws if isolated .claude dir does not exist", () => {
    rmSync(isolatedClaudeDir, { recursive: true, force: true })
    expect(() => linkCredentials({ realHome, isolatedClaudeDir })).toThrow()
  })

  it("supports any isolatedClaudeDir path", () => {
    const nestedBase = join(isolatedClaudeDir, "..")
    const nested = join(nestedBase, "subdir", ".claude")
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, "settings.json"), "{}", { mode: 0o600 })
    linkCredentials({ realHome, isolatedClaudeDir: nested })
    expect(lstatSync(join(nested, ".credentials.json")).isSymbolicLink()).toBe(true)
  })
})
