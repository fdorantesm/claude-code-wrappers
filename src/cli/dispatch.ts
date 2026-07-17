/**
 * Detects provider from symlink name and rewrites argv.
 *
 * When invoked via `claude-<provider>` symlink, process.argv[1] is the
 * symlink path. We rewrite argv to inject `run <provider>` as the
 * subcommand so commander picks it up correctly.
 *
 * Caveat: in the `bun build --compile` binary, argv[1] is rewritten to an
 * internal `/$bunfs/...` path and no longer reflects the invoking symlink
 * name. process.argv0 *does* still hold the symlink path in that case, so
 * detectProviderFromArgv checks that as a fallback.
 */

import { basename } from "node:path"

const KNOWN_COMMANDS = new Set([
  "install",
  "run",
  "list",
  "ls",
  "doctor",
  "env",
  "add",
  "config",
  "reset",
  "show",
  "remove",
  "rm",
  "sync",
  "init",
  "migrate",
  "uninstall",
  "secret",
  "audit",
  "help",
  "--help",
  "-h",
  "--version",
  "-v",
])

export function detectProviderFromArgv(
  argv: readonly string[],
  argv0 = process.argv0,
): string | null {
  const invokedAs = basename(argv[1] ?? "")
  const invokedAs0 = basename(argv0 ?? "")
  const name = invokedAs.startsWith("claude-") ? invokedAs : invokedAs0
  if (!name.startsWith("claude-")) return null
  const candidate = name.slice("claude-".length)
  if (!candidate || KNOWN_COMMANDS.has(candidate)) return null
  // Only dispatch if user didn't already pass a known subcommand
  if (argv[2] && KNOWN_COMMANDS.has(argv[2])) return null
  return candidate
}

export function rewriteArgv(argv: readonly string[], provider: string): string[] {
  // argv[0] = node, argv[1] = symlink path, argv[2..] = user args
  return [argv[0] ?? "node", argv[1] ?? "cw", "run", provider, ...argv.slice(2)]
}
