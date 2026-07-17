/**
 * `cw add <provider>` — interactive setup for a provider.
 *
 * Detects whether the provider is already configured; if so, delegates
 * to `cw config <provider>`. Otherwise, prompts for required env vars,
 * writes them to ~/.config/claude-wrappers/env/<id>.env, and runs `cw install`.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CwConfigSchema } from "../../config/schema.js"
import { getPlatformPaths } from "../../xdg/paths.js"
import { log } from "../logger.js"
import { bootstrapRegistry } from "../registry-bootstrap.js"
import { installCommand } from "./install.js"

// Human-friendly descriptions for known env vars
const VAR_DESCRIPTIONS: Record<string, string> = {
  AWS_PROFILE: "AWS CLI profile name (from ~/.aws/credentials)",
  AWS_REGION: "AWS region for Bedrock",
  BEDROCK_OPUS_MODEL_ARN: "ARN for Opus model (optional, falls back to Sonnet)",
  BEDROCK_SONNET_MODEL_ARN: "ARN for Sonnet model",
  BEDROCK_HAIKU_MODEL_ARN: "ARN for Haiku model",
  MINIMAX_BASE_URL: "MiniMax API endpoint",
  MINIMAX_TOKEN: "MiniMax API token",
  MINIMAX_DEFAULT_MODEL: "Default model name",
  OLLAMA_BASE_URL: "Ollama server URL",
  OLLAMA_MODEL: "Default Ollama model",
  ANTHROPIC_BASE_URL: "Anthropic-compatible API endpoint",
  ANTHROPIC_AUTH_TOKEN: "API authentication token",
  ANTHROPIC_API_KEY: "Anthropic API key",
  OPENCODE_BASE_URL: "OpenCode API endpoint",
  OPENCODE_TOKEN: "OpenCode API token",
  OPENROUTER_BASE_URL: "OpenRouter API endpoint",
  OPENROUTER_API_KEY: "OpenRouter API key",
  LITELLM_BASE_URL: "LiteLLM server URL",
  LITELLM_API_KEY: "LiteLLM API key",
  VERTEX_PROJECT_ID: "Google Cloud project ID",
  VERTEX_REGION: "Vertex AI region",
  FOUNDRY_BASE_URL: "Azure AI Foundry endpoint",
  FOUNDRY_API_KEY: "Azure AI Foundry API key",
}

// Simple question function using node:readline (dynamic import to avoid blocking stdin at startup)
async function ask(prompt: string): Promise<string> {
  const { createInterface } = await import("node:readline")
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(prompt, (answer: string) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export async function addCommand(
  providerId: string,
  opts: { nonInteractive?: boolean; as?: string },
): Promise<void> {
  const xdg = getPlatformPaths()
  const providers = await bootstrapRegistry(xdg)
  const provider = providers.find((p) => p.id === providerId)
  if (!provider) {
    log.error(`provider "${providerId}" not found`)
    log.info(`available: ${providers.map((p) => p.id).join(", ")}`)
    log.info(`to add a custom provider, drop a .js file in ${join(xdg.configDir, "providers")}/`)
    process.exit(78)
  }

  const instanceId = opts.as ?? providerId
  if (opts.as && opts.as !== providerId) {
    log.info(`cloning ${provider.label} as "${opts.as}"`)
    saveClone(xdg, opts.as, providerId)
  }

  const envFile = join(xdg.configDir, "env", `${instanceId}.env`)
  const settingsPath = join(xdg.configDir, "homes", instanceId, ".claude", "settings.json")

  if (existsSync(envFile) && existsSync(settingsPath)) {
    log.info(`${instanceId} is already configured.`)
    log.info(`  → run \`cw config ${instanceId}\` to edit`)
    log.info(`  → run \`cw reset ${instanceId}\` to regenerate settings.json`)
    return
  }

  if (opts.nonInteractive) {
    log.error(`non-interactive mode: ${instanceId} not configured`)
    log.error(`create ${envFile} with required vars (see ${provider.label})`)
    process.exit(78)
  }

  log.info(`Configuring ${provider.label} (${instanceId})`)
  log.info("")

  // Extract keys from the schema's shape
  const shape = (
    provider.envSchema as unknown as {
      _def: {
        shape: () => Record<
          string,
          {
            _def: {
              typeName: string
              defaultValue?: () => unknown
              innerType?: { _def: { typeName: string } }
            }
          }
        >
      }
    }
  )._def.shape()

  const answers: Record<string, string> = {}

  for (const [key, def] of Object.entries(shape)) {
    const hasDefault = Boolean(def._def.defaultValue)
    const isOptional = def._def.typeName === "ZodOptional"
    const defaultVal = hasDefault ? String(def._def.defaultValue?.()) : undefined

    const desc = VAR_DESCRIPTIONS[key] ?? key
    let suffix = ""
    if (isOptional && defaultVal) suffix = ` [default: ${defaultVal}]`
    else if (isOptional) suffix = " (optional)"

    const answer = await ask(`  ${desc}${suffix}: `)
    if (answer) {
      answers[key] = answer
    } else if (defaultVal) {
      answers[key] = defaultVal
    } else if (!isOptional && !hasDefault) {
      log.error(`  ${key} is required`)
      process.exit(78)
    }
  }

  // Write env file
  log.info("")
  const lines = Object.entries(answers).map(([k, v]) => `${k}=${v}`)
  writeFileSync(envFile, `${lines.join("\n")}\n`, { mode: 0o600 })
  log.info(`wrote ${envFile}`)

  // Run install
  log.info("running cw install...")
  await installCommand({ provider: instanceId })

  log.info("")
  log.info(`✓ ${instanceId} is ready`)
  log.info(`  run: cw run ${instanceId} --print "hello"`)
}

function saveClone(
  xdg: ReturnType<typeof getPlatformPaths>,
  cloneId: string,
  extendsId: string,
): void {
  const configPath = join(xdg.configDir, "cw.json")
  let config: Record<string, unknown> = {}
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf8"))
    } catch {}
  }
  const parsed = CwConfigSchema.safeParse(config)
  if (parsed.success) {
    config = parsed.data as Record<string, unknown>
  }
  if (!config.clones || typeof config.clones !== "object") {
    config.clones = {}
  }
  ;(config.clones as Record<string, unknown>)[cloneId] = { extends: extendsId }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  log.info(`  saved clone to ${configPath}`)
}
