/**
 * `cw models <provider>` — list models available for a provider (via models.dev).
 *
 *   cw models minimax                  # shows tier-grouped models
 *   cw models minimax --refresh        # bypass cache
 *   cw models minimax --tier=opus      # filter by tier
 *   cw models minimax --json           # machine-readable
 */

import {
  getCatalog,
  getModelsForProvider,
  inferTier,
  pickModelsByTier,
} from "../../runtime/models-dev.js"
import { getPlatformPaths } from "../../xdg/paths.js"
import { log } from "../logger.js"
import { bootstrapRegistry } from "../registry-bootstrap.js"

export interface ModelsOptions {
  refresh?: boolean
  tier?: string
  json?: boolean
}

export async function modelsCommand(providerId: string, opts: ModelsOptions): Promise<void> {
  const xdg = getPlatformPaths()
  const providers = await bootstrapRegistry(xdg)
  const provider = providers.find((p) => p.id === providerId)
  if (!provider) {
    log.error(`provider "${providerId}" not found`)
    process.exit(78)
  }

  let catalog: Awaited<ReturnType<typeof getCatalog>>
  try {
    catalog = await getCatalog(xdg, { refresh: opts.refresh })
  } catch (e) {
    log.warn(`could not fetch models.dev: ${e instanceof Error ? e.message : String(e)}`)
    log.info("(check network access; or pass --refresh)")
    process.exit(1)
  }

  const models = getModelsForProvider(catalog, providerId)
  if (models.length === 0) {
    log.warn(`no models found for "${providerId}" in models.dev`)
    log.info("(the provider may not be catalogued at models.dev)")
    process.exit(0)
  }

  const filtered = opts.tier ? models.filter((m) => inferTier(m.model) === opts.tier) : models

  if (opts.json) {
    const picked = pickModelsByTier(models)
    console.log(
      JSON.stringify(
        {
          provider: providerId,
          fetchedAt: catalog.fetchedAt,
          all: filtered.map((m) => ({ id: m.model.id, name: m.model.name, tier: m.tier })),
          recommended: picked,
        },
        null,
        2,
      ),
    )
    return
  }

  // Group by tier
  const byTier = new Map<string, typeof models>()
  for (const m of filtered) {
    const list = byTier.get(m.tier) ?? []
    list.push(m)
    byTier.set(m.tier, list)
  }

  log.info(
    `models for ${providerId} (catalog fetched ${new Date(catalog.fetchedAt).toISOString().slice(0, 10)}):`,
  )
  console.log("")

  const TIER_ORDER = ["opus", "sonnet", "haiku", "small-fast", "fable", "mythos", "other"]
  for (const tier of TIER_ORDER) {
    const list = byTier.get(tier)
    if (!list || list.length === 0) continue

    console.log(`  ${tier.toUpperCase()}`)
    for (const { model } of list) {
      const ctx = model.limit?.context ? `${(model.limit.context / 1000).toFixed(0)}k` : "?"
      const cost =
        model.cost?.input !== undefined
          ? `$${(model.cost.input * 1_000_000).toFixed(2)}/M in`
          : "free?"
      const flags = [
        model.reasoning ? "🧠" : "  ",
        model.attachment ? "📎" : "  ",
        model.tool_call ? "🔧" : "  ",
        model.status === "deprecated" ? "⚠ deprecated" : "",
      ]
        .filter(Boolean)
        .join(" ")
      console.log(
        `    ${model.id.padEnd(40)} ${ctx.padStart(8)} ctx  ${cost.padStart(12)}  ${flags}`,
      )
    }
    console.log("")
  }

  // Recommended mapping
  const recommended = pickModelsByTier(models)
  if (Object.keys(recommended).length > 0) {
    log.info("recommended slot mapping (use as defaults in cw add):")
    for (const [tier, model] of Object.entries(recommended)) {
      console.log(`  ${tier.padEnd(12)} → ${model?.id ?? "—"}`)
    }
  }
}
