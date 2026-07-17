/**
 * Log redaction for secrets.
 *
 * Used everywhere cw prints to stderr/stdout to avoid accidental
 * credential leaks in terminal scrollback or piped logs.
 */

const SECRET_PATTERN = /(TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL)/i
const BEARER_PATTERN = /Bearer\s+([A-Za-z0-9._\-+/=]+)/g
const KV_PATTERN = /\b([A-Z][A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD))\s*=\s*("?)([^\s"]+)\2/g

export function isSecretKey(key: string): boolean {
  return SECRET_PATTERN.test(key)
}

export function redactValue(key: string, value: string): string {
  if (value === "") return ""
  if (isSecretKey(key)) return `<redacted len=${value.length}>`
  return value
}

export function redactString(input: string): string {
  const out = input
    // bearer tokens in Authorization headers
    .replace(BEARER_PATTERN, (_m, tok) => `Bearer <redacted len=${tok.length}>`)
    // KEY=VALUE pairs (env-style)
    .replace(KV_PATTERN, (_m, key, _q, value) => `${key}=<redacted len=${value.length}>`)
    // JSON-like: "key": "value" where key looks secret (preserve original spacing)
    .replace(
      /("(?:token|key|secret|password|apiKey|api_key)")(\s*:\s*)"([^"]+)"/gi,
      (_m, k, sep, v) => `${k}${sep}"<redacted len=${v.length}>"`,
    )
  return out
}
