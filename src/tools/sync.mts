/**
 * Tool: sync
 *
 * Fetches reference data (persons, projects, clients) from the Wethod API
 * and writes local YAML cache files. These files are used by the lookup
 * tools (lookup_person, lookup_project, lookup_client) via DataLoader.
 *
 * Run this tool once before using lookup tools, or periodically to keep
 * the local cache fresh.
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { WethodClient } from "../utils/client.mjs"
import { WRITE_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError } from "../utils/format.mjs"

// --- API response types ---
// NOTE: Field names are based on observed Wethod API responses from the
// existing list-persons, list-projects, and list-clients tools. If the
// real API returns different shapes, adjust these types accordingly.

type ApiPerson = {
  id: number
  name: string
  surname: string
  is_external: boolean
  is_archived: boolean
}

type ApiProject = {
  id: number
  name: string
  job_order: string | null
  client_id: number
  pm_id: number | null
  is_archived: boolean
}

type ApiClient = {
  id: number
  corporate_name: string
}

// --- YAML generators ---
// These produce output that matches the exact regex patterns used by
// DataLoader in src/utils/data-loader.mts.

/**
 * Generates persons.yaml content.
 *
 * Format parsed by DataLoader:
 *   /^\s+(\d+):\s*\{\s*name:\s*"(.+?)",\s*surname:\s*"(.+?)",\s*is_external:\s*(true|false)\s*\}/
 */
export function generatePersonsYaml(persons: ApiPerson[]): string {
  const lines = ["persons:"]
  for (const p of persons) {
    lines.push(
      `  ${p.id}: { name: "${p.name}", surname: "${p.surname}", is_external: ${p.is_external} }`
    )
  }
  return lines.join("\n") + "\n"
}

/**
 * Generates projects.yaml content.
 *
 * Format parsed by DataLoader:
 *   id line: /^\s{2}(\d+):$/
 *   fields:  /^\s{4}name:\s*"(.+)"$/  etc.
 */
export function generateProjectsYaml(
  projects: ApiProject[],
  clientMap: Map<number, string>
): string {
  const lines = ["projects:"]
  for (const p of projects) {
    const clientName = clientMap.get(p.client_id) ?? "unknown"
    lines.push(`  ${p.id}:`)
    lines.push(`    name: "${p.name}"`)
    lines.push(`    job_order: ${p.job_order !== null ? `"${p.job_order}"` : "null"}`)
    lines.push(`    client: "${clientName}"`)
    lines.push(`    client_id: ${p.client_id ?? "null"}`)
    lines.push(`    pm_id: ${p.pm_id ?? "null"}`)
  }
  return lines.join("\n") + "\n"
}

/**
 * Generates clients.yaml content.
 *
 * Format parsed by DataLoader:
 *   /^\s+(\d+):\s*"(.+)"$/
 */
export function generateClientsYaml(clients: ApiClient[]): string {
  const lines = ["clients:"]
  for (const c of clients) {
    lines.push(`  ${c.id}: "${c.corporate_name}"`)
  }
  return lines.join("\n") + "\n"
}

// --- Pagination helper ---

async function fetchAllPages<T>(
  client: WethodClient,
  endpoint: string,
  pageSize = 100
): Promise<T[]> {
  const all: T[] = []
  let offset = 0

  while (true) {
    const page = await client.request<T[]>("GET", endpoint, {
      params: { limit: pageSize, offset }
    })
    all.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return all
}

// --- Tool registration ---

export function registerSync(
  server: McpServer,
  client: WethodClient,
  dataDir: string
) {
  server.registerTool(
    "sync",
    {
      title: "Sync Reference Data",
      description:
        "Fetches persons, projects, and clients from Wethod and saves them as local YAML cache files. Run this before using lookup tools, or to refresh stale data.",
      inputSchema: {},
      annotations: WRITE_ANNOTATIONS
    },
    async () => {
      try {
        // Fetch all data in parallel where possible.
        // Persons API does not support pagination (returns full list).
        // Projects and clients use limit/offset pagination.
        const [allPersons, allProjects, allClients] = await Promise.all([
          client.request<ApiPerson[]>("GET", "/api/persons"),
          fetchAllPages<ApiProject>(client, "/api/projects"),
          fetchAllPages<ApiClient>(client, "/api/clients")
        ])

        // Filter out archived persons and projects
        const persons = allPersons.filter((p) => !p.is_archived)
        const projects = allProjects.filter((p) => !p.is_archived)

        // Build client lookup map for project -> client name resolution
        const clientMap = new Map<number, string>()
        for (const c of allClients) {
          clientMap.set(c.id, c.corporate_name)
        }

        // Generate YAML content
        const personsYaml = generatePersonsYaml(persons)
        const projectsYaml = generateProjectsYaml(projects, clientMap)
        const clientsYaml = generateClientsYaml(allClients)

        // Ensure data directory exists and write files
        mkdirSync(dataDir, { recursive: true })
        writeFileSync(join(dataDir, "persons.yaml"), personsYaml, "utf-8")
        writeFileSync(join(dataDir, "projects.yaml"), projectsYaml, "utf-8")
        writeFileSync(join(dataDir, "clients.yaml"), clientsYaml, "utf-8")

        const summary = [
          `Sync complete. Saved to ${dataDir}/:`,
          `${persons.length} persons, ${projects.length} projects, ${allClients.length} clients`
        ].join(" ")

        return {
          content: [{ type: "text" as const, text: summary }]
        }
      } catch (error) {
        return formatToolError(error)
      }
    }
  )
}
