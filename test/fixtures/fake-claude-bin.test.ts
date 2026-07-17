/**
 * Smoke test for the fake-claude-bin fixture.
 *
 * Ensures the fixture is buildable and behaves as documented:
 * - records argv + env to a JSON file
 * - exits with the code specified in CW_TEST_FAKE_CLAUDE_EXIT (default 0)
 */

import { describe, expect, it } from "bun:test"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "bun"

const REPO_ROOT = join(import.meta.dirname, "..", "..")
const BUILD_SCRIPT = join(REPO_ROOT, "test", "fixtures", "build-fake-bin.mjs")

describe("fake-claude-bin fixture", () => {
  const BUN = Bun.which("bun") ?? "bun"

  it("builds and records argv + env", () => {
    const tmp = mkdtempSync(join(tmpdir(), "cw-fake-"))
    const bin = join(tmp, "fake-claude.mjs")
    const record = join(tmp, "record.json")

    spawnSync({ cmd: [BUN, BUILD_SCRIPT, bin], stdout: "pipe", stderr: "pipe" })
    expect(() => readFileSync(bin)).not.toThrow()

    const result = spawnSync({
      cmd: [BUN, bin, "--print", "hello"],
      env: {
        ...process.env,
        CW_TEST_FAKE_CLAUDE_RECORD: record,
        CW_TEST_FAKE_CLAUDE_EXIT: "0",
      },
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(result.exitCode).toBe(0)

    const recorded = JSON.parse(readFileSync(record, "utf8"))
    expect(recorded.argv).toContain("--print")
    expect(recorded.argv).toContain("hello")
    expect(recorded.env.CW_TEST_FAKE_CLAUDE_RECORD).toBe(record)
    expect(recorded.exitCode).toBe(0)
  })

  it("honors CW_TEST_FAKE_CLAUDE_EXIT for non-zero exits", () => {
    const tmp = mkdtempSync(join(tmpdir(), "cw-fake-"))
    const bin = join(tmp, "fake-claude.mjs")
    const record = join(tmp, "record.json")

    spawnSync({ cmd: [BUN, BUILD_SCRIPT, bin], stdout: "pipe", stderr: "pipe" })

    const result = spawnSync({
      cmd: [BUN, bin],
      env: {
        ...process.env,
        CW_TEST_FAKE_CLAUDE_RECORD: record,
        CW_TEST_FAKE_CLAUDE_EXIT: "42",
      },
      stdout: "pipe",
      stderr: "pipe",
    })

    expect(result.exitCode).toBe(42)
  })
})
