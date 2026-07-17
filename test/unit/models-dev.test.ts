/**
 * Unit tests for src/runtime/models-dev.ts — model discovery + tier inference.
 */

import { describe, expect, it } from "bun:test"
import {
  type ModelsDevCatalog,
  type ModelsDevModel,
  getModelsForProvider,
  inferTier,
  pickModelsByTier,
} from "../../src/runtime/models-dev.js"

const makeModel = (overrides: Partial<ModelsDevModel>): ModelsDevModel => ({
  id: "test",
  name: "Test",
  ...overrides,
})

const sampleCatalog: ModelsDevCatalog = {
  fetchedAt: Date.now(),
  providers: {
    anthropic: {
      id: "anthropic",
      name: "Anthropic",
      models: {
        "claude-opus-4-8": makeModel({ id: "claude-opus-4-8", limit: { context: 200_000 } }),
        "claude-sonnet-4-6": makeModel({ id: "claude-sonnet-4-6", limit: { context: 200_000 } }),
        "claude-haiku-4-5": makeModel({ id: "claude-haiku-4-5", limit: { context: 200_000 } }),
        "claude-3-haiku-20240307": makeModel({
          id: "claude-3-haiku-20240307",
          limit: { context: 200_000 },
          status: "deprecated",
        }),
      },
    },
    bedrock: {
      id: "bedrock",
      name: "AWS Bedrock",
      models: {
        "anthropic.claude-opus-4-8-v1:0": makeModel({
          id: "anthropic.claude-opus-4-8-v1:0",
          limit: { context: 200_000 },
        }),
        "anthropic.claude-sonnet-4-6-v1:0": makeModel({
          id: "anthropic.claude-sonnet-4-6-v1:0",
          limit: { context: 200_000 },
        }),
      },
    },
    openrouter: {
      id: "openrouter",
      name: "OpenRouter",
      models: {
        "anthropic/claude-opus-4-8": makeModel({
          id: "anthropic/claude-opus-4-8",
          limit: { context: 200_000 },
        }),
        "anthropic/claude-sonnet-4-6": makeModel({
          id: "anthropic/claude-sonnet-4-6",
          limit: { context: 200_000 },
        }),
        "anthropic/claude-haiku-4-5": makeModel({
          id: "anthropic/claude-haiku-4-5",
          limit: { context: 200_000 },
        }),
      },
    },
    ollama: {
      id: "ollama",
      name: "Ollama",
      models: {
        "gemma3:1b-it-q4_K_M": makeModel({
          id: "gemma3:1b-it-q4_K_M",
          limit: { context: 8_000 },
        }),
        "gemma3:e2b-it-q4_K_M": makeModel({
          id: "gemma3:e2b-it-q4_K_M",
          limit: { context: 8_000 },
        }),
      },
    },
  },
}

describe("models-dev.inferTier", () => {
  it("detects opus", () => {
    expect(inferTier(makeModel({ id: "claude-opus-4-8" }))).toBe("opus")
  })
  it("detects sonnet", () => {
    expect(inferTier(makeModel({ id: "claude-sonnet-4-6" }))).toBe("sonnet")
  })
  it("detects haiku", () => {
    expect(inferTier(makeModel({ id: "claude-haiku-4-5" }))).toBe("haiku")
  })
  it("detects fable", () => {
    expect(inferTier(makeModel({ id: "some-fable-1" }))).toBe("fable")
  })
  it("detects mythos", () => {
    expect(inferTier(makeModel({ id: "some-mythos-1" }))).toBe("mythos")
  })
  it("falls back to small-fast for small contexts", () => {
    expect(inferTier(makeModel({ id: "tiny-model", limit: { context: 4_000 } }))).toBe("small-fast")
  })
  it("returns other for unrecognized large models", () => {
    expect(inferTier(makeModel({ id: "big-gpt-5", limit: { context: 200_000 } }))).toBe("other")
  })
})

describe("models-dev.getModelsForProvider", () => {
  it("returns models for direct provider match", () => {
    const models = getModelsForProvider(sampleCatalog, "anthropic")
    expect(models.length).toBe(4)
    expect(models.every((m) => m.model.id.startsWith("claude"))).toBe(true)
  })

  it("returns models for aliased provider (bedrock → anthropic.claude-*)", () => {
    const models = getModelsForProvider(sampleCatalog, "bedrock")
    expect(models.length).toBe(2)
    expect(models.every((m) => m.tier === "opus" || m.tier === "sonnet")).toBe(true)
  })

  it("returns empty for unknown provider", () => {
    expect(getModelsForProvider(sampleCatalog, "unknown")).toEqual([])
  })

  it("returns models for ollama (no Claude prefix)", () => {
    const models = getModelsForProvider(sampleCatalog, "ollama")
    expect(models.length).toBe(2)
    expect(models.every((m) => m.tier === "small-fast")).toBe(true)
  })
})

describe("models-dev.pickModelsByTier", () => {
  it("picks one model per tier, skipping deprecated", () => {
    const models = getModelsForProvider(sampleCatalog, "anthropic")
    const picked = pickModelsByTier(models)
    expect(picked.opus?.id).toBe("claude-opus-4-8")
    expect(picked.sonnet?.id).toBe("claude-sonnet-4-6")
    expect(picked.haiku?.id).toBe("claude-haiku-4-5")
    // 3-haiku is deprecated and should not be picked
    expect(picked.haiku?.id).not.toContain("3-haiku")
  })

  it("returns empty for catalog without tiers", () => {
    const emptyCatalog: ModelsDevCatalog = {
      fetchedAt: Date.now(),
      providers: {
        x: {
          id: "x",
          name: "X",
          models: { foo: makeModel({ id: "foo", limit: { context: 200_000 } }) },
        },
      },
    }
    const picked = pickModelsByTier(getModelsForProvider(emptyCatalog, "x"))
    expect(Object.keys(picked)).toHaveLength(0)
  })
})
