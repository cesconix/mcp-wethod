import { describe, expect, it } from "vitest"
import { DataLoader } from "../../src/utils/data-loader.mjs"

describe("DataLoader.projectName", () => {
  it("is a method on DataLoader instances", () => {
    const loader = new DataLoader("/nonexistent")
    expect(typeof loader.projectName).toBe("function")
  })

  it("returns Unknown for missing ID when data dir is empty", () => {
    const loader = new DataLoader("/nonexistent")
    expect(loader.projectName(999)).toBe("Unknown (999)")
  })
})
