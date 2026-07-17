/**
 * Logger that respects NO_COLOR / TTY / log level.
 */

import { redactString } from "../security/redact.js"

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent"

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 99,
}

const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  silent: "",
}

const RESET = "\x1b[0m"

export class Logger {
  constructor(
    private level: LogLevel = "info",
    private useColor = process.stdout.isTTY === true && process.env.NO_COLOR === undefined,
  ) {}

  private shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[this.level]
  }

  private format(level: LogLevel, msg: string): string {
    const ts = new Date().toISOString().slice(11, 19)
    const color = this.useColor ? COLORS[level] : ""
    const reset = this.useColor ? RESET : ""
    const prefix = level === "info" ? "" : `${color}[${level}]${reset} `
    return `${color}${ts}${reset} ${prefix}${redactString(msg)}`
  }

  debug(msg: string): void {
    if (this.shouldLog("debug")) console.error(this.format("debug", msg))
  }

  info(msg: string): void {
    if (this.shouldLog("info")) console.error(this.format("info", msg))
  }

  warn(msg: string): void {
    if (this.shouldLog("warn")) console.error(this.format("warn", msg))
  }

  error(msg: string): void {
    if (this.shouldLog("error")) console.error(this.format("error", msg))
  }

  child(_prefix: string): Logger {
    return this
  }
}

export const log = new Logger()
