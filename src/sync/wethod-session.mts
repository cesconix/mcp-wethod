/**
 * LEGACY-COOKIE: session-cookie fetchers for the legacy Wethod endpoints that
 * the public API does not expose (timetracking report, planningboard, report
 * mapping). This file is the single isolation boundary for cookie auth — every
 * SF6SESSID-dependent call lives here.
 *
 * These authenticate with the browser SF6SESSID cookie rather than the API
 * bearer token — a separate, second HTTP path from utils/client. All three
 * endpoints share the same cookie/origin/referer headers and the same
 * ok && status==="Ok" success contract, captured once in `fetchWethodSession`.
 *
 * The cookie is a workaround (manual, expiring). When public endpoints become
 * available, follow the migration plan in docs/COOKIE-MIGRATION.md. Grep
 * "LEGACY-COOKIE" to find every cookie-dependent call site.
 */

import type {
  PlanningboardResponse,
  ReportResponse,
  TimetrackingResponse,
} from "./types.mjs"

type SessionAuth = { sessionId: string; company: string }

const API_ORIGIN = "https://api.wethod.com"

/**
 * LEGACY-COOKIE: the three cookie-authenticated endpoints, centralized so they
 * can be swapped for public API calls in one place. See docs/COOKIE-MIGRATION.md.
 */
export const LEGACY_COOKIE_ENDPOINTS = {
  /** Weekly timetracking report — source of persons, projects, clients. */
  timetrackingReport: `${API_ORIGIN}/report/timetracking/`,
  /** Planningboard employees — level/department/position/office/tag enrichment. */
  planningboardEmployees: `${API_ORIGIN}/planningboard/employees`,
  /** Report root — project → project_type mapping. */
  report: `${API_ORIGIN}/report/`,
} as const

/** Cookie/origin/referer headers every session-authenticated call requires. */
function sessionHeaders({ sessionId, company }: SessionAuth): HeadersInit {
  return {
    cookie: `SF6SESSID=${sessionId}; companyHostname=${company}.wethod.com`,
    origin: `https://${company}.wethod.com`,
    referer: `https://${company}.wethod.com/`,
  }
}

/**
 * GETs a session-authenticated Wethod endpoint and returns the parsed body,
 * or `null` on any failure (network error, non-2xx, or `status !== "Ok"`).
 */
async function fetchWethodSession<T extends { status: string }>(
  url: string,
  auth: SessionAuth,
): Promise<T | null> {
  try {
    const response = await fetch(url, { headers: sessionHeaders(auth) })
    if (!response.ok) return null
    const json = (await response.json()) as T
    if (json.status !== "Ok") return null
    return json
  } catch {
    return null
  }
}

/** LEGACY-COOKIE: fetch a single week's timetracking report. */
export function fetchWeek(
  monday: string,
  sessionId: string,
  company: string,
): Promise<TimetrackingResponse | null> {
  return fetchWethodSession<TimetrackingResponse>(
    `${LEGACY_COOKIE_ENDPOINTS.timetrackingReport}?date=${monday}`,
    { sessionId, company },
  )
}

/** LEGACY-COOKIE: fetch employees with level/tag data from the planningboard. */
export function fetchPlanningboardEmployees(
  sessionId: string,
  company: string,
): Promise<PlanningboardResponse | null> {
  return fetchWethodSession<PlanningboardResponse>(
    LEGACY_COOKIE_ENDPOINTS.planningboardEmployees,
    { sessionId, company },
  )
}

/**
 * LEGACY-COOKIE: fetch the project → project-type mapping from the `/report/`
 * endpoint. Returns an empty map on any failure.
 */
export async function fetchReport(
  sessionId: string,
  company: string,
): Promise<Map<number, number>> {
  const json = await fetchWethodSession<ReportResponse>(
    LEGACY_COOKIE_ENDPOINTS.report,
    {
      sessionId,
      company,
    },
  )
  if (!json) return new Map()

  const map = new Map<number, number>()
  for (const item of json.data) {
    if (item.project_type?.id != null) {
      map.set(item.project.id, item.project_type.id)
    }
  }
  return map
}
