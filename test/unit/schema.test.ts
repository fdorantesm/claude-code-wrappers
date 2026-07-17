/**
 * Unit tests for src/config/schema.ts — zod schemas for cw.json.
 */

import { describe, expect, it } from "bun:test"
import { CwConfigSchema } from "../../src/config/schema.js"

describe("CwConfigSchema", () => {
  it("accepts an empty config (uses defaults)", () => {
    const result = CwConfigSchema.parse({})
    expect(result.providers).toEqual([])
    expect(result.plugins).toEqual([])
  })

  it("accepts a minimal valid config", () => {
    const result = CwConfigSchema.parse({
      providers: ["minimax"],
    })
    expect(result.providers).toEqual(["minimax"])
  })

  it("accepts a full config with plugins", () => {
    const result = CwConfigSchema.parse({
      providers: ["minimax", "bedrock"],
      plugins: [{ name: "claude-wrappers-provider-mycorp", enabled: true }],
      defaults: {
        sandbox: false,
        logLevel: "info",
      },
    })
    expect(result.providers).toHaveLength(2)
    expect(result.plugins).toHaveLength(1)
    expect(result.defaults?.sandbox).toBe(false)
  })

  it("rejects an unknown top-level key", () => {
    expect(() => CwConfigSchema.parse({ unknownKey: "x" })).toThrow()
  })

  it("validates provider id format (kebab-case)", () => {
    expect(() => CwConfigSchema.parse({ providers: ["MyProvider"] })).toThrow()
    expect(() => CwConfigSchema.parse({ providers: ["with spaces"] })).toThrow()
    expect(() => CwConfigSchema.parse({ providers: ["valid-name", "valid_name_2"] })).not.toThrow()
  })

  it("validates logLevel enum", () => {
    expect(() => CwConfigSchema.parse({ defaults: { logLevel: "invalid" as never } })).toThrow()
    expect(() => CwConfigSchema.parse({ defaults: { logLevel: "debug" } })).not.toThrow()
  })
})
