/**
 * `cw init` — first-time setup.
 *
 * Creates:
 *   ~/.config/claude-wrappers/cw.json
 *   ~/.config/claude-wrappers/.env.example
 *   ~/.config/claude-wrappers/homes/
 *   ~/.config/claude-wrappers/env/
 *   ~/.config/claude-wrappers/providers/
 */

import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ensureDir } from "../../xdg/fs.js"
import { getPlatformPaths } from "../../xdg/paths.js"
import { log } from "../logger.js"

const ENV_EXAMPLE = `# MiniMax
MINIMAX_BASE_URL=https://api.minimax.chat/v1
MINIMAX_TOKEN=
MINIMAX_DEFAULT_MODEL=MiniMax-Text-01

# Bedrock
AWS_PROFILE=default
AWS_REGION=us-east-1
BEDROCK_OPUS_MODEL_ARN=
BEDROCK_SONNET_MODEL_ARN=
BEDROCK_HAIKU_MODEL_ARN=

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434

# OpenCode
OPENCODE_TOKEN=
`

export async function initCommand(): Promise<void> {
  const xdg = getPlatformPaths()
  log.info(`initializing ${xdg.configDir}`)

  ensureDir(xdg.configDir)
  ensureDir(join(xdg.configDir, "env"))
  ensureDir(join(xdg.configDir, "homes"))
  ensureDir(join(xdg.configDir, "providers"))

  const configPath = join(xdg.configDir, "cw.json")
  if (!existsSync(configPath)) {
    writeFileSync(
      configPath,
      `${JSON.stringify(
        {
          $schema:
            "https://raw.githubusercontent.com/claude-code-wrappers/claude-code-wrappers/main/cw.schema.json",
          providers: [],
          plugins: [],
          defaults: { sandbox: false, logLevel: "info" },
        },
        null,
        2,
      )}\n`,
      { mode: 0o600 },
    )
    log.info(`created ${configPath}`)
  }

  const envExample = join(xdg.configDir, ".env.example")
  if (!existsSync(envExample)) {
    writeFileSync(envExample, ENV_EXAMPLE, { mode: 0o600 })
    log.info(`created ${envExample}`)
  }

  log.info("done. Next steps:")
  log.info("  1. Copy and fill your .env:")
  log.info(`     cp ${envExample} ${join(xdg.configDir, ".env")}`)
  log.info("  2. Run: cw add <provider>")
  log.info("  3. Or run: cw install  (after editing .env)")
}
