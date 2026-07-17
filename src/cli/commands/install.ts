/**
 * `cw install` — generate homes, settings.json, symlinks.
 *
 * Idempotent: re-running yields the same result.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { loadEnvLayered, parseEnv } from "../../config/env-loader.js"
import { linkAwsHome, linkCredentials, syncClaudeHome } from "../../providers/credentials.js"
import { expand } from "../../providers/envsubst.js"
import type { ProviderDef } from "../../providers/types.js"
import { atomicWrite } from "../../xdg/fs.js"
import { getPlatformPaths } from "../../xdg/paths.js"
import { installShim } from "../../xdg/shims.js"
import { log } from "../logger.js"
import { bootstrapRegistry } from "../registry-bootstrap.js"

export interface InstallOptions {
  provider?: string
  configOnly?: boolean
  binOnly?: boolean
  sandbox?: boolean
  claudeBin?: string
}

export async function installCommand(opts: InstallOptions): Promise<void> {
  const xdg = getPlatformPaths()
  const allProviders = await bootstrapRegistry(xdg)
  const providers = opts.provider
    ? allProviders.filter((p) => p.id === opts.provider)
    : allProviders

  if (opts.provider && providers.length === 0) {
    log.error(`provider "${opts.provider}" not found`)
    log.info(`available: ${allProviders.map((p) => p.id).join(", ")}`)
    process.exit(78)
  }

  for (const provider of providers) {
    await installProvider(provider, xdg, opts)
  }

  if (!opts.configOnly) {
    log.info("installing shims...")
    for (const provider of providers) {
      try {
        installShim(xdg.binDir, provider.id)
        log.debug(`shim installed: ${xdg.binDir}/claude-${provider.id}`)
      } catch (e) {
        log.warn(`failed to install shim for ${provider.id}: ${e}`)
      }
    }
  }

  log.info("✓ done")
}

async function installProvider(
  provider: ProviderDef,
  xdg: ReturnType<typeof getPlatformPaths>,
  _opts: InstallOptions,
): Promise<void> {
  const isolatedHome = join(xdg.configDir, "homes", provider.id)
  const isolatedClaudeDir = join(isolatedHome, ".claude")
  mkdirSync(isolatedClaudeDir, { recursive: true })

  // 1. Load .env (user + project, layered with project winning)
  const projectEnvPath = join(process.cwd(), ".claude-wrappers", `${provider.id}.env`)
  const userEnvPath = join(xdg.configDir, "env", `${provider.id}.env`)
  const userEnvFile = join(xdg.configDir, ".env")

  const projectLayer = existsSync(projectEnvPath)
    ? parseEnv(readFileSync(projectEnvPath, "utf8"))
    : {}
  const userLayer = existsSync(userEnvPath) ? parseEnv(readFileSync(userEnvPath, "utf8")) : {}
  const globalLayer = existsSync(userEnvFile) ? parseEnv(readFileSync(userEnvFile, "utf8")) : {}
  const shellLayer = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
  ) as Record<string, string>

  const merged = loadEnvLayered(projectLayer, userLayer, globalLayer, shellLayer)

  // 2. Validate against zod schema
  const parsed = provider.envSchema.safeParse(merged)
  if (!parsed.success) {
    log.warn(`${provider.id}: env validation failed — ${parsed.error.message}`)
    log.warn("  generate settings.json with empty env. Run `cw add <provider>` to fix.")
  }

  // 3. Render settings.template.json
  const templatePath = resolveTemplate(provider.settingsTemplate)
  if (existsSync(templatePath)) {
    const template = readFileSync(templatePath, "utf8")
    const vars = (parsed.success ? (parsed.data as Record<string, string>) : merged) as Record<
      string,
      string
    >
    const rendered = expand(template, vars)
    const json = JSON.parse(rendered)
    const outPath = join(isolatedClaudeDir, "settings.json")
    atomicWrite(outPath, `${JSON.stringify(json, null, 2)}\n`)
    log.info(`  ${provider.id}: wrote ${outPath}`)
  } else {
    log.warn(`  ${provider.id}: template not found: ${templatePath}`)
  }

  // 4. Symlink credentials and other HOME files
  try {
    linkCredentials({ realHome: homedir(), isolatedClaudeDir })
    syncClaudeHome({ realHome: homedir(), isolatedClaudeDir })
    linkAwsHome({ realHome: homedir(), isolatedHome })
  } catch (e) {
    log.debug(`${provider.id}: credential link skipped — ${e}`)
  }
}

function resolveTemplate(relPath: string): string {
  // Look first at ~/.config/claude-wrappers/presets/<id>/... (user override)
  // Then at the bundled location (cwd/presets for dev, dist/presets for installed).
  const candidates = [
    resolve(process.cwd(), relPath),
    resolve(dirname(process.execPath), "..", "presets", relPath.replace(/^presets\//, "")),
    resolve(process.cwd(), "presets", relPath.replace(/^presets\//, "")),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return candidates[0] ?? relPath
}
