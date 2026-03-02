/**
 * Shared allocation logic used by allocation CRUD tools and
 * the existing get_weekly_plan / get_availability tools.
 */

import type { WethodClient } from "./client.mjs"

export type Allocation = {
  id: number
  created_at: string
  updated_at: string
  date: string
  hours: number
  project_id: number
  person_id: number
  deleted_at: string | null
}

/**
 * Fetches allocations from the Wethod API with date range filtering.
 *
 * Sends `date=gte:<date_from>` as the API query param, then client-side
 * filters by `date_to` and excludes soft-deleted entries (`deleted_at !== null`).
 *
 * The API returns max 100 items per page. For ranges that may exceed this
 * (e.g. 6 months), callers should set a higher limit or paginate.
 */
export async function fetchAllocations(
  client: WethodClient,
  params: {
    person_id: number
    project_id?: number
    date_from?: string
    date_to?: string
    limit?: number
    offset?: number
  },
): Promise<Allocation[]> {
  const allocations = await client.request<Allocation[]>(
    "GET",
    "/api/people-allocations",
    {
      params: {
        person_id: params.person_id,
        project_id: params.project_id,
        date: params.date_from ? `gte:${params.date_from}` : undefined,
        limit: params.limit ?? 100,
        offset: params.offset ?? 0,
      },
    },
  )

  return allocations.filter((a) => {
    if (a.deleted_at !== null) return false
    if (params.date_to && a.date > params.date_to) return false
    return true
  })
}

/**
 * Returns total hours already allocated for a person on a specific date.
 * Used to pre-validate the 8h daily limit before creating new allocations.
 */
export async function getDailyAllocatedHours(
  client: WethodClient,
  personId: number,
  date: string,
): Promise<number> {
  const allocations = await fetchAllocations(client, {
    person_id: personId,
    date_from: date,
    date_to: date,
  })

  return allocations.reduce((sum, a) => sum + a.hours, 0)
}
