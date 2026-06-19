/**
 * Tool: lookup_person
 *
 * Looks up a person by ID or searches by name from local JSON data.
 * No API call — reads from ~/.mcp-wethod/{company}/persons.json.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { READONLY_ANNOTATIONS } from "../../utils/constants.mjs"
import type { DataLoader, PersonEntry } from "../../utils/data-loader.mjs"
import { textResult } from "../../utils/format.mjs"

function formatPerson(p: PersonEntry): string {
  const parts = [`${p.id}: ${p.name} ${p.surname}`]
  if (p.is_external) parts.push("(external)")
  const details = [
    p.level,
    p.position,
    p.department,
    p.hierarchy,
    p.office,
    p.location,
    p.job_title,
    p.price_list,
  ].filter(Boolean)
  if (details.length > 0) parts.push(`| ${details.join(" | ")}`)
  return parts.join(" ")
}

export function registerLookupPerson(server: McpServer, data: DataLoader) {
  server.registerTool(
    "lookup_person",
    {
      title: "Lookup Person",
      description:
        "Find a person by ID or search by name/surname. Reads from local synced data (no API call). Returns id, name, surname, is_external, level, department, position, hierarchy, office, location, price_list, job_title.",
      inputSchema: {
        id: z.number().int().optional().describe("Person ID for direct lookup"),
        search: z
          .string()
          .optional()
          .describe(
            "Search query to filter by name, surname, department, position, office, or location (case-insensitive)",
          ),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      const persons = data.getPersons()

      if (persons.size === 0) {
        return textResult(
          "SYNC REQUIRED: Person data not found. Run the sync tool to populate local data.",
        )
      }

      // Direct ID lookup
      if (params.id !== undefined) {
        const p = persons.get(params.id)
        if (!p) {
          return textResult(`Person ${params.id} not found.`)
        }
        return textResult(formatPerson(p))
      }

      // Search by name and enrichment fields
      if (params.search) {
        const query = params.search.toLowerCase()
        const matches = [...persons.values()].filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.surname.toLowerCase().includes(query) ||
            `${p.name} ${p.surname}`.toLowerCase().includes(query) ||
            p.department?.toLowerCase().includes(query) ||
            p.position?.toLowerCase().includes(query) ||
            p.office?.toLowerCase().includes(query) ||
            p.location?.toLowerCase().includes(query),
        )

        if (matches.length === 0) {
          return textResult(`No person matching "${params.search}".`)
        }

        const lines = matches.map((p) => formatPerson(p))
        return textResult(lines.join("\n"))
      }

      return textResult(
        `${persons.size} persons available. Provide id or search.`,
      )
    },
  )
}
