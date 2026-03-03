import { describe, expect, it } from "vitest"

describe("get_billability_report", () => {
  it("registerGetBillabilityReport is a function", async () => {
    const { registerGetBillabilityReport } = await import(
      "../../src/tools/get-billability-report.mjs"
    )
    expect(typeof registerGetBillabilityReport).toBe("function")
  })
})
