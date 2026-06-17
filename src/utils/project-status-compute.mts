/**
 * Pure helpers for computing project-status values from budget + timesheets.
 *
 * The core rule: a weekly project status in `remaining-days` mode reports
 * how many budget days are LEFT, not consumed:
 *
 *   days_left = budget.total_days − (Σ timesheet hours through the week) / 8
 *
 * These functions are deliberately pure (no I/O) so they can be unit-tested
 * and reused by both the single-create tool and the backfill tool.
 */

import { WORK_HOURS_PER_DAY } from "./constants.mjs"
import { addDays } from "./date.mjs"

/** Minimal shape needed to sum timesheet hours by date. */
export type TimesheetLike = {
  date: string
  hours: number
}

/**
 * Sums the hours of all timesheet entries whose `date` is on or before the
 * given ISO date (inclusive). Relies on YYYY-MM-DD lexicographic ordering.
 */
export function sumHoursOnOrBefore(
  timesheets: TimesheetLike[],
  isoDateInclusive: string,
): number {
  return timesheets
    .filter((ts) => ts.date <= isoDateInclusive)
    .reduce((sum, ts) => sum + ts.hours, 0)
}

/**
 * Converts hours to working days (hours / 8), rounded to 2 decimals.
 */
export function hoursToDays(hours: number): number {
  return round2(hours / WORK_HOURS_PER_DAY)
}

/**
 * Computes `days_left = totalDays − consumedHours / 8`, rounded to 2 decimals.
 *
 * The result can be negative when a project is over budget — callers decide
 * whether to clamp; the raw signed value is the honest figure.
 *
 * NOTE: this keeps 2 decimals for an honest preview/recap; the Wethod API only
 * accepts an INTEGER days_left, so writes must pass through `toApiDaysLeft`.
 */
export function computeDaysLeft(
  totalDays: number,
  consumedHours: number,
): number {
  return round2(totalDays - consumedHours / WORK_HOURS_PER_DAY)
}

/**
 * Coerces a computed days_left to the integer the Wethod API requires.
 *
 * Wethod's POST/PATCH `/api/project-statuses` rejects a fractional `days_left`
 * with HTTP 400 ("invalid data"). We compute with decimals for transparency
 * but must round to the nearest whole day at the write boundary.
 */
export function toApiDaysLeft(daysLeft: number): number {
  return Math.round(daysLeft)
}

/**
 * Returns every Monday in the inclusive range [from, to].
 * Both bounds are assumed to be Mondays (validate before calling).
 */
export function mondaysInRange(from: string, to: string): string[] {
  const out: string[] = []
  let cur = from
  while (cur <= to) {
    out.push(cur)
    cur = addDays(cur, 7)
  }
  return out
}

/** What the backfill will do to a given week. */
export type BackfillAction = "create" | "skip" | "overwrite"

/** One planned week of a backfill run. */
export type BackfillPlanRow = {
  week: string
  weekEnd: string
  consumedHours: number
  daysLeft: number
  action: BackfillAction
  existingId?: number
}

/**
 * Builds the per-week backfill plan. Pure: takes already-fetched data and
 * decides, for each week, the computed days_left and the action to take.
 *
 * - week not present in `existingIds` → "create"
 * - week present and `overwrite` → "overwrite" (carries existingId)
 * - week present and not `overwrite` → "skip"
 */
export function planBackfill(opts: {
  totalDays: number
  timesheets: TimesheetLike[]
  weeks: string[]
  /** Map of week (Monday ISO) → existing status id. */
  existingIds: Record<string, number>
  overwrite: boolean
}): BackfillPlanRow[] {
  return opts.weeks.map((week) => {
    const weekEnd = addDays(week, 6)
    const consumedHours = sumHoursOnOrBefore(opts.timesheets, weekEnd)
    const daysLeft = computeDaysLeft(opts.totalDays, consumedHours)
    const existingId = opts.existingIds[week]
    let action: BackfillAction
    if (existingId === undefined) action = "create"
    else if (opts.overwrite) action = "overwrite"
    else action = "skip"
    return { week, weekEnd, consumedHours, daysLeft, action, existingId }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
