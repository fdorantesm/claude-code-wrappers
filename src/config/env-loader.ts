/**
 * Minimal .env file parser — no dotenv dep.
 *
 * We avoid dotenv because we want explicit precedence rules
 * (shell > user file > project file), and dotenv mutates process.env
 * which breaks that.
 *
 * Supported syntax:
 *   KEY=value
 *   KEY="value with spaces # not a comment"
 *   KEY='single quoted'
 *   export KEY=value
 *   # comments (line start)
 *   KEY=value  # inline comments (only on unquoted values, after a space)
 */

export class InvalidEnvLineError extends Error {
  constructor(
    public line: string,
    public lineNumber: number,
  ) {
    super(`Invalid .env line ${lineNumber}: "${line}"`)
  }
}

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*\s*=/

function parseValue(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      // Quoted: preserve everything inside, no inline-comment stripping
      return trimmed.slice(1, -1)
    }
  }
  // Unquoted: strip inline ` # ...` comments
  const hashIdx = trimmed.indexOf(" #")
  return (hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx)).trim()
}

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines = normalized.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? ""
    const line = raw.trim()
    if (line === "" || line.startsWith("#")) continue

    // Strip optional `export ` prefix
    const stripped = line.replace(/^export\s+/, "")
    const m = KEY_PATTERN.exec(stripped)
    if (!m) throw new InvalidEnvLineError(line, i + 1)

    const key = stripped.slice(0, m[0].length - 1).trim() // remove trailing `=`
    const rawValue = stripped.slice(m[0].length).trim()
    out[key] = parseValue(rawValue)
  }

  return out
}

/**
 * Merge multiple env layers with first-wins precedence.
 * The first layer has the highest priority.
 */
export function loadEnvLayered(...layers: Array<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      if (!(k in out)) out[k] = v
    }
  }
  return out
}
