/**
 * Unit tests for src/config/env-loader.ts — parses .env files without dotenv.
 *
 * Why no dotenv: we want precedence rules (shell > user file > project file),
 * and dotenv mutates process.env which breaks that.
 */

import { describe, expect, it } from "bun:test"
import { loadEnvLayered, parseEnv } from "../../src/config/env-loader.js"

describe("env-loader.parseEnv", () => {
  it("parses simple KEY=VALUE", () => {
    expect(parseEnv("FOO=bar")).toEqual({ FOO: "bar" })
  })

  it("parses multiple lines", () => {
    const text = `
FOO=bar
BAZ=qux
`
    expect(parseEnv(text)).toEqual({ FOO: "bar", BAZ: "qux" })
  })

  it("strips optional `export ` prefix", () => {
    expect(parseEnv("export FOO=bar")).toEqual({ FOO: "bar" })
    expect(parseEnv("  export   FOO=bar")).toEqual({ FOO: "bar" })
  })

  it("handles double-quoted values with spaces", () => {
    expect(parseEnv('FOO="hello world"')).toEqual({ FOO: "hello world" })
  })

  it("handles single-quoted values", () => {
    expect(parseEnv("FOO='hello world'")).toEqual({ FOO: "hello world" })
  })

  it("handles unquoted values without inline comments", () => {
    expect(parseEnv("FOO=bar")).toEqual({ FOO: "bar" })
  })

  it("strips inline comments after unquoted values", () => {
    expect(parseEnv("FOO=bar # this is a comment")).toEqual({ FOO: "bar" })
  })

  it("preserves # inside double-quoted values", () => {
    expect(parseEnv('FOO="bar # not a comment"')).toEqual({ FOO: "bar # not a comment" })
  })

  it("supports empty values", () => {
    expect(parseEnv("FOO=")).toEqual({ FOO: "" })
    expect(parseEnv('FOO=""')).toEqual({ FOO: "" })
  })

  it("ignores comment-only lines", () => {
    expect(parseEnv("# this is a comment\nFOO=bar")).toEqual({ FOO: "bar" })
  })

  it("ignores blank lines", () => {
    expect(parseEnv("\n\nFOO=bar\n\n")).toEqual({ FOO: "bar" })
  })

  it("supports CRLF line endings", () => {
    expect(parseEnv("FOO=bar\r\nBAZ=qux\r\n")).toEqual({ FOO: "bar", BAZ: "qux" })
  })

  it("returns the last value for duplicate keys", () => {
    expect(parseEnv("FOO=first\nFOO=second")).toEqual({ FOO: "second" })
  })

  it("rejects invalid lines", () => {
    expect(() => parseEnv("not a valid line")).toThrow(/invalid/i)
    expect(() => parseEnv("FOO")).toThrow(/invalid/i)
  })

  it("supports key chars: letters, digits, underscore", () => {
    expect(parseEnv("FOO_BAR_2=value")).toEqual({ FOO_BAR_2: "value" })
  })
})

describe("env-loader.loadEnvLayered", () => {
  it("merges layers with first-wins precedence", () => {
    const result = loadEnvLayered(
      { A: "from-project" }, // highest priority
      { A: "from-user", B: "from-user" },
      { A: "from-shell", B: "from-shell", C: "from-shell" },
    )
    expect(result).toEqual({
      A: "from-project",
      B: "from-user",
      C: "from-shell",
    })
  })

  it("accepts a single layer", () => {
    expect(loadEnvLayered({ X: "1" })).toEqual({ X: "1" })
  })

  it("returns empty for no layers", () => {
    expect(loadEnvLayered()).toEqual({})
  })
})
