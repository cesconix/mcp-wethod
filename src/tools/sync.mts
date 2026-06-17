/**
 * Tool: sync
 *
 * Fetches reference data from Wethod using a 2-phase strategy:
 *
 * Phase 1 (session cookie): Iterates through weekly timetracking reports
 * to collect employees, projects, and project types.
 *
 * Phase 2 (API token): Fetches clients and project details from the public
 * API to enrich projects with client names and PM IDs.
 *
 * Output: 4 JSON files in ~/.mcp-wethod/{company}/
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { WRITE_ANNOTATIONS } from "../utils/constants.mjs"
import type {
  ClientEntry,
  DataLoader,
  LevelEntry,
  PersonEntry,
  ProjectEntry,
  ProjectTypeEntry,
} from "../utils/data-loader.mjs"
import { formatToolError, textResult } from "../utils/format.mjs"

// --- API response types ---

type ApiClient = {
  id: number
  corporate_name: string
}

type ApiProject = {
  id: number
  name: string
  job_order: string | null
  client_id: number
  pm_id: number | null
  is_archived: boolean
  project_type_id: number | null
}

// --- Timetracking report types ---

type TimetrackingEmployee = {
  id: number
  name: string
  surname: string
  is_external: boolean
  timetrackings?: unknown
}

type TimetrackingProject = {
  id: number
  name: string
  job_order: string | null
}

type TimetrackingProjectType = {
  id: number
  name: string
  chargeable: number
  hoursType: string
}

type TimetrackingResponse = {
  status: string
  data: {
    employees: TimetrackingEmployee[]
    project: TimetrackingProject[]
    project_types: TimetrackingProjectType[]
  }
}

// --- Planningboard employee types ---

type PlanningboardLevel = {
  id: number
  name: string
  short_name: string
  external: boolean
}

type PlanningboardTag = {
  id: number
  name: string
  category: { id: number; name: string } | null
}

type PlanningboardLocation = {
  id: number
  name: string
}

type PlanningboardPriceList = {
  id: number
  name: string
}

type PlanningboardEmployee = {
  id: number
  level: PlanningboardLevel | null
  tags: PlanningboardTag[] | null
  location: PlanningboardLocation | null
  price_list: PlanningboardPriceList | null
  job_title: string | null
}

type PlanningboardResponse = {
  code: number
  status: string
  data: PlanningboardEmployee[]
}

// --- Person enrichment ---

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

function extractTag(
  tags: PlanningboardTag[] | null,
  category: string,
): string | null {
  if (!tags) return null
  const tag = tags.find((t) => t.category?.name === category)
  return tag?.name ?? null
}

/** Fetch employees with level data from the planningboard endpoint. */
export async function fetchPlanningboardEmployees(
  sessionId: string,
  company: string,
): Promise<PlanningboardResponse | null> {
  try {
    const response = await fetch(
      "https://api.wethod.com/planningboard/employees",
      {
        headers: {
          cookie: `SF6SESSID=${sessionId}; companyHostname=${company}.wethod.com`,
          origin: `https://${company}.wethod.com`,
          referer: `https://${company}.wethod.com/`,
        },
      },
    )

    if (!response.ok) return null

    const json = (await response.json()) as PlanningboardResponse
    if (json.status !== "Ok") return null

    return json
  } catch {
    return null
  }
}

// --- Helpers ---

/** Generate all Mondays from Jan 1 of current year to current week's Monday. */
export function generateMondays(): string[] {
  const now = new Date()
  const year = now.getFullYear()
  const start = new Date(year, 0, 1)

  // Find first Monday of the year
  while (start.getDay() !== 1) {
    start.setDate(start.getDate() + 1)
  }

  // Find current week's Monday
  const today = new Date()
  const currentMonday = new Date(today)
  currentMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

  const mondays: string[] = []
  const d = new Date(start)
  while (d <= currentMonday) {
    mondays.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 7)
  }

  return mondays
}

