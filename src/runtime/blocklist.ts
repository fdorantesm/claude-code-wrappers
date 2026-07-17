/**
 * Env var filtering — blocklist approach (forward-compat).
 *
 * Default behavior: deny a known set of credential patterns, pass
 * everything else through. This means new Claude Code env vars flow
 * automatically without needing updates.
 *
 * Strict mode (allowlist): for high-security environments, the provider
 * can opt into whitelist-only by passing `allow:` to filterEnv().
 */

export const DEFAULT_BLOCKLIST: readonly string[] = [
  // Provider-specific credential namespaces
  "AWS_*",
  "ANTHROPIC_*",
  "BEDROCK_*",
  "OPENCODE_*",
  "OLLAMA_*",
  "GOOGLE_*",
  "VERTEX_*",
  "AZURE_*",
  "FOUNDRY_*",

  // Generic credential patterns
  "*_TOKEN",
  "*_KEY",
  "*_SECRET",
  "*_PASSWORD",
  "*_CREDENTIAL",
  "*_PASS",
]

const ALWAYS_PASS: readonly string[] = [
  "PATH",
  "HOME",
  "REAL_HOME",
  "USER",
  "SHELL",
  "TERM",
  "COLORTERM",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LC_MESSAGES",
  "LC_COLLATE",
  "TZ",
  "TMPDIR",
  "TMP",
  "TEMP",
  "SSH_AUTH_SOCK",
  "SSH_AGENT_PID",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "XDG_STATE_HOME",
  "XDG_BIN_HOME",
  "DISPLAY",
  "WAYLAND_DISPLAY",
  "EDITOR",
  "PAGER",
  "CLAUDE_CONFIG_DIR",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_PROJECT_DIR",
]

export interface FilterOptions {
  /** Additional keys to block (wildcards supported) */
  block?: readonly string[]
  /** Explicit allowlist — if set, only these keys pass */
  allow?: readonly string[]
}

function matchesPattern(name: string, pattern: string): boolean {
  if (name === pattern) return true
  if (!pattern.includes("*")) return false
  const re = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`)
  return re.test(name)
}

function shouldBlock(name: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => matchesPattern(name, p))
}

export function filterEnv(
  env: Record<string, string | undefined>,
  options: FilterOptions = {},
): Record<string, string> {
  const blockPatterns = [...DEFAULT_BLOCKLIST, ...(options.block ?? [])]
  const out: Record<string, string> = {}

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue

    // Explicit allowlist takes precedence over blocklist AND always-pass
    if (options.allow) {
      if (options.allow.includes(key) || ALWAYS_PASS.includes(key)) {
        out[key] = value
      }
      continue
    }

    // User-supplied block patterns override ALWAYS_PASS
    if (options.block?.includes(key)) continue

    // Default ALWAYS_PASS keys pass through
    if (ALWAYS_PASS.includes(key)) {
      out[key] = value
      continue
    }

    if (shouldBlock(key, blockPatterns)) continue

    out[key] = value
  }

  return out
}
