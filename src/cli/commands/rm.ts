/**
 * `cw rm <provider>` — delete a provider's home, env file, shim, and clone entry.
 *
 * Only removes clones (defined in cw.json clones) or custom drop-in providers.
 * Builtins are refused unless cloned, since deleting them would break
 * the wrapper for everyone who uses them.
 *
 * Interactive by default: asks for confirmation. `--force`/`-y` skips the prompt.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { getPlatformPaths } from "../../xdg/paths.js"
import { removeShim } from "../../xdg/shims.js"
import { log } from "../logger.js"
import { bootstrapRegistry } from "../registry-bootstrap.js"

const BUILTINS = new Set([
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
])

export interface RmOptions {
  force?: boolean
}

export async function rmCommand(providerId: string, opts: RmOptions = {}): Promise<void> {
  const xdg = getPlatformPaths()
  const providers = await bootstrapRegistry(xdg)

  const provider = providers.find((p) => p.id === providerId)
  if (!provider) {
    log.error(`provider "${providerId}" not found`)
    log.info(`available: ${providers.map((p) => p.id).join(", ")}`)
    process.exit(78)
  }

  // Determine if this is a clone (deletable) or a builtin (protected).
  const configPath = join(xdg.configDir, "cw.json")
  const configExists = existsSync(configPath)
  const config = configExists ? JSON.parse(readFileSync(configPath, "utf8")) : null
  const isClone = !!config?.clones?.[providerId]
  const isBuiltin = BUILTINS.has(providerId)

  if (isBuiltin && !isClone) {
    log.error(`cannot remove builtin provider "${providerId}"`)
    log.info(
      `builtins are protected. use \`cw rename ${providerId} <new-id>\` or \`cw add ${providerId} --as <clone-id>\` to manage a customized copy.`,
    )
    process.exit(78)
  }

  // What we'll delete
  const homeDir = join(xdg.configDir, "homes", providerId)
  const envFile = join(xdg.configDir, "env", `${providerId}.env`)

  const targets: string[] = []
  if (existsSync(homeDir)) targets.push(homeDir)
  if (existsSync(envFile)) targets.push(envFile)
  targets.push(`shim: ${join(xdg.binDir, `claude-${providerId}`)}`)
  if (isClone) targets.push("clone entry in cw.json")

  log.info(`about to remove "${providerId}":`)
  for (const t of targets) log.info(`  - ${t}`)

  if (!opts.force) {
    const ok = await confirm("proceed? [y/N] ")
    if (!ok) {
      log.info("aborted.")
      return
    }
  }

  // 1. Remove home dir
  if (existsSync(homeDir)) {
    rmSync(homeDir, { recursive: true, force: true })
    log.info(`  ✓ removed ${homeDir}`)
  }

  // 2. Remove env file
  if (existsSync(envFile)) {
    rmSync(envFile, { force: true })
    log.info(`  ✓ removed ${envFile}`)
  }

  // 3. Remove shim
  removeShim(xdg.binDir, providerId)
  log.info("  ✓ removed shim")

  // 4. Remove clone entry from cw.json
  if (isClone && config) {
    delete config.clones[providerId]
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
    log.info("  ✓ removed clone entry from cw.json")
  }

  log.info(`✓ removed "${providerId}"`)
}

async function confirm(prompt: string): Promise<boolean> {
  // If stdin isn't a TTY (e.g., piped), refuse unless --force.
  if (!process.stdin.isTTY) {
    log.warn("non-interactive shell — refusing without --force")
    return false
  }

  process.stdout.write(prompt)
  const { createInterface } = await import("node:readline")
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.on("line", (line) => {
      rl.close()
      resolve(line.trim().toLowerCase() === "y" || line.trim().toLowerCase() === "yes")
    })
    rl.on("close", () => resolve(false))
  })
}
