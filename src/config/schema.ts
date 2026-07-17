/**
 * Zod schemas for cw.json and provider schemas.
 */

import { z } from "zod"

export const PluginSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().optional().default(true),
  options: z.record(z.string(), z.unknown()).optional(),
})

export const CloneSchema = z.object({
  extends: z.string().min(1),
  label: z.string().optional(),
})

export const DefaultsSchema = z.object({
  sandbox: z.boolean().optional().default(false),
  logLevel: z.enum(["debug", "info", "warn", "error"]).optional().default("info"),
  extraEnv: z.record(z.string(), z.string()).optional(),
})

export const CwConfigSchema = z
  .object({
    $schema: z.string().optional(),
    providers: z.array(z.string().regex(/^[a-z][a-z0-9_-]*$/, "kebab-case id")).default([]),
    clones: z
      .record(z.string().regex(/^[a-z][a-z0-9_-]*$/, "kebab-case id"), CloneSchema)
      .default({}),
    plugins: z.array(PluginSchema).default([]),
    defaults: DefaultsSchema.optional(),
  })
  .strict()

export type CwConfig = z.infer<typeof CwConfigSchema>
export type Plugin = z.infer<typeof PluginSchema>
export type Clone = z.infer<typeof CloneSchema>
export type Defaults = z.infer<typeof DefaultsSchema>
