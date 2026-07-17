/**
 * Spawns Claude with the isolated environment.
 *
 * Critical responsibilities:
 *   - HOME = isolated home
 *   - REAL_HOME = real user home (so the child can reach ~/.aws/ etc.)
 *   - CLAUDE_CONFIG_DIR = isolated .claude (so settings.json is provider-specific)
 *   - env whitelist applied (blocklist of credential patterns)
 *   - provider-specific env vars merged in
 *   - argv passes through verbatim
 */

import { spawn } from "bun"
import type { ProviderDef } from "../providers/types.js"
import { filterEnv } from "./blocklist.js"

export interface SpawnOptions {
  provider: ProviderDef
  args: string[]
  isolatedHome: string
  realHome: string
  claudeBin: string
  /** Provider-validated env vars (already merged from .env + keyring + exec) */
  env: Record<string, string>
  /** Parent's env (will be filtered via blocklist) */
  parentEnv?: Record<string, string | undefined>
  /** Optional path to record argv+env (used by tests) */
  recordPath?: string
}

export async function spawnClaude(opts: SpawnOptions): Promise<number> {
  const env: Record<string, string> = {}

  // 1. Filter parent env through blocklist
  const filtered = filterEnv(opts.parentEnv ?? (process.env as Record<string, string | undefined>))

  // 2. Merge filtered parent env
  for (const [k, v] of Object.entries(filtered)) env[k] = v

  // 3. Override critical paths
  env.HOME = opts.isolatedHome
  env.REAL_HOME = opts.realHome
  env.CLAUDE_CONFIG_DIR = `${opts.isolatedHome}/.claude`
  env.AWS_CONFIG_FILE = `${opts.realHome}/.aws/config`
  env.AWS_SHARED_CREDENTIALS_FILE = `${opts.realHome}/.aws/credentials`

  // 4. Merge provider-specific env (these win over filtered parent)
  for (const [k, v] of Object.entries(opts.env)) env[k] = v

  // 5. Optional: record argv+env for test introspection
  if (opts.recordPath) {
    await Bun.write(
      opts.recordPath,
      JSON.stringify(
        {
          argv: [opts.claudeBin, ...opts.args],
          env,
          cwd: process.cwd(),
          pid: process.pid,
        },
        null,
        2,
      ),
    )
  }

  // 6. Spawn the child with stdio inherited
  const proc = spawn({
    cmd: [opts.claudeBin, ...opts.args],
    env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })

  const exitCode = await proc.exited
  return exitCode
}
