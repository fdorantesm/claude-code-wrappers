/**
 * `cw rename <old-id> <new-id>` — rename a provider instance.
 *
 * Moves home dir, env file, updates shim, and updates cw.json clones.
 * Only works on clones (defined in cw.json clones) or custom drop-in providers.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { getPlatformPaths } from "../../xdg/paths.js"
import { installShim, removeShim } from "../../xdg/shims.js"
import { log } from "../logger.js"
import { bootstrapRegistry } from "../registry-bootstrap.js"

export async function renameCommand(oldId: string, newId: string): Promise<void> {
  const xdg = getPlatformPaths()
  const providers = await bootstrapRegistry(xdg)

  const provider = providers.find((p) => p.id === oldId)
  if (!provider) {
    log.error(`provider "${oldId}" not found`)
    log.info(`available: ${providers.map((p) => p.id).join(", ")}`)
    process.exit(78)
  }

  // Check if it's a clone (must exist in cw.json clones)
  const configPath = join(xdg.configDir, "cw.json")
  if (!existsSync(configPath)) {
    log.error("no cw.json found — can only rename clones or custom providers")
    process.exit(78)
  }

  const config = JSON.parse(readFileSync(configPath, "utf8"))
  const isClone = config.clones?.[oldId]
  const isBuiltin = [
    "anthropic",
    "bedrock",
    "vertex",
    "foundry",
    "opencode",
    "openrouter",
    "litellm",
    "ollama",
    "minimax",
    "ollama-cloud",
    "ollama-mini",
  ].includes(oldId)

  if (isBuiltin && !isClone) {
    log.error(`cannot rename builtin provider "${oldId}"`)
    log.info(`use \`cw add ${oldId} --as ${newId}\` to create a clone instead`)
    process.exit(78)
  }

  if (providers.some((p) => p.id === newId)) {
    log.error(`provider "${newId}" already exists`)
    process.exit(78)
  }

  const oldHome = join(xdg.configDir, "homes", oldId)
  const newHome = join(xdg.configDir, "homes", newId)
  const oldEnv = join(xdg.configDir, "env", `${oldId}.env`)
  const newEnv = join(xdg.configDir, "env", `${newId}.env`)

  // Rename home dir
  if (existsSync(oldHome)) {
    renameSync(oldHome, newHome)
    log.info(`  home: ${oldHome} → ${newHome}`)
  }

  // Rename env file
  if (existsSync(oldEnv)) {
    renameSync(oldEnv, newEnv)
    log.info(`  env: ${oldEnv} → ${newEnv}`)
  }

  // Update shim
  removeShim(xdg.binDir, oldId)
  installShim(xdg.binDir, newId)
  log.info(`  shim: claude-${oldId} → claude-${newId}`)

  // Update cw.json clones
  if (isClone) {
    config.clones[newId] = config.clones[oldId]
    delete config.clones[oldId]
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
    log.info("  clones: updated cw.json")
  }

  log.info(`✓ renamed ${oldId} → ${newId}`)
}
