/**
 * Core sync orchestration, shared by the `sync` and `setup` tools.
 *
 * Three phases:
 *  1. Session cookie — iterate weekly timetracking reports to collect
 *     employees, projects, and project types.
 *  2. API token — fetch clients and project details to enrich projects with
 *     client names, PM ids, and project types.
 *  3. Session cookie — planningboard enrichment (levels, tags, location).
 *
 * Writes five JSON cache files to `dataDir` and returns the built data.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { WethodClient } from "../utils/client.mjs"
import { fetchAllPages } from "../utils/paginate.mjs"
import {
  buildClients,
  buildLevels,
  buildPersons,
  buildProjects,
  buildProjectTypes,
  extractTag,
} from "./builders.mjs"
import type {
  ApiClient,
  ApiProject,
  PersonEnrichment,
  SyncResult,
  TimetrackingEmployee,
  TimetrackingProject,
  TimetrackingProjectType,
} from "./types.mjs"
import {
  fetchPlanningboardEmployees,
  fetchReport,
  fetchWeek,
} from "./wethod-session.mjs"

const DELAY_MS = 2000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Generate all Mondays from Jan 1 of the current year to this week's Monday. */
function generateMondays(): string[] {
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
