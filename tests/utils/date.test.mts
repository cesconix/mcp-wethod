import { describe, expect, it } from "vitest"
import {
  addDays,
  formatISODate,
  getCurrentWeekMonday,
  isTodayOrPast,
} from "../../src/utils/date.mjs"

describe("formatISODate", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(formatISODate(new Date(2025, 0, 6))).toBe("2025-01-06")
  })

  it("zero-pads single-digit month and day", () => {
    expect(formatISODate(new Date(2025, 2, 3))).toBe("2025-03-03")
  })
})

describe("addDays", () => {
  it("adds days to a date string", () => {
    expect(addDays("2025-01-06", 4)).toBe("2025-01-10")
  })

  it("crosses month boundary", () => {
    expect(addDays("2025-01-30", 3)).toBe("2025-02-02")
  })

  it("handles zero days", () => {
    expect(addDays("2025-06-15", 0)).toBe("2025-06-15")
  })
})

describe("getCurrentWeekMonday", () => {
  it("returns a YYYY-MM-DD string", () => {
    const result = getCurrentWeekMonday()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("returns a Monday", () => {
    const result = getCurrentWeekMonday()
    const day = new Date(`${result}T00:00:00`).getDay()
    expect(day).toBe(1) // Monday
  })
})

describe("isTodayOrPast", () => {
  it("returns true for a past date", () => {
    expect(isTodayOrPast("2020-01-01")).toBe(true)
  })

  it("returns false for a far future date", () => {
    expect(isTodayOrPast("2099-12-31")).toBe(false)
  })

  it("returns true for today", () => {
    const today = formatISODate(new Date())
    expect(isTodayOrPast(today)).toBe(true)
  })
})
