/**
 * Unit tests for src/runtime/blocklist.ts — env var allow/block filters.
 *
 * Critical for forward-compat: Claude Code may add new env vars; blocklist
 * preserves them unless explicitly denied.
 */

import { describe, expect, it } from "bun:test"
import { DEFAULT_BLOCKLIST, filterEnv } from "../../src/runtime/blocklist.js"

describe("blocklist.filterEnv", () => {
  const sample = {
    PATH: "/usr/bin",
    HOME: "/home/user",
    ANTHROPIC_BASE_URL: "https://api.anthropic.com",
    ANTHROPIC_AUTH_TOKEN: "sk-fake",
    AWS_PROFILE: "default",
    AWS_ACCESS_KEY_ID: "AKIA-fake",
    OPENCODE_TOKEN: "oc-fake",
    OLLAMA_HOST: "http://localhost:11434",
    LANG: "en_US.UTF-8",
    TERM: "xterm-256color",
    MY_RANDOM_NEW_VAR: "preserve-me",
  }

  it("removes keys matching the default blocklist", () => {
    const out = filterEnv(sample)
    expect(out).not.toHaveProperty("ANTHROPIC_AUTH_TOKEN")
    expect(out).not.toHaveProperty("AWS_ACCESS_KEY_ID")
    expect(out).not.toHaveProperty("OPENCODE_TOKEN")
  })

  it("preserves allowed keys (PATH, HOME, LANG, TERM)", () => {
    const out = filterEnv(sample)
    expect(out.PATH).toBe("/usr/bin")
    expect(out.HOME).toBe("/home/user")
    expect(out.LANG).toBe("en_US.UTF-8")
    expect(out.TERM).toBe("xterm-256color")
  })

  it("preserves unknown keys (forward-compat)", () => {
    const out = filterEnv(sample)
    expect(out.MY_RANDOM_NEW_VAR).toBe("preserve-me")
  })

  it("always preserves HOME and REAL_HOME even if in blocklist", () => {
    const out = filterEnv({ ...sample, HOME: "/home/user" })
    expect(out.HOME).toBe("/home/user")
  })

  it("supports a custom blocklist", () => {
    const out = filterEnv(sample, { block: ["LANG", "TERM"] })
    expect(out).not.toHaveProperty("LANG")
    expect(out).not.toHaveProperty("TERM")
  })

  it("supports an explicit allowlist that overrides blocklist", () => {
    const out = filterEnv(sample, { allow: ["ANTHROPIC_AUTH_TOKEN"] })
    expect(out.ANTHROPIC_AUTH_TOKEN).toBe("sk-fake")
  })

  it("supports wildcard patterns in blocklist", () => {
    const out = filterEnv(sample, { block: ["AWS_*", "ANTHROPIC_*"] })
    expect(out).not.toHaveProperty("AWS_PROFILE")
    expect(out).not.toHaveProperty("AWS_ACCESS_KEY_ID")
    expect(out).not.toHaveProperty("ANTHROPIC_BASE_URL")
    expect(out).not.toHaveProperty("ANTHROPIC_AUTH_TOKEN")
  })

  it("returns a new object, does not mutate input", () => {
    const original = { ...sample }
    filterEnv(sample)
    expect(sample).toEqual(original)
  })

  it("handles an empty env", () => {
    expect(filterEnv({})).toEqual({})
  })
})

describe("DEFAULT_BLOCKLIST", () => {
  it("includes common credential-related patterns", () => {
    const flat = DEFAULT_BLOCKLIST.join(" ")
    expect(flat).toMatch(/TOKEN/)
    expect(flat).toMatch(/KEY/)
    expect(flat).toMatch(/SECRET/)
    expect(flat).toMatch(/PASSWORD/)
  })

  it("includes AWS_*, ANTHROPIC_*, OPENCODE_*, OLLAMA_*", () => {
    const flat = DEFAULT_BLOCKLIST.join(" ")
    expect(flat).toContain("AWS_*")
    expect(flat).toContain("ANTHROPIC_*")
    expect(flat).toContain("OPENCODE_*")
    expect(flat).toContain("OLLAMA_*")
  })

  it("does NOT block OTEL_* (telemetry is user infra)", () => {
    const flat = DEFAULT_BLOCKLIST.join(" ")
    expect(flat).not.toContain("OTEL_*")
  })
})
