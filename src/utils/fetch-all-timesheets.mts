/**
 * Timesheet-specific wrappers over the generic page walker.
 *
 * The Wethod API returns at most one page of timesheet entries per request;
 * these helpers fetch the complete set for a person or a project. The paging
 * loop itself lives in `paginate.mjs` and is shared with the other list
 * endpoints.
 */

import type { WethodClient } from "./client.mjs"
import { fetchAllPages } from "./paginate.mjs"

type Timesheet = {
  id: number
  date: string
  hours: number
  notes: string | null
  mode: string
  project_id: number
  person_id: number
}

/**
 * Fetches all timesheet entries for a person from a given date onward.
 */
export function fetchAllTimesheets(
  client: WethodClient,
  opts: { person_id: number; date_gte: string },
): Promise<Timesheet[]> {
  return fetchAllPages<Timesheet>(client, "/api/timesheets", {
    person_id: opts.person_id,
    date: `gte:${opts.date_gte}`,
  })
}

/**
 * Fetches ALL timesheet entries for a project.
 *
 * Used by project-status backfill: fetch a project's full timesheet history
 * once, then sum hours per week client-side (see project-status-compute).
 * Pass `date_gte` to bound the lower end (e.g. start of the backfill range).
 */
export function fetchAllProjectTimesheets(
  client: WethodClient,
  opts: { project_id: number; date_gte?: string },
): Promise<Timesheet[]> {
  return fetchAllPages<Timesheet>(client, "/api/timesheets", {
    project_id: opts.project_id,
    date: opts.date_gte ? `gte:${opts.date_gte}` : undefined,
  })
}
