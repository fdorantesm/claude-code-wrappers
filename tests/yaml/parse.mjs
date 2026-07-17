#!/usr/bin/env bun
/**
 * Tiny YAML validator used by tests/yaml/syntax.test.sh.
 *
 * Usage: bun run tests/yaml/parse.mjs <path-to-yaml-file>
 *
 * Exits 0 on success, 1 on parse error (with a descriptive message).
 * Kept as a tracked file (no mktemp / heredoc) so it works identically
 * across macOS, Linux, and Windows + Git Bash.
 */

import { readFileSync } from "node:fs"
import { parse } from "yaml"

const file = process.argv[2]
if (!file) {
  console.error("usage: parse.mjs <yaml-file>")
  process.exit(2)
}

try {
  parse(readFileSync(file, "utf8"))
} catch (e) {
  console.error(`YAML parse error in ${file}: ${e.message}`)
  process.exit(1)
}
