import { describe, expect, it } from "vitest"
import {
  computeDaysLeft,
  hoursToDays,
  mondaysInRange,
  planBackfill,
  sumHoursOnOrBefore,
  toApiDaysLeft,
} from "../../src/utils/project-status-compute.mjs"

describe("sumHoursOnOrBefore", () => {
  const ts = [
    { date: "2026-01-05", hours: 8 },
    { date: "2026-01-12", hours: 6 },
    { date: "2026-01-19", hours: 4 },
  ]

  it("sums hours up to and including the bound", () => {
    expect(sumHoursOnOrBefore(ts, "2026-01-12")).toBe(14)
  })

  it("includes entries exactly on the bound", () => {
    expect(sumHoursOnOrBefore(ts, "2026-01-05")).toBe(8)
  })

  it("returns 0 when all entries are after the bound", () => {
    expect(sumHoursOnOrBefore(ts, "2026-01-01")).toBe(0)
  })

  it("sums everything when the bound is past all entries", () => {
    expect(sumHoursOnOrBefore(ts, "2026-12-31")).toBe(18)
  })

  it("returns 0 for an empty list", () => {
    expect(sumHoursOnOrBefore([], "2026-01-12")).toBe(0)
  })
})

describe("hoursToDays", () => {
  it("converts hours to working days at 8h/day", () => {
    expect(hoursToDays(8)).toBe(1)
    expect(hoursToDays(40)).toBe(5)
  })

  it("rounds to 2 decimals", () => {
    expect(hoursToDays(82.5)).toBe(10.31)
  })
})

describe("computeDaysLeft", () => {
  it("matches a real-data example", () => {
    // budget 38 days, 82.5h logged → 38 − 10.3125 = 27.69
    expect(computeDaysLeft(38, 82.5)).toBe(27.69)
  })

  it("returns the full budget when no hours are logged", () => {
    expect(computeDaysLeft(38, 0)).toBe(38)
  })

  it("returns 0 when consumed exactly equals the budget", () => {
    expect(computeDaysLeft(10, 80)).toBe(0)
  })

  it("returns a negative value when over budget (honest overrun)", () => {
    expect(computeDaysLeft(10, 96)).toBe(-2)
  })
})

describe("toApiDaysLeft", () => {
  it("rounds a fractional days_left to the nearest integer (Wethod requires int)", () => {
    // Real backfill case: 190 − 15.5/8 = 188.06 → POSTed as 188.
    expect(toApiDaysLeft(188.06)).toBe(188)
    expect(toApiDaysLeft(143.13)).toBe(143)
  })

  it("rounds halves up and leaves integers untouched", () => {
    expect(toApiDaysLeft(27.5)).toBe(28)
    expect(toApiDaysLeft(188)).toBe(188)
  })

  it("preserves the sign of an overrun", () => {
    expect(toApiDaysLeft(-2.3)).toBe(-2)
  })
})

describe("mondaysInRange", () => {
  it("lists every Monday in an inclusive range", () => {
    expect(mondaysInRange("2026-01-05", "2026-01-26")).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
      "2026-01-26",
    ])
  })

  it("returns a single week when from === to", () => {
    expect(mondaysInRange("2026-01-05", "2026-01-05")).toEqual(["2026-01-05"])
  })

  it("returns empty when from is after to", () => {
    expect(mondaysInRange("2026-01-12", "2026-01-05")).toEqual([])
  })

  it("crosses a month boundary", () => {
    expect(mondaysInRange("2026-01-26", "2026-02-09")).toEqual([
      "2026-01-26",
      "2026-02-02",
      "2026-02-09",
    ])
  })
})

describe("planBackfill", () => {
  const timesheets = [
    { date: "2026-01-09", hours: 40 }, // week of Jan 5 (Mon–Sun: 05–11)
    { date: "2026-01-16", hours: 40 }, // week of Jan 12 (12–18)
  ]
  const weeks = ["2026-01-05", "2026-01-12", "2026-01-19"]

  it("computes cumulative days_left per week and marks new weeks as create", () => {
    const plan = planBackfill({
      totalDays: 20,
      timesheets,
      weeks,
      existingIds: {},
      overwrite: false,
    })
    expect(plan).toEqual([
      {
        week: "2026-01-05",
        weekEnd: "2026-01-11",
        consumedHours: 40,
        daysLeft: 15, // 20 − 40/8
        action: "create",
        existingId: undefined,
      },
      {
        week: "2026-01-12",
        weekEnd: "2026-01-18",
        consumedHours: 80,
        daysLeft: 10, // 20 − 80/8
        action: "create",
        existingId: undefined,
      },
      {
        week: "2026-01-19",
        weekEnd: "2026-01-25",
        consumedHours: 80,
        daysLeft: 10,
        action: "create",
        existingId: undefined,
      },
    ])
  })

  it("skips weeks that already have a status when overwrite is false", () => {
    const plan = planBackfill({
      totalDays: 20,
      timesheets,
      weeks,
      existingIds: { "2026-01-12": 999 },
      overwrite: false,
    })
    const byWeek = Object.fromEntries(plan.map((p) => [p.week, p]))
    expect(byWeek["2026-01-12"].action).toBe("skip")
    expect(byWeek["2026-01-12"].existingId).toBe(999)
    expect(byWeek["2026-01-05"].action).toBe("create")
  })

  it("marks existing weeks as overwrite (with id) when overwrite is true", () => {
    const plan = planBackfill({
      totalDays: 20,
      timesheets,
      weeks,
      existingIds: { "2026-01-12": 999 },
      overwrite: true,
    })
    const row = plan.find((p) => p.week === "2026-01-12")
    expect(row?.action).toBe("overwrite")
    expect(row?.existingId).toBe(999)
  })
})
