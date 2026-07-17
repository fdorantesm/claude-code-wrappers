/**
 * Unit tests for src/providers/types.ts — ProviderDef and defineProvider.
 *
 * defineProvider is an identity function whose only purpose is to provide
 * type inference. These tests verify the runtime identity behavior and that
 * the resulting object passes structural checks.
 */

import { describe, expect, it } from "bun:test"
import { z } from "zod"
import { defineProvider } from "../../src/providers/types.js"

describe("defineProvider", () => {
  it("returns the input unchanged", () => {
    const def = {
      id: "test",
      label: "Test Provider",
      envSchema: z.object({ X: z.string() }),
      settingsTemplate: "test/settings.template.json",
    }
    expect(defineProvider(def)).toBe(def)
  })

  it("preserves all fields", () => {
    const def = defineProvider({
      id: "minimax",
      label: "MiniMax",
      group: "anthropic-compatible",
      credentialMode: "anthropic-token",
      envSchema: z.object({
        TOKEN: z.string(),
        BASE_URL: z.string().url(),
      }),
      settingsTemplate: "minimax/settings.template.json",
      realHome: true,
      hooks: {
        preExec: () => {},
      },
    })

    expect(def.id).toBe("minimax")
    expect(def.label).toBe("MiniMax")
    expect(def.group).toBe("anthropic-compatible")
    expect(def.credentialMode).toBe("anthropic-token")
    expect(def.realHome).toBe(true)
    expect(def.hooks?.preExec).toBeInstanceOf(Function)
  })

  it("envSchema infers correct TypeScript types", () => {
    // This is a compile-time check; the test just verifies runtime shape.
    const def = defineProvider({
      id: "demo",
      label: "Demo",
      envSchema: z.object({
        URL: z.string().url(),
        COUNT: z.number().default(10),
      }),
      settingsTemplate: "demo/settings.template.json",
    })

    const parsed = def.envSchema.parse({ URL: "https://x.com" })
    expect(parsed.COUNT).toBe(10)
    expect(parsed.URL).toBe("https://x.com")
  })

  it("hooks may be undefined or omitted", () => {
    const def = defineProvider({
      id: "no-hooks",
      label: "No Hooks",
      envSchema: z.object({}),
      settingsTemplate: "x/y.json",
    })
    expect(def.hooks).toBeUndefined()
  })
})
