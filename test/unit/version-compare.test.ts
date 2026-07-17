/**
 * Unit tests for src/util/version-compare.ts — semver comparison.
 *
 * Used by `cw upgrade` and `cw install --check` to determine if a new
 * version is available.
 */

import { describe, expect, it } from "bun:test"
import { compareVersions, isNewer, parseVersion } from "../../src/util/version-compare.js"

describe("parseVersion", () => {
  it("parses a 3-part semver", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 })
  })

  it("strips a leading v", () => {
    expect(parseVersion("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 })
  })

  it("parses 2-part as patch=0", () => {
    expect(parseVersion("v1.2")).toEqual({ major: 1, minor: 2, patch: 0 })
  })

  it("parses 1-part as minor=0, patch=0", () => {
    expect(parseVersion("3")).toEqual({ major: 3, minor: 0, patch: 0 })
  })

  it("ignores pre-release suffix", () => {
    expect(parseVersion("1.2.3-beta.1")).toEqual({ major: 1, minor: 2, patch: 3 })
  })

  it("throws on invalid input", () => {
    expect(() => parseVersion("not.a.version")).toThrow()
    expect(() => parseVersion("")).toThrow()
  })
})

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0)
  })

  it("returns -1 when a < b", () => {
    expect(compareVersions("1.2.3", "1.2.4")).toBe(-1)
    expect(compareVersions("1.2.3", "1.3.0")).toBe(-1)
    expect(compareVersions("1.2.3", "2.0.0")).toBe(-1)
  })

  it("returns 1 when a > b", () => {
    expect(compareVersions("1.2.4", "1.2.3")).toBe(1)
    expect(compareVersions("2.0.0", "1.99.99")).toBe(1)
  })

  it("ignores pre-release tags for ordering", () => {
    expect(compareVersions("1.2.3-beta", "1.2.3")).toBe(0)
    expect(compareVersions("1.2.3", "1.2.4-alpha")).toBe(-1)
  })

  it("handles v-prefix consistently", () => {
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0)
    expect(compareVersions("v2.0.0", "v1.99.99")).toBe(1)
  })
})

describe("isNewer", () => {
  it("true when a is newer", () => {
    expect(isNewer("1.2.4", "1.2.3")).toBe(true)
    expect(isNewer("2.0.0", "1.99.99")).toBe(true)
  })

  it("false when a is older or equal", () => {
    expect(isNewer("1.2.3", "1.2.3")).toBe(false)
    expect(isNewer("1.2.3", "1.2.4")).toBe(false)
  })
})
