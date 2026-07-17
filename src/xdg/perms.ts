/**
 * chmod 0600 (Unix) / icacls (Windows) — owner-only file permissions.
 */

import { execSync } from "node:child_process"
import { chmodSync, statSync } from "node:fs"
import { userInfo } from "node:os"
import { isWindows } from "../util/os.js"

export function chmodOwnerOnly(file: string): void {
  if (isWindows()) {
    try {
      const username = process.env.USERNAME ?? userInfo().username
      // Match Unix `chmod 0600`: the owner can read/write/delete, no one else.
      // Revoke inheritance so no other ACE flows in, then grant the owner
      // Full Control. Granting only R would block the owner from deleting
      // their own file (e.g., cleanup of the secret file by the app).
      execSync(`icacls "${file}" /inheritance:r /grant:r "${username}:F"`, {
        stdio: "ignore",
        timeout: 5_000,
      })
    } catch {
      // Best-effort; on Windows ACLs depend on NTFS, and icacls may be
      // unavailable or hang in some sandboxed environments.
    }
    return
  }

  chmodSync(file, 0o600)
}

export function isOwnerOnly(file: string): boolean {
  const mode = statSync(file).mode & 0o777
  // Owner-only = no group/other bits
  return (mode & 0o077) === 0
}
