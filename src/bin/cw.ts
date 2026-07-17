#!/usr/bin/env node
// Auto-resolved by the bun build --compile flag:
//   bun build --compile --target=bun-<os>-<arch> --define="CW_VERSION=..." \
//              src/bin/cw.ts --outfile=dist/cw-<os>-<arch>[.exe]

import { runCli } from "../cli/program.js"

declare const CW_VERSION: string
declare const CW_BUILD_ID: string
;(globalThis as { CW_VERSION?: string; CW_BUILD_ID?: string }).CW_VERSION = CW_VERSION
;(globalThis as { CW_VERSION?: string; CW_BUILD_ID?: string }).CW_BUILD_ID = CW_BUILD_ID

const exitCode = await runCli(process.argv)
process.exit(exitCode)
