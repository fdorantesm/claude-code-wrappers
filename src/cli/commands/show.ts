/**
 * `cw show <provider>` — detailed view of a single provider.
 */

import { join } from "node:path"
import { getPlatformPaths } from "../../xdg/paths.js"
import { log } from "../logger.js"
import { bootstrapRegistry } from "../registry-bootstrap.js"

export async function showCommand(providerId: string): Promise<void> {
  const xdg = getPlatformPaths()
  const providers = await bootstrapRegistry(xdg)
  const provider = providers.find((p) => p.id === providerId)
  if (!provider) {
    log.error(`provider "${providerId}" not found`)
    process.exit(78)
  }

  const homeDir = join(xdg.configDir, "homes", providerId)
  const settingsPath = join(homeDir, ".claude", "settings.json")
  const envFile = join(xdg.configDir, "env", `${providerId}.env`)

  console.log(`Provider:  ${provider.id}`)
  console.log(`Label:     ${provider.label}`)
  console.log(`Group:     ${provider.group ?? "—"}`)
  console.log(`Mode:      ${provider.credentialMode ?? "—"}`)
  console.log("Source:    builtin")
  console.log("")
  console.log(`Command:   claude-${providerId}  →  ${xdg.binDir}/claude-${providerId}`)
  console.log(`Template:  ${provider.settingsTemplate}`)
  console.log(`Settings:  ${settingsPath}`)
  console.log(`Env file:  ${envFile}`)
  console.log("")
  console.log(
    `Hooks:     ${provider.hooks?.preExec ? "preExec, " : ""}${provider.hooks?.postExec ? "postExec" : "(none)"}`,
  )
  console.log(`Checks:    ${provider.checks?.length ?? 0}`)
  console.log("")
  if (provider.notes?.length) {
    console.log("Notes:")
    for (const n of provider.notes) console.log(`  • ${n}`)
  }
}
