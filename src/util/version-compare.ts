/**
 * Semver parsing and comparison.
 * Used by `cw upgrade` and `cw install --check`.
 */

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
}

const SIGN: Record<"neg" | "pos" | "zero", -1 | 0 | 1> = {
  neg: -1,
  zero: 0,
  pos: 1,
}

const sign = (n: number): -1 | 0 | 1 => SIGN[n > 0 ? "pos" : n < 0 ? "neg" : "zero"]

export function parseVersion(input: string): ParsedVersion {
  if (!input || typeof input !== "string") {
    throw new Error(`parseVersion: invalid input "${input}"`)
  }
  const cleaned = input.replace(/^v/, "").split("-")[0] ?? ""
  const parts = cleaned.split(".")
  if (parts.length === 0 || parts.some((p) => p === "" || Number.isNaN(Number(p)))) {
    throw new Error(`parseVersion: invalid version "${input}"`)
  }
  const nums = parts.map((p) => Number(p))
  return {
    major: nums[0] ?? 0,
    minor: nums[1] ?? 0,
    patch: nums[2] ?? 0,
  }
}

const FIELDS = ["major", "minor", "patch"] as const

export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  for (const field of FIELDS) {
    const diff = sign(va[field] - vb[field])
    if (diff !== 0) return diff
  }
  return 0
}

export function isNewer(a: string, b: string): boolean {
  return compareVersions(a, b) > 0
}
