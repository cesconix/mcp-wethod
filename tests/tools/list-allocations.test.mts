import { describe, expect, it } from "vitest"
import { registerListAllocations } from "../../src/tools/allocations/list-allocations.mjs"

describe("list_allocations tool", () => {
  it("registerListAllocations is a function", () => {
    expect(typeof registerListAllocations).toBe("function")
  })
})
