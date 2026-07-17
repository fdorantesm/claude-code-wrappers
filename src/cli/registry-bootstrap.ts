/**
 * Bootstraps the provider registry:
 *   1. Start with builtin presets
 *   2. Load drop-ins from ~/.config/claude-wrappers/providers/*.js
 *   3. Load plugins declared in cw.json
 *   4. Create clones from cw.json
 *
 * Returns the merged registry, validating each provider's id and shape.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { type CwConfig, CwConfigSchema } from "../config/schema.js"
import { loadDropIns } from "../providers/loader.js"
import { BUILTIN_PRESETS } from "../providers/presets/index.js"
import { buildRegistry } from "../providers/registry.js"
import type { ProviderDef } from "../providers/types.js"
import type { XdgPaths } from "../xdg/paths.js"
import { log } from "./logger.js"

export async function bootstrapRegistry(xdg: XdgPaths): Promise<ProviderDef[]> {
  const builtin = BUILTIN_PRESETS

  // Drop-ins
  const dropInsDir = join(xdg.configDir, "providers")
  const dropIns = await loadDropIns(dropInsDir)

  // Plugins and clones from cw.json
  const configPath = join(xdg.configDir, "cw.json")
  let plugins: ProviderDef[] = []
  let clones: ProviderDef[] = []
  if (existsSync(configPath)) {
    try {
      const raw = JSON.parse(readFileSync(configPath, "utf8"))
      const cfg: CwConfig = CwConfigSchema.parse(raw)
      plugins = await loadPlugins(cfg)
      clones = loadClones(cfg, builtin)
      log.debug(
        `loaded ${plugins.length} plugin providers, ${clones.length} clones from ${configPath}`,
      )
    } catch (e) {
      log.warn(`failed to load ${configPath}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return buildRegistry({ builtin, dropIns: [...dropIns, ...clones], plugins })
}

function loadClones(cfg: CwConfig, builtin: ProviderDef[]): ProviderDef[] {
  const result: ProviderDef[] = []
  for (const [cloneId, cloneDef] of Object.entries(cfg.clones)) {
    const base = builtin.find((p) => p.id === cloneDef.extends)
    if (!base) {
      log.warn(`clone "${cloneId}": base provider "${cloneDef.extends}" not found, skipping`)
      continue
    }
    result.push({
      ...base,
      id: cloneId,
      label: cloneDef.label ?? `${base.label} (${cloneId})`,
    })
  }
  return result
}

async function loadPlugins(_cfg: CwConfig): Promise<ProviderDef[]> {
  // Plugin loading by npm package name is deferred to v1.1.
  // For v1, plugins must be installed as global npm packages and referenced
  // via dynamic import. The simplest pattern is symlinking their preset
  // .js into ~/.config/claude-wrappers/providers/.
  return []
}
