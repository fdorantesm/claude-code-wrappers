/**
 * Platform detection helpers.
 */

import { arch, platform } from "node:process"

export type Platform = "darwin" | "linux" | "windows" | "unknown"
export type Arch = "x64" | "arm64" | "x86" | "unknown"

const PLATFORM_MAP: Partial<Record<NodeJS.Platform, Platform>> = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows",
}

const ARCH_MAP: Partial<Record<NodeJS.Architecture, Arch>> = {
  x64: "x64",
  arm64: "arm64",
  ia32: "x86",
}

export function getPlatform(): Platform {
  return PLATFORM_MAP[platform] ?? "unknown"
}

export function getArch(): Arch {
  return ARCH_MAP[arch] ?? "unknown"
}

export function isWindows(): boolean {
  return platform === "win32"
}

export function isMac(): boolean {
  return platform === "darwin"
}

export function isLinux(): boolean {
  return platform === "linux"
}
