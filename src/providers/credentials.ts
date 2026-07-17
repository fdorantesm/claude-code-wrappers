/**
 * Symlink .credentials.json from isolated HOME to real ~/.claude/.
 *
 * The real ~/.claude/.credentials.json holds the OAuth session — we want
 * every provider to share the same session, so symlink instead of copy.
 *
 * Also symlinks ~/.aws/ so the AWS CLI (and awsAuthRefresh) always uses
 * the real user's SSO token cache and config, even though HOME is
 * redirected to the isolated home.
 *
 * Also handles other forward-compat files: hooks/, agents/, commands/,
 * skills/, mcp_servers.json, CLAUDE.md, settings.local.json — anything
 * Claude Code introduces gets linked automatically by syncClaudeHome().
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync } from "node:fs"
import { dirname, join } from "node:path"

export interface LinkCredentialsOptions {
  /** Path to real user HOME (e.g., /Users/alice) */
  realHome: string
  /** Path to the isolated .claude/ directory (e.g., ~/.config/cw/homes/minimax/.claude) */
  isolatedClaudeDir: string
}

export function linkCredentials(opts: LinkCredentialsOptions): void {
  const realCredentials = join(opts.realHome, ".claude", ".credentials.json")
  const isolatedCredentials = join(opts.isolatedClaudeDir, ".credentials.json")

  if (!existsSync(realCredentials)) {
    throw new Error(`linkCredentials: real credentials not found at ${realCredentials}`)
  }
  if (!existsSync(opts.isolatedClaudeDir)) {
    throw new Error(`linkCredentials: isolated dir does not exist: ${opts.isolatedClaudeDir}`)
  }

  // Idempotent: if symlink exists, leave it.
  try {
    if (lstatSync(isolatedCredentials).isSymbolicLink()) return
  } catch {
    // doesn't exist
  }

  symlinkSync(realCredentials, isolatedCredentials)
}

/**
 * Symlink ~/.aws/ from isolated HOME to real home.
 *
 * AWS CLI (and Claude Code's awsAuthRefresh) resolve ~/.aws/ via HOME.
 * Since HOME points to the isolated dir, we need this symlink so the
 * AWS CLI finds the real SSO token cache and config.
 */
export function linkAwsHome(opts: { realHome: string; isolatedHome: string }): void {
  const realAws = join(opts.realHome, ".aws")
  const isolatedAws = join(opts.isolatedHome, ".aws")

  if (!existsSync(realAws)) return

  // Idempotent: if symlink already points to real home, skip.
  try {
    const stat = lstatSync(isolatedAws)
    if (stat.isSymbolicLink()) return
    // If it's a real dir (old install), remove it and replace with symlink
    if (stat.isDirectory()) {
      rmSync(isolatedAws, { recursive: true })
    }
  } catch {
    // doesn't exist, fine
  }

  symlinkSync(realAws, isolatedAws)
}
export function syncClaudeHome(opts: LinkCredentialsOptions): void {
  const realClaudeDir = join(opts.realHome, ".claude")
  if (!existsSync(realClaudeDir)) return
  if (!existsSync(opts.isolatedClaudeDir)) return

  const SKIP = new Set(["settings.json", ".credentials.json"])
  const entries = readdirSync(realClaudeDir, { withFileTypes: true })

  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue
    const realPath = join(realClaudeDir, entry.name)
    const linkPath = join(opts.isolatedClaudeDir, entry.name)

    try {
      if (lstatSync(linkPath).isSymbolicLink() || existsSync(linkPath)) continue
      // ensure parent dir (for entries like hooks/, agents/, skills/ which are dirs)
      mkdirSync(dirname(linkPath), { recursive: true })
      symlinkSync(realPath, linkPath)
    } catch {
      // best-effort
    }
  }
}
