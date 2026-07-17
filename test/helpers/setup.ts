/**
 * Bun test global preload — runs once before any test file.
 *
 * Responsibilities:
 * - Force CW_TEST_* env vars so paths are isolated from the real HOME.
 * - Build the fake-claude-bin fixture used by spawn/isolation tests.
 *
 * Configured via bunfig.toml → [test] preload.
 */

import { execSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const testRoot = mkdtempSync(join(tmpdir(), "cw-test-"))
process.env.CW_TEST_ROOT = testRoot
process.env.CW_TEST_XDG_CONFIG_HOME = join(testRoot, "config")
process.env.CW_TEST_XDG_DATA_HOME = join(testRoot, "data")
process.env.CW_TEST_XDG_STATE_HOME = join(testRoot, "state")
process.env.CW_TEST_REAL_HOME = join(testRoot, "real-home")

// Build fake-claude-bin once and point to it
const fakeBin = join(testRoot, "fake-claude-bin.mjs")
const buildScript = join(import.meta.dirname, "..", "fixtures", "build-fake-bin.mjs")
execSync(`bun ${buildScript} ${fakeBin}`)
process.env.CW_TEST_FAKE_CLAUDE_BIN = fakeBin

console.log(`[bun test setup] test root: ${testRoot}`)
