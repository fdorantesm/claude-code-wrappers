/**
 * `cw list` — show all configured providers with status.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { ProviderDef } from "../../providers/types.js"
import { getPlatformPaths } from "../../xdg/paths.js"
import { bootstrapRegistry } from "../registry-bootstrap.js"

export async function listCommand(opts: { json?: boolean }): Promise<void> {
  const xdg = getPlatformPaths()
  const providers = await bootstrapRegistry(xdg)

  const rows = providers.map((p) => {
    const homeDir = join(xdg.configDir, "homes", p.id, ".claude")
    const settingsPath = join(homeDir, "settings.json")
    const envFile = join(xdg.configDir, "env", `${p.id}.env`)
    const status = computeStatus(settingsPath, envFile, p)
    return {
      id: p.id,
      label: p.label,
      group: p.group ?? "—",
      credentialMode: p.credentialMode ?? "—",
      status,
    }
  })

  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2))
    return
  }

  const idWidth = Math.max(8, ...rows.map((r) => r.id.length))
  const labelWidth = Math.max(5, ...rows.map((r) => r.label.length))
  const groupWidth = Math.max(5, ...rows.map((r) => r.group.length))
  const modeWidth = Math.max(4, ...rows.map((r) => r.credentialMode.length))

  const header = [
    "PROVIDER".padEnd(idWidth),
    "LABEL".padEnd(labelWidth),
    "GROUP".padEnd(groupWidth),
    "MODE".padEnd(modeWidth),
    "STATUS",
  ].join("  ")

  console.log(header)
  console.log("-".repeat(header.length))
  for (const r of rows) {
    console.log(
      [
        r.id.padEnd(idWidth),
        r.label.padEnd(labelWidth),
        r.group.padEnd(groupWidth),
        r.credentialMode.padEnd(modeWidth),
        r.status,
      ].join("  "),
    )
  }
}

function computeStatus(settingsPath: string, envFile: string, _p: ProviderDef): string {
  const hasSettings = existsSync(settingsPath)
  const hasEnv = existsSync(envFile)
  if (hasSettings && hasEnv) return "✓ ready"
  if (hasEnv) return "⚠ env only"
  if (hasSettings) return "⚠ settings only"
  return "○ not configured"
}
