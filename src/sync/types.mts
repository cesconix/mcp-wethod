/**
 * Response and result types for the sync pipeline.
 *
 * Shared by the session fetchers (wethod-session), the JSON builders
 * (builders), and the orchestrator (perform-sync). Kept in their own module so
 * those layers never depend on the tool registration file.
 */

import type {
  ClientEntry,
  LevelEntry,
  PersonEntry,
  ProjectEntry,
  ProjectTypeEntry,
} from "../utils/data-loader.mjs"

// --- Public API (`/api/...`, bearer token) ---

export type ApiClient = {
  id: number
  corporate_name: string
}

export type ApiProject = {
  id: number
  name: string
  job_order: string | null
  client_id: number
  pm_id: number | null
  is_archived: boolean
  project_type_id: number | null
}

// --- Timetracking report (`/report/timetracking/`, session cookie) ---

export type TimetrackingEmployee = {
  id: number
  name: string
  surname: string
  is_external: boolean
  timetrackings?: unknown
}

export type TimetrackingProject = {
  id: number
  name: string
  job_order: string | null
}

export type TimetrackingProjectType = {
  id: number
  name: string
  chargeable: number
  hoursType: string
}

export type TimetrackingResponse = {
  status: string
  data: {
    employees: TimetrackingEmployee[]
    project: TimetrackingProject[]
    project_types: TimetrackingProjectType[]
  }
}

// --- Planningboard employees (`/planningboard/employees`, session cookie) ---

export type PlanningboardLevel = {
  id: number
  name: string
  short_name: string
  external: boolean
}

export type PlanningboardTag = {
  id: number
  name: string
  category: { id: number; name: string } | null
}

export type PlanningboardLocation = {
  id: number
  name: string
}

export type PlanningboardPriceList = {
  id: number
  name: string
}

export type PlanningboardEmployee = {
  id: number
  level: PlanningboardLevel | null
  tags: PlanningboardTag[] | null
  location: PlanningboardLocation | null
  price_list: PlanningboardPriceList | null
  job_title: string | null
}

export type PlanningboardResponse = {
  code: number
  status: string
  data: PlanningboardEmployee[]
}

// --- Report endpoint (`/report/`, session cookie) ---

export type ReportItem = {
  project: { id: number }
  project_type: { id: number } | null
}

export type ReportResponse = {
  status: string
  data: ReportItem[]
}

// --- Derived / aggregate shapes ---

/** Per-person enrichment distilled from the planningboard response. */
export type PersonEnrichment = {
  level: string | null
  department: string | null
  position: string | null
  hierarchy: string | null
  office: string | null
  location: string | null
  price_list: string | null
  job_title: string | null
}

/** Everything a completed sync produces (also returned to the caller). */
export type SyncResult = {
  log: string[]
  persons: PersonEntry[]
  projects: ProjectEntry[]
  clients: ClientEntry[]
  types: ProjectTypeEntry[]
  levels: LevelEntry[]
}
