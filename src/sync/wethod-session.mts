/**
 * Session-cookie fetchers for the legacy Wethod endpoints that the public API
 * does not expose (timetracking report, planningboard, report mapping).
 *
 * These authenticate with the browser SF6SESSID cookie rather than the API
 * bearer token — a separate, second HTTP path from utils/client. All three
 * endpoints share the same cookie/origin/referer headers and the same
 * ok && status==="Ok" success contract, captured once in `fetchWethodSession`.
 */

import type {
  PlanningboardResponse,
  ReportResponse,
  TimetrackingResponse,
} from "./types.mjs"

type SessionAuth = { sessionId: string; company: string }

const API_ORIGIN = "https://api.wethod.com"

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

/** Fetch a single week's timetracking report. */
export function fetchWeek(
  monday: string,
  sessionId: string,
  company: string,
): Promise<TimetrackingResponse | null> {
  return fetchWethodSession<TimetrackingResponse>(
    `${API_ORIGIN}/report/timetracking/?date=${monday}`,
    { sessionId, company },
  )
}

/** Fetch employees with level/tag data from the planningboard endpoint. */
export function fetchPlanningboardEmployees(
  sessionId: string,
  company: string,
): Promise<PlanningboardResponse | null> {
  return fetchWethodSession<PlanningboardResponse>(
    `${API_ORIGIN}/planningboard/employees`,
    { sessionId, company },
  )
}

/**
 * Fetch the project → project-type mapping from the `/report/` endpoint.
 * Returns an empty map on any failure.
 */
export async function fetchReport(
  sessionId: string,
  company: string,
): Promise<Map<number, number>> {
  const json = await fetchWethodSession<ReportResponse>(
    `${API_ORIGIN}/report/`,
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
