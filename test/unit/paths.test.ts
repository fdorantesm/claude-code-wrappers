/**
 * Unit tests for src/xdg/paths.ts — XDG paths per OS.
 */

import { describe, expect, it } from "bun:test"
import { getPlatformPaths } from "../../src/xdg/paths.js"

describe("getPlatformPaths", () => {
  describe("on Unix (darwin/linux)", () => {
    // path.join produces platform-native separators; normalize to forward slashes
    // so the same assertions pass on Windows CI runners.
    const norm = (s: string) => s.replace(/\\/g, "/")

    it("uses XDG_CONFIG_HOME when set", () => {
      const p = getPlatformPaths({
        CW_TEST_PLATFORM: "linux",
        XDG_CONFIG_HOME: "/custom/config",
        HOME: "/home/u",
      })
      expect(norm(p.configDir)).toBe("/custom/config/claude-wrappers")
    })

    it("falls back to ~/.config when XDG_CONFIG_HOME is unset", () => {
      const p = getPlatformPaths({ CW_TEST_PLATFORM: "linux", HOME: "/home/u" })
      expect(norm(p.configDir)).toBe("/home/u/.config/claude-wrappers")
    })

    it("computes dataDir under XDG_DATA_HOME", () => {
      const p = getPlatformPaths({
        CW_TEST_PLATFORM: "linux",
        XDG_DATA_HOME: "/custom/data",
        HOME: "/home/u",
      })
      expect(norm(p.dataDir)).toBe("/custom/data/claude-wrappers")
    })

    it("computes stateDir under XDG_STATE_HOME", () => {
      const p = getPlatformPaths({
        CW_TEST_PLATFORM: "linux",
        XDG_STATE_HOME: "/custom/state",
        HOME: "/home/u",
      })
      expect(norm(p.stateDir)).toBe("/custom/state/claude-wrappers")
    })

    it("uses ~/.local/bin as default binDir", () => {
      const p = getPlatformPaths({ CW_TEST_PLATFORM: "linux", HOME: "/home/u" })
      expect(norm(p.binDir)).toBe("/home/u/.local/bin")
    })

    it("CLAUDE_WRAPPERS_BIN_DIR overrides binDir", () => {
      const p = getPlatformPaths({
        CW_TEST_PLATFORM: "linux",
        HOME: "/home/u",
        CLAUDE_WRAPPERS_BIN_DIR: "/opt/cw-bin",
      })
      expect(norm(p.binDir)).toBe("/opt/cw-bin")
    })

    it("uses HOME for realClaudeConfigDir", () => {
      const p = getPlatformPaths({ CW_TEST_PLATFORM: "linux", HOME: "/home/u" })
      expect(norm(p.realClaudeConfigDir)).toBe("/home/u/.claude")
      expect(norm(p.realHome)).toBe("/home/u")
    })
  })

  describe("on Windows", () => {
    it("uses APPDATA for configDir", () => {
      const p = getPlatformPaths({
        CW_TEST_PLATFORM: "win32",
        APPDATA: "C:\\Users\\test\\AppData\\Roaming",
        LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
        USERPROFILE: "C:\\Users\\test",
      })
      expect(p.configDir.replace(/\//g, "\\")).toBe(
        "C:\\Users\\test\\AppData\\Roaming\\claude-wrappers",
      )
    })

    it("uses LOCALAPPDATA for dataDir", () => {
      const p = getPlatformPaths({
        CW_TEST_PLATFORM: "win32",
        APPDATA: "C:\\Users\\test\\AppData\\Roaming",
        LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
        USERPROFILE: "C:\\Users\\test",
      })
      expect(p.dataDir.replace(/\//g, "\\")).toBe(
        "C:\\Users\\test\\AppData\\Local\\claude-wrappers",
      )
    })

    it("uses %USERPROFILE%/.claude for realClaudeConfigDir", () => {
      const p = getPlatformPaths({
        CW_TEST_PLATFORM: "win32",
        APPDATA: "C:\\Users\\test\\AppData\\Roaming",
        LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
        USERPROFILE: "C:\\Users\\test",
      })
      // Use path.win32.join semantics for the expectation, then compare with
      // forward-slashes since the host CI is Linux/macOS.
      expect(p.realClaudeConfigDir.replace(/\//g, "\\")).toBe("C:\\Users\\test\\.claude")
      expect(p.realHome).toBe("C:\\Users\\test")
    })
  })
})
