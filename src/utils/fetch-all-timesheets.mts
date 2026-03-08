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
