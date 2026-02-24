import { describe, expect, it } from "vitest"

describe("mcp-wethod entry point", () => {
  it("exports registerAllTools", async () => {
    const mod = await import("../src/index.mjs")
    expect(typeof mod.registerAllTools).toBe("function")
  })

  it("exports registerAllPrompts", async () => {
    const mod = await import("../src/index.mjs")
    expect(typeof mod.registerAllPrompts).toBe("function")
  })

  it("exports registerAll", async () => {
    const mod = await import("../src/index.mjs")
    expect(typeof mod.registerAll).toBe("function")
  })

  it("exports createMcpServer", async () => {
    const mod = await import("../src/index.mjs")
    expect(typeof mod.createMcpServer).toBe("function")
  })

  it("exports WethodClient", async () => {
    const mod = await import("../src/index.mjs")
    expect(typeof mod.WethodClient).toBe("function")
  })

  it("exports DataLoader", async () => {
    const mod = await import("../src/index.mjs")
    expect(typeof mod.DataLoader).toBe("function")
  })
})
