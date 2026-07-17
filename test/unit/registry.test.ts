/**
 * Unit tests for src/providers/registry.ts — merges providers from multiple tiers.
 *
 * Tiers:
 *   1. Builtin (compiled into the bundle)
 *   2. Drop-ins (user .ts/.js files in ~/.config/claude-wrappers/providers/)
 *   3. Plugins (npm packages listed in cw.json → plugins[])
 */

import { describe, expect, it } from "bun:test"
import { buildRegistry, mergeRegistry } from "../../src/providers/registry.js"
import type { ProviderDef } from "../../src/providers/types.js"

// mergeRegistry only reads `id` and `label` per tier; fixtures only need those.
const p = (id: string, label: string): ProviderDef =>
  ({ id, label, envSchema: {} as never, settingsTemplate: "" }) as ProviderDef

describe("registry.mergeRegistry", () => {
  it("returns builtin providers when no overrides", () => {
    const builtin = [p("minimax", "M"), p("bedrock", "B")]
    expect(mergeRegistry({ builtin, dropIns: [], plugins: [] }).map((x) => x.id)).toEqual([
      "minimax",
      "bedrock",
    ])
  })

  it("drop-ins override builtin with the same id", () => {
    const builtin = [p("minimax", "Builtin M")]
    const dropIns = [p("minimax", "User M")]
    const out = mergeRegistry({ builtin, dropIns, plugins: [] })
    expect(out).toHaveLength(1)
    expect(out[0]?.label).toBe("User M")
  })

  it("plugins override drop-ins which override builtin", () => {
    const builtin = [p("x", "B")]
    const dropIns = [p("x", "D")]
    const plugins = [p("x", "P")]
    const out = mergeRegistry({ builtin, dropIns, plugins })
    expect(out[0]?.label).toBe("P")
  })

  it("adds new providers from drop-ins without removing builtin ones", () => {
    const builtin = [p("a", "A")]
    const dropIns = [p("b", "B")]
    const ids = mergeRegistry({ builtin, dropIns, plugins: [] }).map((x) => x.id)
    expect(ids.sort()).toEqual(["a", "b"])
  })

  it("ignores disabled plugins", () => {
    const plugins = [
      { id: "on", label: "On", enabled: true },
      { id: "off", label: "Off", enabled: false },
    ]
    // Pre-filter to enabled only before passing to mergeRegistry.
    const enabled = plugins.filter((x) => x.enabled !== false)
    const ids = mergeRegistry({
      builtin: [],
      dropIns: [],
      plugins: enabled as unknown as ProviderDef[],
    }).map((x) => x.id)
    expect(ids).toContain("on")
    expect(ids).not.toContain("off")
  })

  it("validates id format (kebab-case)", () => {
    expect(() =>
      mergeRegistry({
        builtin: [p("BadName", "x")],
        dropIns: [],
        plugins: [],
      }),
    ).toThrow()
  })

  it("rejects duplicate ids within the same tier", () => {
    expect(() =>
      mergeRegistry({
        builtin: [p("dup", "1"), p("dup", "2")],
        dropIns: [],
        plugins: [],
      }),
    ).toThrow()
  })
})

// Reference buildRegistry so the import isn't dropped if a future test moves out.
describe("registry.buildRegistry", () => {
  it("is a thin alias for mergeRegistry", () => {
    const builtin = [p("only", "O")]
    expect(buildRegistry({ builtin, dropIns: [], plugins: [] }).map((x) => x.id)).toEqual(["only"])
  })
})
