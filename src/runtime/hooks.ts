/**
 * Pre/post-exec hook runner.
 */

import type { HookContext, HookSpec, ProviderDef } from "../providers/types.js"

export type HookPhase = "pre" | "post"

export interface RunHooksOptions {
  phase: HookPhase
  provider: ProviderDef
  ctx: Omit<HookContext, "provider">
  hooks?: HookSpec
  code?: number | null
  onError?: (err: unknown) => void
}

export async function runHooks(opts: RunHooksOptions): Promise<void> {
  const hook = opts.phase === "pre" ? opts.hooks?.preExec : opts.hooks?.postExec
  if (!hook) return

  const fullCtx = {
    ...opts.ctx,
    provider: opts.provider,
    ...(opts.phase === "post" ? { code: opts.code ?? null } : {}),
  } as HookContext & { code?: number | null }

  try {
    await hook(fullCtx as Parameters<typeof hook>[0])
  } catch (e) {
    if (opts.onError) opts.onError(e)
  }
}
