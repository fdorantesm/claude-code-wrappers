/**
 * `cw reset <provider>` — regenerate a provider's home.
 */

import { getPlatformPaths } from "../../xdg/paths.js"
import { log } from "../logger.js"
import { bootstrapRegistry } from "../registry-bootstrap.js"
import { installCommand } from "./install.js"

export async function resetCommand(target: string | undefined): Promise<void> {
  const xdg = getPlatformPaths()
  const providers = await bootstrapRegistry(xdg)

  if (!target) {
    log.error("usage: cw reset <provider> | --all | --user-settings | --credentials")
    process.exit(64)
  }

  if (target === "--all") {
    log.info("regenerating all providers...")
    await installCommand({})
    return
  }

  if (target === "--user-settings") {
    log.warn("--user-settings is not yet implemented in v1")
    log.info("(planned for v1.1 — would backup and sanitize ~/.claude/settings.json)")
    return
  }

  if (target === "--credentials") {
    log.warn("--credentials requires --yes to actually delete ~/.claude/.credentials.json")
    return
  }

  const provider = providers.find((p) => p.id === target)
  if (!provider) {
    log.error(`provider "${target}" not found`)
    process.exit(78)
  }

  log.info(`regenerating ${target}...`)
  await installCommand({ provider: target })
}