/** Fetch a single week's timetracking report using session cookie auth. */
async function fetchWeek(
  monday: string,
  sessionId: string,
  company: string,
): Promise<TimetrackingResponse | null> {
  try {
    const response = await fetch(
      `https://api.wethod.com/report/timetracking/?date=${monday}`,
      {
        headers: {
          cookie: `SF6SESSID=${sessionId}; companyHostname=${company}.wethod.com`,
          origin: `https://${company}.wethod.com`,
          referer: `https://${company}.wethod.com/`,
        },
      },
    )

    if (!response.ok) return null

    const json = (await response.json()) as TimetrackingResponse
    if (json.status !== "Ok") return null

    return json
  } catch {
    return null
  }
}

// --- Report endpoint types ---

type ReportItem = {
  project: { id: number }
  project_type: { id: number } | null
}

type ReportResponse = {
  status: string
  data: ReportItem[]
}

/** Fetch project type mapping from /report/ endpoint using session cookie. */
export async function fetchReport(
  sessionId: string,
  company: string,
): Promise<Map<number, number>> {
  try {
    const response = await fetch("https://api.wethod.com/report/", {
      headers: {
        cookie: `SF6SESSID=${sessionId}; companyHostname=${company}.wethod.com`,
        origin: `https://${company}.wethod.com`,
        referer: `https://${company}.wethod.com/`,
      },
    })
    if (!response.ok) return new Map()
    const json = (await response.json()) as ReportResponse
    if (json.status !== "Ok") return new Map()

    const map = new Map<number, number>()
    for (const item of json.data) {
      if (item.project_type?.id != null) {
        map.set(item.project.id, item.project_type.id)
      }
    }
    return map
  } catch {
    return new Map()
  }
}

