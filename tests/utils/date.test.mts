import { describe, expect, it } from "vitest"
import {
  addDays,
  formatISODate,
  getCurrentWeekMonday,
  getWeekdaysInRange,
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

describe("getWeekdaysInRange", () => {
  it("returns weekdays for a Mon-Fri week", () => {
    expect(getWeekdaysInRange("2026-03-02", "2026-03-06")).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
    ])
  })

  it("skips Saturday and Sunday", () => {
    // Mon Mar 2 through Mon Mar 9 — skips Sat Mar 7 and Sun Mar 8
    expect(getWeekdaysInRange("2026-03-02", "2026-03-09")).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-09",
    ])
  })

  it("returns empty array when start > end", () => {
    expect(getWeekdaysInRange("2026-03-10", "2026-03-02")).toEqual([])
  })

  it("returns single day when start === end on a weekday", () => {
    expect(getWeekdaysInRange("2026-03-02", "2026-03-02")).toEqual([
      "2026-03-02",
    ])
  })

  it("returns empty when range is only a weekend", () => {
    // Sat Mar 7 to Sun Mar 8
    expect(getWeekdaysInRange("2026-03-07", "2026-03-08")).toEqual([])
  })

  it("handles a full month", () => {
    const result = getWeekdaysInRange("2026-03-01", "2026-03-31")
    // March 2026: starts on Sun, 31 days. Weekdays = 22
    expect(result.length).toBe(22)
    // Verify no weekends
    for (const d of result) {
      const day = new Date(`${d}T00:00:00`).getDay()
      expect(day).toBeGreaterThanOrEqual(1)
      expect(day).toBeLessThanOrEqual(5)
    }
  })
})
