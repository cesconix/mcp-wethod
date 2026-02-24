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

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { WRITE_ANNOTATIONS } from "../utils/constants.mjs"
import type {
  ClientEntry,
  PersonEntry,
  ProjectEntry,
  ProjectTypeEntry,
} from "../utils/data-loader.mjs"
import { formatToolError } from "../utils/format.mjs"

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
): PersonEntry[] {
  return [...employees.values()]
    .map((e) => ({
      id: e.id,
      name: e.name,
      surname: e.surname,
      is_external: e.is_external,
    }))
    .sort((a, b) => a.id - b.id)
}

export function buildProjects(
  projects: Map<number, TimetrackingProject>,
  apiProjectMap: Map<number, { client_id: number; pm_id: number | null }>,
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

// --- Tool registration ---

export function registerSync(
  server: McpServer,
  client: WethodClient,
  dataDir: string,
  company: string,
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
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (params) => {
      try {
        const mondays = generateMondays()
        const log: string[] = []

        // --- Phase 1: Timetracking report (session cookie) ---

        const employeesMap = new Map<number, TimetrackingEmployee>()
        const projectsMap = new Map<number, TimetrackingProject>()
        let projectTypes: TimetrackingProjectType[] = []
        let failed = 0

        for (let i = 0; i < mondays.length; i++) {
          const monday = mondays[i]
          const response = await fetchWeek(monday, params.session_id, company)

          if (!response) {
            failed++
            continue
          }

          // Accumulate employees (deduplicate by id, last wins)
          for (const emp of response.data.employees) {
            const { timetrackings: _, ...person } = emp
            employeesMap.set(person.id, person)
          }

          // Accumulate projects (deduplicate by id, last wins)
          for (const proj of response.data.project) {
            projectsMap.set(proj.id, proj)
          }

          // Project types from first successful response
          if (projectTypes.length === 0 && response.data.project_types) {
            projectTypes = response.data.project_types
          }

          // Rate limit between requests
          if (i < mondays.length - 1) {
            await sleep(DELAY_MS)
          }
        }

        if (failed === mondays.length) {
          return formatToolError(
            new Error(
              "All requests failed. Check your SF6SESSID cookie — it may have expired.",
            ),
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
          { client_id: number; pm_id: number | null }
        >()
        for (const p of allApiProjects) {
          apiProjectMap.set(p.id, { client_id: p.client_id, pm_id: p.pm_id })
        }

        log.push(
          `Phase 2: ${allClients.length} clients, ${allApiProjects.length} projects from API`,
        )

        // --- Build data and write JSON files ---

        const persons = buildPersons(employeesMap)
        const projects = buildProjects(projectsMap, apiProjectMap, clientMap)
        const clients = buildClients(allClients)
        const types = buildProjectTypes(projectTypes)

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

        log.push(
          `Saved to ${dataDir}/: ${persons.length} persons, ${projects.length} projects, ${clients.length} clients, ${types.length} types`,
        )

        return {
          content: [{ type: "text" as const, text: log.join("\n") }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
