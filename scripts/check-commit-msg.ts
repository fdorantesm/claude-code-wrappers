#!/usr/bin/env bun
/**
 * commit-msg validator for the release workflow.
 *
 * Enforces that every commit message includes a version-bump directive:
 *   `#major` → major bump
 *   `#minor` → minor bump
 *   (none)   → patch bump (default)
 *
 * Additionally, conventional-commits prefixes are recommended but not required
 * (feat:, fix:, refactor:, docs:, test:, chore:, etc.).
 *
 * The release.yml workflow reads `git log -1 --pretty=%B` to decide the bump.
 */

import { readFileSync } from "node:fs"
import { exit } from "node:process"

const msgPath = process.argv[2]
if (!msgPath) {
  console.error("usage: check-commit-msg.ts <commit-msg-file>")
  exit(2)
}

const msg = readFileSync(msgPath, "utf8").trim()

// Allow merge commits and reverts to skip validation
if (/^Merge\b/.test(msg) || /^Revert\b/.test(msg)) exit(0)

// Conventional Commits prefix is recommended
const CC_PATTERN = /^(feat|fix|refactor|docs|test|chore|perf|build|ci|style)(\([a-z0-9_-]+\))?!?: /
if (!CC_PATTERN.test(msg)) {
  console.warn("[commit-msg] recommended: use Conventional Commits prefix (feat:, fix:, etc.)")
  console.warn(`              got: "${msg.split("\n")[0]}"`)
}

// Version bump directive (#major, #minor) is OPTIONAL — patch is the default.
// We only WARN if the body mentions "BREAKING" without an explicit #major.
if (/BREAKING/i.test(msg) && !/#major\b/.test(msg)) {
  console.error(`[commit-msg] commit mentions "BREAKING" but no "#major" directive.`)
  console.error(`             append "#major" to the body to trigger a major bump:`)
  console.error("")
  console.error(`             ${msg}`)
  console.error("")
  console.error("             #major")
  exit(1)
}

exit(0)
