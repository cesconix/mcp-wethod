import { describe, expect, it, vi } from "vitest"
import { registerListBudgets } from "../../src/tools/list-budgets.mjs"
import type { WethodClient } from "../../src/utils/client.mjs"
import { createToolHarness } from "../helpers/tool-harness.mjs"

/**
 * Golden-output test for list_budgets — locks the exact text envelope so the
 * shared textResult/errorText and runtime-validation refactors cannot silently
 * change tool output. The tool suite is otherwise smoke-only.
 */

function budget(over: { id: number; project_id: number }) {
  return {
    id: over.id,
    project_id: over.project_id,
    status: "approved",
    version: 1,
    total_days: 190,
    total_cost: 1000,
    total_price: 2000,
    final_net_price: 1800,
    total_external_cost: 0,
    is_baseline: true,
    notes: null,
  }
}

function mockClient(impl: () => Promise<unknown>) {
  return {
    request: vi.fn<WethodClient["request"]>(impl as never),
  } as unknown as WethodClient
}

describe("list_budgets golden output", () => {
  it("formats a found list", async () => {
    const h = createToolHarness()
    registerListBudgets(
      h.server,
      mockClient(async () => [
        budget({ id: 1, project_id: 100 }),
        budget({ id: 2, project_id: 200 }),
      ]),
    )

    const res = await h.invoke("list_budgets", { limit: 100, offset: 0 })

    expect(res).toEqual({
      content: [
        {
          type: "text",
          text:
            "Found 2 budget(s):\n\n" +
            "id: 1 | Project 100 | approved | 190 days | cost: 1000 | price: 2000 | net: 1800\n" +
            "id: 2 | Project 200 | approved | 190 days | cost: 1000 | price: 2000 | net: 1800",
        },
      ],
    })
  })

  it("returns the empty message when no budgets exist", async () => {
    const h = createToolHarness()
    registerListBudgets(
      h.server,
      mockClient(async () => []),
    )

    const res = await h.invoke("list_budgets", { limit: 100, offset: 0 })

    expect(res).toEqual({
      content: [{ type: "text", text: "No budgets found." }],
    })
  })

  it("returns an error envelope when the API throws", async () => {
    const h = createToolHarness()
    registerListBudgets(
      h.server,
      mockClient(async () => {
        throw new Error("Wethod API 500: boom")
      }),
    )

    const res = await h.invoke("list_budgets", { limit: 100, offset: 0 })

    expect(res).toEqual({
      isError: true,
      content: [{ type: "text", text: "Error: Wethod API 500: boom" }],
    })
  })
})
