import { describe, expect, it } from "vitest"

describe("allocations module", () => {
  it("exports fetchAllocations function", async () => {
    const mod = await import("../../src/utils/allocations.mjs")
    expect(typeof mod.fetchAllocations).toBe("function")
  })
})
