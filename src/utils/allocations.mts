/**
 * Shared allocation logic used by allocation CRUD tools and
 * the existing get_weekly_plan / get_availability tools.
 */

import type { WethodClient } from "./client.mjs"
import type { Allocation } from "./schemas.mjs"

export type { Allocation }

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
