/**
 * Unit tests for src/runtime/hooks.ts — pre/post-exec hook runner.
 */

import { describe, expect, it, vi } from "bun:test"
import { runHooks } from "../../src/runtime/hooks.js"

describe("runHooks", () => {
  it("runs pre-exec hooks in order", async () => {
    const order: string[] = []
    await runHooks({
      phase: "pre",
      provider: { id: "test", label: "t", envSchema: {} as never, settingsTemplate: "x" },
      ctx: {} as never,
      hooks: {
        preExec: () => {
          order.push("first")
        },
        postExec: () => {
          order.push("second")
        },
      },
    })
    expect(order).toEqual(["first"])
  })

  it("runs post-exec hooks with the exit code", async () => {
    let received: number | null | undefined
    await runHooks({
      phase: "post",
      provider: { id: "test", label: "t", envSchema: {} as never, settingsTemplate: "x" },
      ctx: {} as never,
      code: 42,
      hooks: {
        postExec: (ctx) => {
          received = ctx.code
        },
      },
    })
    expect(received).toBe(42)
  })

  it("supports async hooks", async () => {
    const spy = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    await runHooks({
      phase: "pre",
      provider: { id: "test", label: "t", envSchema: {} as never, settingsTemplate: "x" },
      ctx: {} as never,
      hooks: { preExec: spy },
    })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("continues on hook error (does not throw)", async () => {
    const spy = vi.fn()
    await runHooks({
      phase: "pre",
      provider: { id: "test", label: "t", envSchema: {} as never, settingsTemplate: "x" },
      ctx: {} as never,
      hooks: {
        preExec: () => {
          throw new Error("hook failed")
        },
      },
      onError: spy,
    })
    expect(spy).toHaveBeenCalled()
  })

  it("does nothing when no hook is registered for the phase", async () => {
    await expect(
      runHooks({
        phase: "pre",
        provider: { id: "test", label: "t", envSchema: {} as never, settingsTemplate: "x" },
        ctx: {} as never,
        hooks: {},
      }),
    ).resolves.toBeUndefined()
  })
})
