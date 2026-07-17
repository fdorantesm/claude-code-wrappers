/**
 * Pure ${VAR} and ${VAR:-default} expander.
 *
 * Replaces shell `envsubst` with a portable implementation.
 * Used to render presets/<id>/settings.template.json into the actual
 * settings.json for each isolated HOME.
 *
 * POSIX semantics:
 *   ${VAR}              → value of VAR, or literal "${VAR}" if unset
 *   ${VAR:-default}     → default if VAR is unset OR empty
 *   ${VAR-default}      → default only if VAR is unset (empty allowed)
 *
 * Nested braces in defaults are supported (e.g., `${FOO:-a{b}c}` → "a{b}c").
 */

const VAR_NAME = "[A-Za-z_][A-Za-z0-9_]*"

export function expand(input: string, vars: Record<string, string | undefined>): string {
  let out = input
  // Run multiple passes to handle nested variable references in defaults
  // (e.g., ${OUTER:-inner ${INNER} text} → "inner value text")
  for (let pass = 0; pass < 5; pass++) {
    const next = expandOnce(out, vars)
    if (next === out) break
    out = next
  }
  return out
}

function expandOnce(input: string, vars: Record<string, string | undefined>): string {
  let out = ""
  let i = 0

  while (i < input.length) {
    const ch = input[i]

    if (ch !== "$" || input[i + 1] !== "{") {
      out += ch ?? ""
      i++
      continue
    }

    // Find the matching close brace (track depth to allow nested braces).
    let depth = 1
    let j = i + 2
    while (j < input.length && depth > 0) {
      const c = input[j]
      if (c === "{") depth++
      else if (c === "}") depth--
      if (depth === 0) break
      j++
    }

    if (depth !== 0) {
      // Unbalanced — emit literally.
      out += input.slice(i, i + 1)
      i++
      continue
    }

    const original = input.slice(i, j + 1)
    const inside = input.slice(i + 2, j)
    out += resolveVarRef(inside, vars, original)
    i = j + 1
  }

  return out
}

function resolveVarRef(
  inside: string,
  vars: Record<string, string | undefined>,
  original: string,
): string {
  const re = new RegExp(`^(${VAR_NAME})(?:(:?-)(.*))?$`)
  const m = re.exec(inside)
  if (!m) return original

  const name = m[1] ?? ""
  const op = m[2]
  const def = m[3] ?? ""
  const value = vars[name]

  if (op === ":-") return value !== undefined && value !== "" ? value : def
  if (op === "-") return value !== undefined ? value : def
  return value !== undefined ? value : original
}
