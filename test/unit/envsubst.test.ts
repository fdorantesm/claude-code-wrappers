/**
 * Unit tests for src/providers/envsubst.ts — the pure ${VAR} / ${VAR:-default} expander.
 *
 * Replaces shell `envsubst` for portability and testability.
 */

import { describe, expect, it } from "bun:test"
import { expand } from "../../src/providers/envsubst.js"

describe("envsubst.expand", () => {
  describe("simple ${VAR}", () => {
    it("replaces a single variable", () => {
      expect(expand("${FOO}", { FOO: "bar" })).toBe("bar")
    })

    it("replaces multiple variables in the same string", () => {
      expect(expand("${A}-${B}", { A: "x", B: "y" })).toBe("x-y")
    })

    it("returns the original token when the variable is missing", () => {
      // Strict mode default — no default, no value
      expect(expand("${MISSING}", {})).toBe("${MISSING}")
    })

    it("treats empty values as set", () => {
      expect(expand("[${FOO}]", { FOO: "" })).toBe("[]")
    })

    it("supports underscores and digits in var names", () => {
      expect(expand("${AWS_REGION_2}", { AWS_REGION_2: "us-east-1" })).toBe("us-east-1")
      expect(expand("${_INTERNAL}", { _INTERNAL: "v" })).toBe("v")
    })
  })

  describe("default values ${VAR:-default}", () => {
    it("uses the default when the variable is missing", () => {
      expect(expand("${FOO:-bar}", {})).toBe("bar")
    })

    it("uses the actual value when set, ignoring default", () => {
      expect(expand("${FOO:-bar}", { FOO: "real" })).toBe("real")
    })

    it("uses the default when value is empty string", () => {
      // POSIX semantics: :- applies to missing AND empty
      expect(expand("${FOO:-bar}", { FOO: "" })).toBe("bar")
    })

    it("supports nested defaults with literal text", () => {
      expect(expand("prefix-${MISSING:-fallback}-suffix", {})).toBe("prefix-fallback-suffix")
    })

    it("supports escaped braces in defaults", () => {
      expect(expand("${FOO:-a{b}c}", {})).toBe("a{b}c")
    })
  })

  describe("alternative ${VAR-default} (only missing, not empty)", () => {
    it("uses default when missing", () => {
      expect(expand("${FOO-default}", {})).toBe("default")
    })

    it("uses empty value when set to empty string", () => {
      expect(expand("${FOO-default}", { FOO: "" })).toBe("")
    })
  })

  describe("escaping", () => {
    it("leaves lone braces untouched", () => {
      expect(expand("hello { world }", {})).toBe("hello { world }")
    })

    it("does not interpret $$ as a variable", () => {
      expect(expand("$$", {})).toBe("$$")
    })
  })

  describe("JSON-safe values", () => {
    it("preserves special characters in substituted values", () => {
      expect(expand('{"url": "${URL}"}', { URL: "https://example.com/path?x=1&y=2" })).toBe(
        '{"url": "https://example.com/path?x=1&y=2"}',
      )
    })

    it("handles JSON template with multiple slots", () => {
      const template = JSON.stringify({
        ANTHROPIC_BASE_URL: "${BASE_URL}",
        ANTHROPIC_AUTH_TOKEN: "${TOKEN}",
      })
      const out = expand(template, {
        BASE_URL: "https://api.example.com",
        TOKEN: "sk-fake-1234",
      })
      expect(JSON.parse(out)).toEqual({
        ANTHROPIC_BASE_URL: "https://api.example.com",
        ANTHROPIC_AUTH_TOKEN: "sk-fake-1234",
      })
    })
  })

  describe("performance", () => {
    it("handles a 10KB template in <50ms", () => {
      const big = Array.from({ length: 100 }, (_, i) => `line ${i}: ${`\${VAR_${i}}`}`).join("\n")
      const vars: Record<string, string> = {}
      for (let i = 0; i < 100; i++) vars[`VAR_${i}`] = `value_${i}`

      const start = performance.now()
      const result = expand(big, vars)
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(50)
      expect(result.split("\n")).toHaveLength(100)
    })
  })
})
