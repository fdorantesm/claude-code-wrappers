/**
 * Discovers and loads user drop-in providers from
 * ~/.config/claude-wrappers/providers/*.js
 *
 * Drop-ins are .js (not .ts) for v1 — TypeScript support requires
 * on-the-fly transpilation which is deferred to v1.1.
 */

import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { ProviderDef } from "./types.js"

export async function loadDropIns(providersDir: string): Promise<ProviderDef[]> {
  if (!existsSync(providersDir)) return []

  const files = readdirSync(providersDir)
    .filter((f) => f.endsWith(".js") || f.endsWith(".mjs"))
    .filter((f) => !f.startsWith("_"))

  const providers: ProviderDef[] = []
  for (const file of files) {
    const path = join(providersDir, file)
    try {
      const mod = await import(path)
      const candidate = mod.default ?? mod.provider ?? mod
      if (candidate && typeof candidate === "object" && "id" in candidate) {
        providers.push(candidate as ProviderDef)
      }
    } catch (e) {
      console.error(`[loader] failed to load drop-in ${file}:`, e)
    }
  }
  return providers
}
