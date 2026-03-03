import { describe, expect, it } from "vitest"
import { registerCreateAllocation } from "../../src/tools/create-allocation.mjs"

describe("create_allocation tool", () => {
  it("registerCreateAllocation is a function", () => {
    expect(typeof registerCreateAllocation).toBe("function")
  })
})
