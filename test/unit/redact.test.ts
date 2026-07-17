/**
 * Unit tests for src/security/redact.ts — log redaction.
 */

import { describe, expect, it } from "bun:test"
import { isSecretKey, redactString, redactValue } from "../../src/security/redact.js"

describe("isSecretKey", () => {
  it("flags keys containing TOKEN", () => {
    expect(isSecretKey("ANTHROPIC_AUTH_TOKEN")).toBe(true)
    expect(isSecretKey("MINIMAX_TOKEN")).toBe(true)
    expect(isSecretKey("GITHUB_TOKEN")).toBe(true)
  })

  it("flags keys containing KEY", () => {
    expect(isSecretKey("AWS_ACCESS_KEY_ID")).toBe(true)
    expect(isSecretKey("API_KEY")).toBe(true)
  })

  it("flags keys containing SECRET", () => {
    expect(isSecretKey("CLIENT_SECRET")).toBe(true)
  })

  it("flags keys containing PASSWORD", () => {
    expect(isSecretKey("DB_PASSWORD")).toBe(true)
  })

  it("does not flag safe keys", () => {
    expect(isSecretKey("PATH")).toBe(false)
    expect(isSecretKey("HOME")).toBe(false)
    expect(isSecretKey("USER")).toBe(false)
    expect(isSecretKey("ANTHROPIC_BASE_URL")).toBe(false)
    expect(isSecretKey("ANTHROPIC_MODEL")).toBe(false)
  })
})

describe("redactValue", () => {
  it("redacts values for secret keys", () => {
    expect(redactValue("TOKEN", "sk-fake-12345")).toBe("<redacted len=13>")
  })

  it("returns the value for non-secret keys", () => {
    expect(redactValue("HOME", "/home/user")).toBe("/home/user")
  })

  it("handles empty values", () => {
    expect(redactValue("TOKEN", "")).toBe("")
  })

  it("handles short values", () => {
    expect(redactValue("KEY", "ab")).toBe("<redacted len=2>")
  })
})

describe("redactString", () => {
  it("redacts key=value pairs in free-form strings", () => {
    const input =
      "Starting: ANTHROPIC_AUTH_TOKEN=sk-fake-12345 ANTHROPIC_BASE_URL=https://api.anthropic.com"
    const out = redactString(input)
    expect(out).toContain("ANTHROPIC_AUTH_TOKEN=<redacted")
    expect(out).toContain("ANTHROPIC_BASE_URL=https://api.anthropic.com")
  })

  it("handles bearer tokens in URLs", () => {
    const input = "Authorization: Bearer sk-fake-12345"
    const out = redactString(input)
    expect(out).toContain("Bearer <redacted")
  })

  it("handles JSON strings", () => {
    const input = '{"token": "sk-fake-12345", "url": "https://x.com"}'
    const out = redactString(input)
    expect(out).toContain('"token": "<redacted')
    expect(out).toContain('"url": "https://x.com"')
  })

  it("leaves strings without secrets unchanged", () => {
    const input = "User clicked at 12:34:56"
    expect(redactString(input)).toBe(input)
  })
})
