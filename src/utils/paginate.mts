/**
 * Generic offset-pagination over the Wethod REST API.
 *
 * Wethod list endpoints return at most `PAGE_SIZE` rows per request. This walks
 * every page (GET with limit/offset) and returns the full set, stopping when a
 * short page signals the end.
 *
 * Generic over the row type `T`: the util never narrows the shape, so callers
 * keep every field they declare — e.g. `deleted_at` for soft-delete filtering.
 * Each call is strictly sequential (no internal concurrency), preserving the
 * request burst profile callers rely on.
 */

import type { WethodClient } from "./client.mjs"

/** Rows per page — Wethod's maximum. */
export const PAGE_SIZE = 100

/** Query params passed to each page request (besides limit/offset). */
type PageParams = Record<string, string | number | boolean | undefined>

/**
 * Fetches every page of a Wethod list endpoint and returns the concatenated
 * rows. `params` are merged into each request alongside the paging cursor.
 */
export async function fetchAllPages<T>(
  client: WethodClient,
  endpoint: string,
  params: PageParams = {},
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = []
  let offset = 0

  while (true) {
    const page = await client.request<T[]>("GET", endpoint, {
      params: { ...params, limit: pageSize, offset },
    })
    all.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return all
}
