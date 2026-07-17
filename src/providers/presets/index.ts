/**
 * Builtin provider presets.
 * Each preset exports a `defineProvider({...})` that gets merged into the
 * registry at startup.
 */

import { z } from "zod"
import type { ProviderDef } from "../types.js"
import { defineProvider } from "../types.js"

export const anthropicPreset = defineProvider({
  id: "anthropic",
  label: "Anthropic API (direct)",
  group: "anthropic",
  credentialMode: "anthropic-token",
  settingsTemplate: "minimax/settings.template.json",
  envSchema: z.object({
    ANTHROPIC_API_KEY: z.string().min(1),
  }),
  realHome: true,
  notes: ["Default provider. Uses the official Anthropic API."],
})

export const minimaxPreset = defineProvider({
  id: "minimax",
  label: "MiniMax (Anthropic-compatible)",
  group: "anthropic-compatible",
  credentialMode: "anthropic-token",
  settingsTemplate: "minimax/settings.template.json",
  envSchema: z.object({
    MINIMAX_BASE_URL: z.string().url().default("https://api.minimax.chat/v1"),
    MINIMAX_TOKEN: z.string().min(1),
    MINIMAX_DEFAULT_MODEL: z.string().default("MiniMax-Text-01"),
    MINIMAX_OPUS_MODEL: z.string().default("MiniMax-Text-01"),
    MINIMAX_SONNET_MODEL: z.string().default("MiniMax-Text-01"),
    MINIMAX_HAIKU_MODEL: z.string().default("MiniMax-Text-01"),
  }),
  realHome: true,
})

const arnRegex = /^arn:aws:bedrock:[a-z0-9-]+:\d{12}:inference-profile\/.+/

export function extractModelName(arn: string): string {
  const idx = arn.lastIndexOf("/")
  return idx !== -1 ? arn.slice(idx + 1) : arn
}

export const bedrockPreset = defineProvider({
  id: "bedrock",
  label: "AWS Bedrock",
  group: "bedrock",
  credentialMode: "bedrock",
  settingsTemplate: "bedrock/settings.template.json",
  envSchema: z.object({
    AWS_PROFILE: z.string().min(1).default("default"),
    AWS_REGION: z.string().min(1).default("us-east-1"),
    BEDROCK_OPUS_MODEL_ARN: z
      .string()
      .regex(arnRegex, "must be a Bedrock inference profile ARN")
      .optional(),
    BEDROCK_SONNET_MODEL_ARN: z.string().regex(arnRegex),
    BEDROCK_HAIKU_MODEL_ARN: z.string().regex(arnRegex),
  }),
  realHome: true,
  notes: [
    "Uses AWS SSO/profile for auth. `cw add bedrock` will discover available inference profiles.",
    "Run `aws sso login --profile <name>` if access fails.",
  ],
})

export const vertexPreset = defineProvider({
  id: "vertex",
  label: "Google Vertex AI",
  group: "vertex",
  credentialMode: "vertex",
  settingsTemplate: "vertex/settings.template.json",
  envSchema: z.object({
    VERTEX_PROJECT_ID: z.string().min(1),
    VERTEX_REGION: z.string().default("us-east5"),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  }),
  realHome: true,
})

export const foundryPreset = defineProvider({
  id: "foundry",
  label: "Azure AI Foundry",
  group: "foundry",
  credentialMode: "foundry",
  settingsTemplate: "foundry/settings.template.json",
  envSchema: z.object({
    FOUNDRY_BASE_URL: z.string().url(),
    FOUNDRY_API_KEY: z.string().min(1),
  }),
  realHome: true,
})

export const opencodePreset = defineProvider({
  id: "opencode",
  label: "OpenCode Zen",
  group: "anthropic-compatible",
  credentialMode: "anthropic-token",
  settingsTemplate: "opencode/settings.template.json",
  envSchema: z.object({
    OPENCODE_BASE_URL: z.string().url().default("https://opencode.ai/zen/v1"),
    OPENCODE_TOKEN: z.string().min(1),
    OPENCODE_DEFAULT_MODEL: z.string().default("claude-sonnet-4-6"),
    OPENCODE_OPUS_MODEL: z.string().default("claude-opus-4-8"),
    OPENCODE_SONNET_MODEL: z.string().default("claude-sonnet-4-6"),
    OPENCODE_HAIKU_MODEL: z.string().default("claude-haiku-4-5"),
  }),
  realHome: true,
  safeMode: (env) => {
    const NON_ANTHROPIC_PREFIXES = [
      "minimax-",
      "glm-",
      "kimi-",
      "qwen-",
      "deepseek-",
      "gpt-",
      "gpt_",
    ]
    const models = [
      env.OPENCODE_DEFAULT_MODEL,
      env.OPENCODE_OPUS_MODEL,
      env.OPENCODE_SONNET_MODEL,
      env.OPENCODE_HAIKU_MODEL,
    ].filter((m): m is string => Boolean(m))
    if (models.length === 0) return false
    return models.some((m) => NON_ANTHROPIC_PREFIXES.some((p) => m.toLowerCase().startsWith(p)))
  },
})

export const openrouterPreset = defineProvider({
  id: "openrouter",
  label: "OpenRouter",
  group: "anthropic-compatible",
  credentialMode: "anthropic-token",
  settingsTemplate: "openrouter/settings.template.json",
  envSchema: z.object({
    OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
    OPENROUTER_API_KEY: z.string().min(1),
  }),
  realHome: true,
})

export const litellmPreset = defineProvider({
  id: "litellm",
  label: "LiteLLM (self-hosted)",
  group: "anthropic-compatible",
  credentialMode: "anthropic-token",
  settingsTemplate: "litellm/settings.template.json",
  envSchema: z.object({
    LITELLM_BASE_URL: z.string().url().default("http://localhost:4000"),
    LITELLM_API_KEY: z.string().default("sk-local"),
  }),
  realHome: true,
})

export const ollamaPreset = defineProvider({
  id: "ollama",
  label: "Ollama (local daemon)",
  group: "local-ollama",
  credentialMode: "ollama-native",
  settingsTemplate: "ollama/settings.template.json",
  envSchema: z.object({
    OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
    OLLAMA_AUTH_TOKEN: z.string().default("ollama-local"),
    OLLAMA_MODEL: z.string().default("gemma3:e2b-it-q4_K_M"),
    OLLAMA_OPUS_MODEL: z.string().default("gemma3:e2b-it-q4_K_M"),
    OLLAMA_SONNET_MODEL: z.string().default("gemma3:e2b-it-q4_K_M"),
    OLLAMA_HAIKU_MODEL: z.string().default("gemma3:1b-it-q4_K_M"),
    OLLAMA_SMALL_FAST_MODEL: z.string().default("gemma3:1b-it-q4_K_M"),
  }),
  realHome: true,
})

export const BUILTIN_PRESETS: ProviderDef[] = [
  anthropicPreset,
  minimaxPreset,
  bedrockPreset,
  vertexPreset,
  foundryPreset,
  opencodePreset,
  openrouterPreset,
  litellmPreset,
  ollamaPreset,
]
