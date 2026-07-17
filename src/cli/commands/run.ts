/**
 * `cw run <provider> [--] <args...>` — spawn Claude with provider env.
 */

import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { loadEnvLayered, parseEnv } from "../../config/env-loader.js"
import { runHooks } from "../../runtime/hooks.js"
import { resolveClaudeBin } from "../../runtime/resolve-claude-bin.js"
import { spawnClaude } from "../../runtime/spawn.js"
import { getPlatformPaths } from "../../xdg/paths.js"
import { log } from "../logger.js"
import { bootstrapRegistry } from "../registry-bootstrap.js"

export async function runCommand(providerId: string, args: string[]): Promise<number> {
  const xdg = getPlatformPaths()
  const providers = await bootstrapRegistry(xdg)
  const provider = providers.find((p) => p.id === providerId)
  if (!provider) {
    log.error(`provider "${providerId}" not found`)
    log.info(`available: ${providers.map((p) => p.id).join(", ")}`)
    return 78
  }

  // 1. Resolve env from layered sources
  const projectLayer = readIfExists(join(process.cwd(), ".claude-wrappers", `${providerId}.env`))
  const userLayer = readIfExists(join(xdg.configDir, "env", `${providerId}.env`))
  const globalLayer = readIfExists(join(xdg.configDir, ".env"))
  const shellLayer = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
  ) as Record<string, string>

  const merged = loadEnvLayered(projectLayer, userLayer, globalLayer, shellLayer)

  // 2. Validate
  const parsed = provider.envSchema.safeParse(merged)
  if (!parsed.success) {
    log.error(`${providerId}: env validation failed`)
    for (const issue of parsed.error.issues) {
      log.error(`  ${issue.path.join(".")}: ${issue.message}`)
    }
    return 78
  }

  // 3. Resolve claude binary
  let claudeBin: string
  try {
    claudeBin = resolveClaudeBin()
  } catch (e) {
    log.error(`${e instanceof Error ? e.message : String(e)}`)
    return 127
  }

  const isolatedHome = join(xdg.configDir, "homes", providerId)
  const realHome = homedir()

  // 4. Run pre-exec hooks
  const ctx = {
    parsedEnv: parsed.data,
    envDelta: {} as Record<string, string>,
    home: isolatedHome,
    realHome,
    log: {
      info: (m: string) => log.info(m),
      warn: (m: string) => log.warn(m),
      error: (m: string) => log.error(m),
      debug: (m: string) => log.debug(m),
    },
  }
  await runHooks({
    phase: "pre",
    provider,
    ctx,
    hooks: provider.hooks,
    onError: (e) => log.warn(`preExec hook error: ${e}`),
  })

  // 5. Merge envDelta into the validated env
  const finalEnv: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed.data as Record<string, string>)) {
    finalEnv[k] = v
  }
  for (const [k, v] of Object.entries(ctx.envDelta)) {
    finalEnv[k] = v
  }
  if (provider.extraEnv) {
    Object.assign(finalEnv, provider.extraEnv(parsed.data))
  }

  // 5b. Apply safeMode if provider defines it
  const parsedEnv = parsed.data as Record<string, string>
  const safeModeEnabled =
    (typeof provider.safeMode === "function"
      ? provider.safeMode(parsedEnv)
      : provider.safeMode === true) && !parsedEnv.OPENCODE_ENABLE_UNSUPPORTED_TOOLS

  if (safeModeEnabled) {
    log.info('safeMode active: non-Anthropic model detected, injecting --safe-mode --tools ""')
  }

  const effectiveArgs = safeModeEnabled ? ["--safe-mode", "--tools", "", ...args] : args

  // 6. Spawn Claude
  const code = await spawnClaude({
    provider,
    args: effectiveArgs,
    isolatedHome,
    realHome,
    claudeBin,
    env: finalEnv,
  })

  // 7. Run post-exec hooks
  await runHooks({
    phase: "post",
    provider,
    ctx,
    hooks: provider.hooks,
    code,
    onError: (e) => log.warn(`postExec hook error: ${e}`),
  })

  return code
}

function readIfExists(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  try {
    return parseEnv(readFileSync(path, "utf8"))
  } catch {
    return {}
  }
}
