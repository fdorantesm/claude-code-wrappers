/**
 * Merges providers from three tiers:
 *   1. Builtin (compiled into the bundle)
 *   2. Drop-ins (user .js files in ~/.config/claude-wrappers/providers/)
 *   3. Plugins (npm packages listed in cw.json → plugins[])
 *
 * Order: plugin > drop-in > builtin (later overrides earlier).
 */

import type { ProviderDef } from "./types.js"

export interface PluginEntry {
  id: string
  label: string
  enabled?: boolean
}

export interface RegistryInput {
  builtin: ProviderDef[]
  dropIns: ProviderDef[]
  plugins: Array<ProviderDef | PluginEntry>
}

const ID_PATTERN = /^[a-z][a-z0-9_-]*$/

export function mergeRegistry(input: RegistryInput): ProviderDef[] {
  const seen = new Map<string, ProviderDef>()
  const all: ProviderDef[] = []

  const collect = (tier: string, providers: RegistryInput["builtin"]): void => {
    const seenInTier = new Set<string>()
    for (const p of providers) {
      if (!ID_PATTERN.test(p.id)) {
        throw new Error(
          `mergeRegistry: invalid provider id "${p.id}" in ${tier} — must be kebab-case`,
        )
      }
      if (seenInTier.has(p.id)) {
        throw new Error(`mergeRegistry: duplicate id "${p.id}" in ${tier}`)
      }
      seenInTier.add(p.id)
      all.push(p)
    }
  }

  collect("builtin", input.builtin)
  collect("dropIns", input.dropIns)
  collect("plugins", input.plugins as ProviderDef[])

  // Last write wins per id (later tier overrides earlier).
  for (const provider of all) {
    seen.set(provider.id, provider)
  }

  return Array.from(seen.values())
}

/**
 * Plugin entries from cw.json: filters out disabled ones.
 */
export function filterEnabledPlugins<P extends { enabled?: boolean }>(plugins: P[]): P[] {
  return plugins.filter((p) => p.enabled !== false)
}

export function buildRegistry(input: RegistryInput): ProviderDef[] {
  return mergeRegistry(input)
}