/** Paginated fetch from the public Wethod API. */
async function fetchAllPages<T>(
  client: WethodClient,
  endpoint: string,
  pageSize = 100,
): Promise<T[]> {
  const all: T[] = []
  let offset = 0

  while (true) {
    const page = await client.request<T[]>("GET", endpoint, {
      params: { limit: pageSize, offset },
    })
    all.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return all
}

const DELAY_MS = 2000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --- JSON builders ---

export function buildPersons(
  employees: Map<number, TimetrackingEmployee>,
  enrichmentByPersonId: Map<number, PersonEnrichment>,
): PersonEntry[] {
  return [...employees.values()]
    .map((e) => {
      const enrichment = enrichmentByPersonId.get(e.id)
      return {
        id: e.id,
        name: e.name,
        surname: e.surname,
        is_external: e.is_external,
        level: enrichment?.level ?? null,
        department: enrichment?.department ?? null,
        position: enrichment?.position ?? null,
        hierarchy: enrichment?.hierarchy ?? null,
        office: enrichment?.office ?? null,
        location: enrichment?.location ?? null,
        price_list: enrichment?.price_list ?? null,
        job_title: enrichment?.job_title ?? null,
      }
    })
    .sort((a, b) => a.id - b.id)
}

export function buildLevels(
  planningboardEmployees: PlanningboardEmployee[],
): LevelEntry[] {
  const seen = new Map<number, LevelEntry>()
  for (const emp of planningboardEmployees) {
    if (emp.level && !seen.has(emp.level.id)) {
      seen.set(emp.level.id, {
        id: emp.level.id,
        name: emp.level.name,
        short_name: emp.level.short_name,
      })
    }
  }
  return [...seen.values()].sort((a, b) => a.id - b.id)
}

export function buildProjects(
  projects: Map<number, TimetrackingProject>,
  apiProjectMap: Map<
    number,
    { client_id: number; pm_id: number | null; project_type_id: number | null }
  >,
  clientMap: Map<number, string>,
): ProjectEntry[] {
  return [...projects.values()]
    .map((p) => {
      const api = apiProjectMap.get(p.id)
      const clientId = api?.client_id ?? null
      return {
        id: p.id,
        name: p.name,
        job_order: p.job_order,
        client: clientId !== null ? (clientMap.get(clientId) ?? null) : null,
        client_id: clientId,
        pm_id: api?.pm_id ?? null,
        project_type_id: api?.project_type_id ?? null,
      }
    })
    .sort((a, b) => a.id - b.id)
}

export function buildClients(apiClients: ApiClient[]): ClientEntry[] {
  return apiClients
    .map((c) => ({ id: c.id, name: c.corporate_name }))
    .sort((a, b) => a.id - b.id)
}

export function buildProjectTypes(
  types: TimetrackingProjectType[],
): ProjectTypeEntry[] {
  return types
    .map((t) => ({
      id: t.id,
      name: t.name,
      chargeable: t.chargeable === 1,
      hours_type: t.hoursType,
    }))
    .sort((a, b) => a.id - b.id)
}

// --- Core sync logic (reusable by setup and sync tools) ---

export type SyncResult = {
  log: string[]
  persons: PersonEntry[]
  projects: ProjectEntry[]
  clients: ClientEntry[]
  types: ProjectTypeEntry[]
  levels: LevelEntry[]
}

/**
 * Performs the full sync operation and writes JSON files to disk.
 * Shared by both the `sync` tool and the `setup` tool.
 */
export async function performSync(options: {
  sessionId: string
  company: string
  client: WethodClient
  dataDir: string
  full?: boolean
}): Promise<SyncResult> {
  const { sessionId, company, client, dataDir, full } = options
  const allMondays = generateMondays()
  const lastSyncFile = join(dataDir, ".last-sync")
  let startMonday: string | null = null

  if (!full) {
    try {
      startMonday = readFileSync(lastSyncFile, "utf-8").trim()
    } catch {
      // No .last-sync file — fall through to full sync
    }
  }

  const mondays = startMonday
    ? allMondays.filter((m) => m >= startMonday)
    : allMondays

  const log: string[] = [
    startMonday ? `Incremental sync from ${startMonday}` : "Full sync",
  ]

  // --- Phase 1: Timetracking report (session cookie) ---

  const employeesMap = new Map<number, TimetrackingEmployee>()
  const projectsMap = new Map<number, TimetrackingProject>()
  let projectTypes: TimetrackingProjectType[] = []
  let failed = 0

  for (let i = 0; i < mondays.length; i++) {
    const monday = mondays[i]
    const response = await fetchWeek(monday, sessionId, company)

    if (!response) {
      failed++
      continue
    }

    for (const emp of response.data.employees) {
      const { timetrackings: _, ...person } = emp
      employeesMap.set(person.id, person)
    }

    for (const proj of response.data.project) {
      projectsMap.set(proj.id, proj)
    }

    if (projectTypes.length === 0 && response.data.project_types) {
      projectTypes = response.data.project_types
    }

    if (i < mondays.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  if (failed === mondays.length) {
    throw new Error(
      "All requests failed. Check your SF6SESSID cookie — it may have expired.",
    )
  }

  log.push(
    `Phase 1: ${mondays.length - failed}/${mondays.length} weeks OK, ${employeesMap.size} persons, ${projectsMap.size} projects, ${projectTypes.length} types`,
  )

  // --- Phase 2: Enrichment from public API ---

  const [allClients, allApiProjects] = await Promise.all([
    fetchAllPages<ApiClient>(client, "/api/clients"),
    fetchAllPages<ApiProject>(client, "/api/projects"),
  ])

  const clientMap = new Map<number, string>()
  for (const c of allClients) {
    clientMap.set(c.id, c.corporate_name)
  }

  const apiProjectMap = new Map<
    number,
    { client_id: number; pm_id: number | null; project_type_id: number | null }
  >()
  for (const p of allApiProjects) {
    apiProjectMap.set(p.id, {
      client_id: p.client_id,
      pm_id: p.pm_id,
      project_type_id: p.project_type_id ?? null,
    })
  }

  log.push(
    `Phase 2: ${allClients.length} clients, ${allApiProjects.length} projects from API`,
  )

  // --- Phase 2.5: Project type mapping from /report/ (session cookie) ---

  const reportTypeMap = await fetchReport(sessionId, company)
  let enriched = 0
  for (const [projectId, projectTypeId] of reportTypeMap) {
    const entry = apiProjectMap.get(projectId)
    if (entry && entry.project_type_id === null) {
      entry.project_type_id = projectTypeId
      enriched++
    }
  }

  log.push(
    `Phase 2.5: ${reportTypeMap.size} project type mappings from /report/, ${enriched} projects enriched`,
  )

  // --- Phase 3: Employee enrichment from planningboard (session cookie) ---

  const planningboard = await fetchPlanningboardEmployees(sessionId, company)
  const planningboardEmployees = planningboard?.data ?? []
  const enrichmentByPersonId = new Map<number, PersonEnrichment>()
  for (const emp of planningboardEmployees) {
    enrichmentByPersonId.set(emp.id, {
      level: emp.level?.short_name ?? null,
      department: extractTag(emp.tags, "Department"),
      position: extractTag(emp.tags, "Position"),
      hierarchy: extractTag(emp.tags, "Hierarchy"),
      office: extractTag(emp.tags, "Office"),
      location: emp.location?.name ?? null,
      price_list: emp.price_list?.name ?? null,
      job_title: emp.job_title ?? null,
    })
  }

  log.push(
    `Phase 3: ${planningboardEmployees.length} employees from planningboard, ${enrichmentByPersonId.size} enriched`,
  )

  // --- Build data and write JSON files ---

  const persons = buildPersons(employeesMap, enrichmentByPersonId)
  const projects = buildProjects(projectsMap, apiProjectMap, clientMap)
  const clients = buildClients(allClients)
  const types = buildProjectTypes(projectTypes)
  const levels = buildLevels(planningboardEmployees)

  mkdirSync(dataDir, { recursive: true })
  writeFileSync(
    join(dataDir, "persons.json"),
    JSON.stringify(persons, null, 2),
    "utf-8",
  )
  writeFileSync(
    join(dataDir, "projects.json"),
    JSON.stringify(projects, null, 2),
    "utf-8",
  )
  writeFileSync(
    join(dataDir, "clients.json"),
    JSON.stringify(clients, null, 2),
    "utf-8",
  )
  writeFileSync(
    join(dataDir, "project-types.json"),
    JSON.stringify(types, null, 2),
    "utf-8",
  )
  writeFileSync(
    join(dataDir, "levels.json"),
    JSON.stringify(levels, null, 2),
    "utf-8",
  )

  writeFileSync(lastSyncFile, mondays[mondays.length - 1], "utf-8")

  log.push(
    `Saved to ${dataDir}/: ${persons.length} persons, ${projects.length} projects, ${clients.length} clients, ${types.length} types, ${levels.length} levels`,
  )

  return { log, persons, projects, clients, types, levels }
}

// --- Tool registration ---

export function registerSync(
  server: McpServer,
  client: WethodClient,
  dataDir: string,
  company: string,
  data: DataLoader,
) {
  server.registerTool(
    "sync",
    {
      title: "Sync Reference Data",
      description:
        "Fetches persons, projects, clients, and project types from Wethod and saves them as local JSON cache files. Requires a session ID (SF6SESSID cookie from browser DevTools → Application → Cookies → api.wethod.com). Run this before using lookup tools, or to refresh stale data.",
      inputSchema: {
        session_id: z
          .string()
          .describe(
            "SF6SESSID cookie value from browser DevTools (Application → Cookies → api.wethod.com)",
          ),
        full: z
          .boolean()
          .optional()
          .describe(
            "Force a full re-sync from Jan 1 of the current year. Defaults to false (incremental from last sync).",
          ),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (params) => {
      try {
        const result = await performSync({
          sessionId: params.session_id,
          company,
          client,
          dataDir,
          full: params.full,
        })

        data.invalidate()

        return textResult(result.log.join("\n"))
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
