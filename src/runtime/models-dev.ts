/**
 * models.dev integration — discover available models per provider.
 *
 * models.dev is a community-maintained catalog of LLM providers and models.
 * We fetch https://models.dev/api.json once (cached locally) and offer
 * model suggestions during `cw add <provider>` and via `cw models <provider>`.
 *
 * Caching:
 *   - Stored at $XDG_CACHE_HOME/claude-wrappers/models-dev.json (Unix)
 *   - Or %LOCALAPPDATA%\claude-wrappers\cache\models-dev.json (Windows)
 *   - TTL: 24h by default; refreshed on demand with `cw models --refresh`
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { XdgPaths } from "../xdg/paths.js"

const MODELS_DEV_URL = "https://models.dev/api.json"
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24h

export interface ModelsDevModel {
  id: string
  name: string
  description?: string
  family?: string
  attachment?: boolean
  reasoning?: boolean
  tool_call?: boolean
  temperature?: boolean
  knowledge?: string
  release_date?: string
  modalities?: { input: string[]; output: string[] }
  open_weights?: boolean
  limit?: { context: number; input?: number; output?: number }
  cost?: {
    input: number
    output: number
    cache_read?: number
    cache_write?: number
  }
  status?: "deprecated" | "beta" | string
  /** Tier hint for slot mapping: which Claude slot this matches */
  tier?: "opus" | "sonnet" | "haiku" | "small-fast" | "fable" | "mythos" | "other"
}

export interface ModelsDevProvider {
  id: string
  name: string
  npm?: string
  api?: string
  env?: string[]
  doc?: string
  models: Record<string, ModelsDevModel>
}

export interface ModelsDevCatalog {
  fetchedAt: number
  providers: Record<string, ModelsDevProvider>
}

export interface FetchOptions {
  ttl?: number
  refresh?: boolean
}

/** Maps models.dev provider id → cw provider id (lowercase). */
const PROVIDER_ALIAS: Record<string, string> = {
  anthropic: "anthropic",
  bedrock: "bedrock",
  "amazon-bedrock": "bedrock",
  vertex: "vertex",
  "google-vertex": "vertex",
  "azure-foundry": "foundry",
  foundry: "foundry",
  opencode: "opencode",
  openrouter: "openrouter",
  minimax: "minimax",
  ollama: "ollama",
  litellm: "litellm",
}

function cachePath(xdg: XdgPaths): string {
  return join(xdg.dataDir, "cache", "models-dev.json")
}

function isFresh(catalog: ModelsDevCatalog, ttl: number, now: number): boolean {
  return now - catalog.fetchedAt < ttl
}

/**
 * Loads the catalog from cache or fetches it.
 * Throws on network error if no cache exists.
 */
export async function getCatalog(
  xdg: XdgPaths,
  opts: FetchOptions = {},
): Promise<ModelsDevCatalog> {
  const path = cachePath(xdg)
  const now = Date.now()
  const ttl = opts.ttl ?? DEFAULT_TTL_MS

  if (!opts.refresh && existsSync(path)) {
    try {
      const cached = JSON.parse(readFileSync(path, "utf8")) as ModelsDevCatalog
      if (isFresh(cached, ttl, now)) return cached
    } catch {
      // fall through to fetch
    }
  }

  return fetchAndCache(xdg)
}

export async function fetchAndCache(xdg: XdgPaths): Promise<ModelsDevCatalog> {
  const path = cachePath(xdg)
  mkdirSync(join(xdg.dataDir, "cache"), { recursive: true })

  const res = await fetch(MODELS_DEV_URL)
  if (!res.ok) throw new Error(`models.dev returned ${res.status}`)
  const data = (await res.json()) as Record<string, ModelsDevProvider>

  const catalog: ModelsDevCatalog = {
    fetchedAt: Date.now(),
    providers: data,
  }

  writeFileSync(path, JSON.stringify(catalog), { mode: 0o600 })
  return catalog
}

/**
 * Returns models for a cw provider, with tier hints applied.
 * Maps models.dev provider ids to cw provider ids.
 */
export function getModelsForProvider(
  catalog: ModelsDevCatalog,
  cwProviderId: string,
): Array<{ model: ModelsDevModel; tier: string }> {
  const out: Array<{ model: ModelsDevModel; tier: string }> = []

  // Find models.dev providers matching this cw provider
  for (const [mdId, mdProvider] of Object.entries(catalog.providers)) {
    const alias = PROVIDER_ALIAS[mdId] ?? mdId
    if (alias !== cwProviderId) continue

    for (const model of Object.values(mdProvider.models)) {
      out.push({ model, tier: inferTier(model) })
    }
  }

  return out
}

/**
 * Infers the Claude-slot tier a model belongs to:
 *   opus / sonnet / haiku / small-fast / fable / mythos
 *
 * Heuristic:
 *   - If id contains "opus" → opus
 *   - If id contains "sonnet" → sonnet
 *   - If id contains "haiku" → haiku
 *   - If id contains "fable" → fable
 *   - If id contains "mythos" → mythos
 *   - Smallest context → haiku-ish (small-fast)
 *   - Default: "other"
 */
export function inferTier(model: ModelsDevModel): string {
  const id = model.id.toLowerCase()
  if (id.includes("opus")) return "opus"
  if (id.includes("sonnet")) return "sonnet"
  if (id.includes("haiku")) return "haiku"
  if (id.includes("fable")) return "fable"
  if (id.includes("mythos")) return "mythos"
  if (model.family?.toLowerCase().includes("claude")) return "sonnet"

  // For non-Claude models: smallest reasonable context = small-fast
  const ctx = model.limit?.context ?? 0
  if (ctx > 0 && ctx <= 16_000) return "small-fast"
  return "other"
}

/** Picks the best model for each tier (first match, skipping deprecated). */
export function pickModelsByTier(
  models: Array<{ model: ModelsDevModel; tier: string }>,
): Partial<Record<string, ModelsDevModel>> {
  const TIER_ORDER = ["opus", "sonnet", "haiku", "small-fast", "fable", "mythos"]
  const result: Partial<Record<string, ModelsDevModel>> = {}

  for (const tier of TIER_ORDER) {
    const candidates = models
      .filter((m) => m.tier === tier && m.model.status !== "deprecated")
      .map((m) => m.model)
    if (candidates[0]) result[tier] = candidates[0]
  }
  return result
}
