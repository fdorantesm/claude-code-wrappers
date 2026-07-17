/**
 * Creates per-provider entry points:
 *   - Terminal shim (Unix: symlink, Windows: .cmd/.ps1):
 *       `claude-<id>` → `cw` (dispatches via argv[0])
 */

import { existsSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { isWindows } from "../util/os.js"

export interface ShimResult {
  provider: string
  path: string
  kind: "symlink" | "cmd" | "ps1"
}

function generateCmdShim(_targetExe: string, providerId: string): string {
  // %~dp0 = directory of this .cmd file. We resolve cw.exe relative to it.
  return `@echo off
rem Auto-generated shim for cw provider: ${providerId}
setlocal
set "BIN_DIR=%~dp0"
set "CW_EXE=%BIN_DIR%cw.exe"
if not exist "%CW_EXE%" set "CW_EXE=%BIN_DIR%cw"
"%CW_EXE%" run ${providerId} %*
endlocal
`
}

function generatePs1Shim(_targetExe: string, providerId: string): string {
  return `# Auto-generated shim for cw provider: ${providerId}
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CwExe = Join-Path $ScriptDir 'cw.exe'
if (-not (Test-Path $CwExe)) { $CwExe = Join-Path $ScriptDir 'cw' }
& $CwExe run ${providerId} @args
`
}

export function installShim(binDir: string, providerId: string, cwBinName = "cw"): ShimResult {
  if (isWindows()) {
    const cmdPath = join(binDir, `claude-${providerId}.cmd`)
    const ps1Path = join(binDir, `claude-${providerId}.ps1`)
    writeFileSync(cmdPath, generateCmdShim(cwBinName, providerId))
    writeFileSync(ps1Path, generatePs1Shim(cwBinName, providerId))
    return { provider: providerId, path: cmdPath, kind: "cmd" }
  }

  const linkPath = join(binDir, `claude-${providerId}`)
  const cwPath = join(binDir, cwBinName)

  // Idempotent: if symlink exists and points correctly, no-op.
  if (existsSync(linkPath)) {
    try {
      const target = readlinkSync(linkPath)
      if (target === cwPath || target === cwBinName) {
        return { provider: providerId, path: linkPath, kind: "symlink" }
      }
      rmSync(linkPath)
    } catch {
      rmSync(linkPath)
    }
  }

  symlinkSync(cwPath, linkPath)
  return { provider: providerId, path: linkPath, kind: "symlink" }
}

export function removeShim(binDir: string, providerId: string): void {
  if (isWindows()) {
    for (const ext of [".cmd", ".ps1"]) {
      const p = join(binDir, `claude-${providerId}${ext}`)
      if (existsSync(p)) rmSync(p)
    }
    return
  }
  const p = join(binDir, `claude-${providerId}`)
  if (existsSync(p)) rmSync(p)
}
