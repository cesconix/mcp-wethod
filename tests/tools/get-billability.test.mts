import { describe, expect, it } from "vitest"
import { registerGetBillability } from "../../src/tools/get-billability.mjs"

describe("get_billability tool", () => {
  it("registerGetBillability is a function", () => {
    expect(typeof registerGetBillability).toBe("function")
  })
})
