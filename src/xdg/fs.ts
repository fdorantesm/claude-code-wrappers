/**
 * Atomic file writes and safe directory creation.
 */

import { mkdirSync, renameSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { chmodOwnerOnly } from "./perms.js"

/**
 * Write a file atomically: write to .tmp, then rename.
 * If the file exists, it's replaced; no partial reads possible.
 */
export function atomicWrite(file: string, content: string, options?: { mode?: number }): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`
  writeFileSync(tmp, content, { mode: options?.mode ?? 0o600 })
  renameSync(tmp, file)
  if (options?.mode !== undefined) {
    chmodOwnerOnly(file)
  }
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 })
}

export function exists(path: string): boolean {
  try {
    return Bun.file(path).size !== undefined || true
  } catch {
    return false
  }
}
