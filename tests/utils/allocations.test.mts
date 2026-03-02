import { describe, expect, it } from "vitest"

describe("allocations module", () => {
  it("exports Allocation type and fetchAllocations function", async () => {
    const mod = await import("../../src/utils/allocations.mjs")
    expect(typeof mod.fetchAllocations).toBe("function")
    expect(typeof mod.getDailyAllocatedHours).toBe("function")
  })
})
