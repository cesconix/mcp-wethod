import { describe, expect, it } from "vitest"
import { registerDeleteAllocation } from "../../src/tools/delete-allocation.mjs"

describe("delete_allocation tool", () => {
  it("registerDeleteAllocation is a function", () => {
    expect(typeof registerDeleteAllocation).toBe("function")
  })
})
