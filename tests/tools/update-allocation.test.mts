import { describe, expect, it } from "vitest"
import { registerUpdateAllocation } from "../../src/tools/update-allocation.mjs"

describe("update_allocation tool", () => {
  it("registerUpdateAllocation is a function", () => {
    expect(typeof registerUpdateAllocation).toBe("function")
  })
})
