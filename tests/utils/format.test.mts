import { describe, expect, it } from "vitest"
import {
  formatDate,
  formatHours,
  formatToolError,
} from "../../src/utils/format.mjs"

describe("formatToolError", () => {
  it("formats an Error instance", () => {
    const result = formatToolError(new Error("something broke"))
    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "Error: something broke" }],
    })
  })

  it("formats a plain string", () => {
    const result = formatToolError("unexpected failure")
    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "Error: unexpected failure" }],
    })
  })

  it("formats a non-string non-Error value", () => {
    const result = formatToolError(42)
    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "Error: 42" }],
    })
  })

  it("formats null", () => {
    const result = formatToolError(null)
    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "Error: null" }],
    })
  })

  it("formats undefined", () => {
    const result = formatToolError(undefined)
    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "Error: undefined" }],
    })
  })
})

describe("formatHours", () => {
  it("shows OK when hours meet the expected target", () => {
    expect(formatHours(8, 8)).toBe("8/8h OK")
  })

  it("shows OK when hours exceed the expected target", () => {
    expect(formatHours(10, 8)).toBe("10/8h OK")
  })

  it("shows missing hours when below the target", () => {
    expect(formatHours(6, 8)).toBe("6/8h (2h missing)")
  })

  it("shows all hours missing when zero", () => {
    expect(formatHours(0, 8)).toBe("0/8h (8h missing)")
  })

  it("handles decimal hours", () => {
    expect(formatHours(5.5, 8)).toBe("5.5/8h (2.5h missing)")
  })
})

describe("formatDate", () => {
  it("formats a Monday date with English weekday", () => {
    // 2025-01-06 is a Monday
    expect(formatDate("2025-01-06")).toBe("Mon 2025-01-06")
  })

  it("formats a Saturday date", () => {
    // 2025-01-04 is a Saturday
    expect(formatDate("2025-01-04")).toBe("Sat 2025-01-04")
  })

  it("formats a Sunday date", () => {
    // 2025-01-05 is a Sunday
    expect(formatDate("2025-01-05")).toBe("Sun 2025-01-05")
  })

  it("formats a Wednesday date", () => {
    // 2025-01-08 is a Wednesday
    expect(formatDate("2025-01-08")).toBe("Wed 2025-01-08")
  })
})
