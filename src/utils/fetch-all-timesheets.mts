/**
 * Paginated timesheet fetcher.
 *
 * The Wethod API returns at most 100 entries per request. This utility
 * paginates through all pages so callers get the complete result set.
 */

import type { WethodClient } from "./client.mjs"

type Timesheet = {
  id: number
  date: string
  hours: number
  notes: string | null
  mode: string
  project_id: number
  person_id: number
}

const PAGE_SIZE = 100

/**
 * Fetches all timesheet entries for a person starting from a given date,
 * automatically paginating through all results.
 */
export async function fetchAllTimesheets(
  client: WethodClient,
  opts: { person_id: number; date_gte: string },
): Promise<Timesheet[]> {
  const all: Timesheet[] = []
  let offset = 0

  while (true) {
    const page = await client.request<Timesheet[]>("GET", "/api/timesheets", {
      params: {
        person_id: opts.person_id,
        date: `gte:${opts.date_gte}`,
        limit: PAGE_SIZE,
        offset,
      },
    })

    all.push(...page)

    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}

/**
 * Fetches ALL timesheet entries for a project, paginating through all pages.
 *
 * Used by project-status backfill: fetch a project's full timesheet history
 * once, then sum hours per week client-side (see project-status-compute).
 * Pass `date_gte` to bound the lower end (e.g. start of the backfill range).
 */
export async function fetchAllProjectTimesheets(
  client: WethodClient,
  opts: { project_id: number; date_gte?: string },
): Promise<Timesheet[]> {
  const all: Timesheet[] = []
  let offset = 0

  while (true) {
    const params: Record<string, string | number> = {
      project_id: opts.project_id,
      limit: PAGE_SIZE,
      offset,
    }
    if (opts.date_gte) {
      params.date = `gte:${opts.date_gte}`
    }

    const page = await client.request<Timesheet[]>("GET", "/api/timesheets", {
      params,
    })

    all.push(...page)

    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}
