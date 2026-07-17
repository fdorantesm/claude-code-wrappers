/**
 * `cw env <provider>` — print the merged env without running Claude.
 */

import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { loadEnvLayered, parseEnv } from "../../config/env-loader.js"
import { filterEnv } from "../../runtime/blocklist.js"
import { getPlatformPaths } from "../../xdg/paths.js"
import { log } from "../logger.js"
import { bootstrapRegistry } from "../registry-bootstrap.js"

export async function envCommand(
  providerId: string,
  opts: { showSecrets?: boolean },
): Promise<void> {
  const xdg = getPlatformPaths()
  const providers = await bootstrapRegistry(xdg)
  const provider = providers.find((p) => p.id === providerId)
  if (!provider) {
    log.error(`provider "${providerId}" not found`)
    process.exit(78)
  }

  const projectLayer = readIfExists(join(process.cwd(), ".claude-wrappers", `${providerId}.env`))
  const userLayer = readIfExists(join(xdg.configDir, "env", `${providerId}.env`))
  const globalLayer = readIfExists(join(xdg.configDir, ".env"))
  const shellLayer = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
  ) as Record<string, string>

  const merged = loadEnvLayered(projectLayer, userLayer, globalLayer, shellLayer)

  // Validate (informational only)
  const parsed = provider.envSchema.safeParse(merged)
  if (!parsed.success) {
    log.warn(`env validation failed: ${parsed.error.message}`)
  }

  const isolatedHome = join(xdg.configDir, "homes", providerId)
  const realHome = homedir()
  const filtered = filterEnv(shellLayer)
  const final: Record<string, string> = {
    HOME: isolatedHome,
    REAL_HOME: realHome,
    CLAUDE_CONFIG_DIR: `${isolatedHome}/.claude`,
    AWS_CONFIG_FILE: `${realHome}/.aws/config`,
    AWS_SHARED_CREDENTIALS_FILE: `${realHome}/.aws/credentials`,
    ...filtered,
    ...(parsed.success ? (parsed.data as Record<string, string>) : merged),
  }

  if (!opts.showSecrets) {
    for (const [k, v] of Object.entries(final)) {
      if (/TOKEN|KEY|SECRET|PASSWORD/i.test(k)) {
        final[k] = `<redacted len=${v.length}>`
      }
    }
    log.info("(use --show-secrets to reveal; warning: prints to terminal)")
  }

  for (const [k, v] of Object.entries(final)) {
    console.log(`${k}=${v}`)
  }
}

function readIfExists(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  try {
    return parseEnv(readFileSync(path, "utf8"))
  } catch {
    return {}
  }
}
