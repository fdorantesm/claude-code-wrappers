/**
 * `cw doctor [provider]` — health check.
 */

import { existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { resolveClaudeBin } from "../../runtime/resolve-claude-bin.js"
import { getPlatformPaths } from "../../xdg/paths.js"
import { chmodOwnerOnly } from "../../xdg/perms.js"
import { log } from "../logger.js"
import { bootstrapRegistry } from "../registry-bootstrap.js"

export async function doctorCommand(providerId?: string): Promise<void> {
  const xdg = getPlatformPaths()
  const providers = await bootstrapRegistry(xdg)
  const targets = providerId ? providers.filter((p) => p.id === providerId) : providers

  if (providerId && targets.length === 0) {
    log.error(`provider "${providerId}" not found`)
    process.exit(78)
  }

  // Global checks
  let allGreen = true

  // claude binary
  try {
    const bin = resolveClaudeBin()
    log.info(`✓ claude binary resolved: ${bin}`)
  } catch (e) {
    log.error(`✗ claude binary: ${e instanceof Error ? e.message : String(e)}`)
    allGreen = false
  }

  // xdg paths
  log.info(`✓ config dir: ${xdg.configDir}`)
  log.info(`✓ bin dir: ${xdg.binDir}`)

  // Per-provider checks
  for (const provider of targets) {
    log.info(`── ${provider.id} (${provider.label}) ──`)
    const isolatedHome = join(xdg.configDir, "homes", provider.id)
    const settingsPath = join(isolatedHome, ".claude", "settings.json")
    const credentialsLink = join(isolatedHome, ".claude", ".credentials.json")
    const envFile = join(xdg.configDir, "env", `${provider.id}.env`)

    if (!existsSync(envFile)) {
      log.warn(`  ⚠ env file missing: ${envFile}`)
      allGreen = false
    } else {
      const mode = statSync(envFile).mode & 0o777
      if ((mode & 0o077) !== 0) {
        log.warn(`  ⚠ env file is not owner-only (mode=${mode.toString(8)})`)
        chmodOwnerOnly(envFile)
        log.info("    → fixed to 0600")
      } else {
        log.info(`  ✓ env file: ${envFile} (mode 600)`)
      }
    }

    if (!existsSync(settingsPath)) {
      log.warn(`  ⚠ settings.json missing: ${settingsPath}`)
      log.info("    → run: cw install")
      allGreen = false
    } else {
      log.info(`  ✓ settings.json: ${settingsPath}`)
    }

    if (!existsSync(credentialsLink)) {
      log.warn(`  ⚠ credentials link missing: ${credentialsLink}`)
      allGreen = false
    } else {
      log.info(`  ✓ credentials link: ${credentialsLink}`)
    }

    // Run provider-specific checks
    if (provider.checks) {
      for (const check of provider.checks) {
        try {
          const result = await check({
            provider,
            parsedEnv: {},
            envDelta: {},
            home: isolatedHome,
            log: {
              info: () => {},
              warn: () => {},
              error: () => {},
              debug: () => {},
            },
          })
          if (result.ok) {
            log.info(`  ✓ check: ${result.message ?? "passed"}`)
          } else {
            log.warn(`  ⚠ check: ${result.message ?? "failed"}`)
            allGreen = false
          }
        } catch (e) {
          log.warn(`  ⚠ check threw: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }
  }

  if (!allGreen) {
    log.info("")
    log.warn("Some checks failed. Run `cw install` to repair.")
    process.exit(1)
  }

  log.info("")
  log.info("✓ all checks passed")
}
