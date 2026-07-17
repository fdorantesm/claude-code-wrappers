/**
 * Root commander program — defines all subcommands.
 */

import { Command } from "commander"
import { addCommand } from "./commands/add.js"
import { doctorCommand } from "./commands/doctor.js"
import { envCommand } from "./commands/env.js"
import { initCommand } from "./commands/init.js"
import { installCommand } from "./commands/install.js"
import { listCommand } from "./commands/list.js"
import { modelsCommand } from "./commands/models.js"
import { renameCommand } from "./commands/rename.js"
import { resetCommand } from "./commands/reset.js"
import { rmCommand } from "./commands/rm.js"
import { runCommand } from "./commands/run.js"
import { showCommand } from "./commands/show.js"
import { detectProviderFromArgv, rewriteArgv } from "./dispatch.js"

export function buildProgram(): Command {
  const program = new Command()
  const buildId = (globalThis as { CW_BUILD_ID?: string }).CW_BUILD_ID ?? "dev"
  program
    .name("cw")
    .description("Multi-provider Claude Code CLI wrapper")
    .version(`${CW_VERSION} (${buildId})`)
    .enablePositionalOptions()

  program
    .command("init")
    .description("initialize ~/.config/claude-wrappers/ with cw.json and .env.example")
    .action(initCommand)

  program
    .command("install")
    .description("generate homes, settings.json, symlinks (idempotent)")
    .option("--provider <id>", "install only this provider")
    .option("--config-only", "skip bin shim creation")
    .option("--bin-only", "only install bin shims, skip config")
    .option("--sandbox", "enable sandbox profile for this provider")
    .option("--claude-bin <path>", "override the claude binary path")
    .action(installCommand)

  program
    .command("add <provider>")
    .description("interactive setup for a provider")
    .option("--non-interactive", "fail if env file is missing")
    .option("--as <name>", "clone this provider with a custom id (e.g., --as bedrock-work)")
    .action(addCommand)

  program
    .command("config <provider>")
    .description("edit .env for a provider in $EDITOR")
    .option("--apply", "auto-apply after editing")
    .action(async (providerId: string) => {
      const editor = process.env.EDITOR ?? "vi"
      const xdg = (await import("../xdg/paths.js")).getPlatformPaths()
      const envFile = (await import("node:path")).join(xdg.configDir, "env", `${providerId}.env`)
      const { spawn } = await import("bun")
      const proc = spawn({
        cmd: [editor, envFile],
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      })
      await proc.exited
      const { log } = await import("./logger.js")
      log.info("re-validating and regenerating settings.json...")
      const { installCommand } = await import("./commands/install.js")
      await installCommand({ provider: providerId })
    })

  program
    .command("reset [target]")
    .description("regenerate homes; target = <provider>, --all, --user-settings, --credentials")
    .action(resetCommand)

  program
    .command("rename <old-id> <new-id>")
    .description("rename a provider instance (home, env, shim, clones)")
    .action(renameCommand)

  program
    .command("rm <provider>")
    .alias("remove")
    .alias("delete")
    .description("remove a provider's home, env, shim, and clone entry")
    .option("-y, --force", "skip confirmation prompt")
    .action(rmCommand)

  program
    .command("list")
    .alias("ls")
    .description("list all providers with status")
    .option("--json", "emit JSON instead of a table")
    .action(listCommand)

  program
    .command("show <provider>")
    .description("show detailed info about a provider")
    .action(showCommand)

  program
    .command("models <provider>")
    .description("list models available for a provider (via models.dev)")
    .option("--refresh", "bypass cache and refetch from models.dev")
    .option("--tier <tier>", "filter by tier (opus, sonnet, haiku, small-fast, fable, mythos)")
    .option("--json", "emit JSON instead of a table")
    .action(modelsCommand)

  program
    .command("doctor [provider]")
    .description("health check per provider")
    .action(doctorCommand)

  program
    .command("env <provider>")
    .description("print merged env without running Claude")
    .option("--show-secrets", "do NOT redact secret values (DANGEROUS)")
    .action(envCommand)

  program
    .command("run <provider> [args...]")
    .description("spawn Claude with this provider's environment")
    .allowUnknownOption()
    .passThroughOptions()
    .action(async (providerId: string, args: string[]) => {
      await runCommand(providerId, args)
    })

  program
    .command("sync")
    .description("re-sync symlinks after Claude Code update")
    .action(async () => {
      const { log } = await import("./logger.js")
      log.info("syncing homes...")
      const { installCommand } = await import("./commands/install.js")
      await installCommand({})
    })

  program
    .command("audit")
    .description("show credential sources per provider")
    .option("--hashes", "include SHA-256 fingerprints")
    .action(async (opts: { hashes?: boolean }) => {
      const { log } = await import("./logger.js")
      const { listCommand } = await import("./commands/list.js")
      await listCommand({ json: true })
      if (opts.hashes) log.info("(hashes printed in list --json output)")
    })

  program
    .command("secret <action> [provider] [key]")
    .description("manage secrets (set/get/rotate) in keyring")
    .action(async (action: string, provider?: string, key?: string) => {
      const { log } = await import("./logger.js")
      if (action === "set" && provider && key) {
        log.info(`reading ${key} from stdin...`)
        log.warn("keyring integration is not yet implemented in v1 — falling back to .env")
        const xdg = (await import("../xdg/paths.js")).getPlatformPaths()
        const { join } = await import("node:path")
        const { readFileSync, writeFileSync } = await import("node:fs")
        const { existsSync } = await import("node:fs")
        const value = await new Promise<string>((resolve) => {
          let buf = ""
          process.stdin.on("data", (c: string) => {
            buf += c
          })
          process.stdin.on("end", () => resolve(buf.trim()))
        })
        const envFile = join(xdg.configDir, "env", `${provider}.env`)
        const existing = existsSync(envFile) ? readFileSync(envFile, "utf8") : ""
        const line = `${key}=${value}\n`
        const updated = existing.includes(`${key}=`)
          ? existing.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`)
          : existing + line
        writeFileSync(envFile, updated, { mode: 0o600 })
        log.info(`✓ stored ${provider}.${key} in ${envFile}`)
      } else {
        log.error("usage: cw secret set <provider> <KEY>  (reads from stdin)")
      }
    })

  return program
}

export async function runCli(argv: readonly string[]): Promise<number> {
  const provider = detectProviderFromArgv(argv)
  const effectiveArgv = provider ? rewriteArgv(argv, provider) : [...argv]

  const program = buildProgram()
  await program.parseAsync(effectiveArgv)
  return 0
}

// CW_VERSION is injected by `bun build --define`
declare const CW_VERSION: string
