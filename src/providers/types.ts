/**
 * Provider declaration API.
 *
 * `defineProvider` is an identity function whose only purpose is to provide
 * TypeScript type inference. It validates the shape at compile time.
 */

import type { ZodType, ZodTypeDef } from "zod"
import type { XdgPaths } from "../xdg/paths.js"

export type CredentialMode =
  | "anthropic-token"
  | "ollama-native"
  | "bedrock"
  | "vertex"
  | "foundry"
  | "openai-translated"
  | "custom"

export interface CredentialSource {
  type: "env" | "keyring" | "exec" | "prompt"
  /** Keychain service name (when type=keyring) */
  service?: string
  /** Keychain account name (when type=keyring) */
  account?: string
  /** External command (when type=exec) */
  command?: string[]
  /** Prompt message (when type=prompt) */
  message?: string
}

export interface HookContext<E = unknown> {
  provider: ProviderDef
  parsedEnv: E
  /** Mutable bag the hook can populate; subsequent hooks see it */
  envDelta: Record<string, string>
  /** Isolated HOME for this run */
  home: string
  /** Real HOME (only populated if provider.realHome) */
  realHome?: string
  log: Logger
}

export interface Logger {
  info: (msg: string) => void
  warn: (msg: string) => void
  error: (msg: string) => void
  debug: (msg: string) => void
}

export interface HookSpec {
  preExec?: (ctx: HookContext) => Promise<void> | void
  postExec?: (ctx: HookContext & { code: number | null }) => Promise<void> | void
}

export interface CheckResult {
  ok: boolean
  message?: string
}

export type CheckFn = (ctx: HookContext) => Promise<CheckResult> | CheckResult

export interface ProviderDef<
  E extends ZodType<unknown, ZodTypeDef, unknown> = ZodType<unknown, ZodTypeDef, unknown>,
> {
  /** Stable id, kebab-case. Used for symlinks and home dirs. */
  id: string
  label: string
  group?: string

  /** How the provider authenticates with Claude Code */
  credentialMode?: CredentialMode

  /** Zod schema for the .env vars of this provider */
  envSchema: E

  /** Vars in addition to the global allowlist (e.g., AWS_PROFILE for Bedrock) */
  extraEnv?: (parsed: unknown) => Record<string, string>

  /** If true (default), exports HOME=isolated and REAL_HOME=real */
  realHome?: boolean

  /** Path to presets/<id>/settings.template.json (relative to cwd at runtime) */
  settingsTemplate: string

  hooks?: HookSpec
  checks?: CheckFn[]

  /** Per-credential source declarations */
  credentials?: Record<string, CredentialSource>

  /** Override the claude binary path */
  claudeBin?: string

  /** If set, auto-inject --safe-mode --tools "" when true */
  safeMode?: boolean | ((env: Record<string, string>) => boolean)

  /** Notes shown in `cw doctor` */
  notes?: string[]
}

export function defineProvider<E extends ZodType<unknown, ZodTypeDef, unknown>>(
  p: ProviderDef<E>,
): ProviderDef<E> {
  // Identity fn — pure type-inference helper.
  return p
}

export type ResolvedProvider = ProviderDef & {
  homeDir: (xdg: XdgPaths) => string
}
