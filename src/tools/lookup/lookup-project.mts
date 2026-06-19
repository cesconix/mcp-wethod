/**
 * Tool: lookup_project
 *
 * Looks up a project by ID or searches by name from local JSON data.
 * No API call — reads from ~/.mcp-wethod/{company}/projects.json.
 * Includes client name and PM name resolved from local data.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { READONLY_ANNOTATIONS } from "../../utils/constants.mjs"
import type { DataLoader } from "../../utils/data-loader.mjs"
import { textResult } from "../../utils/format.mjs"

function formatProject(
  p: {
    id: number
    name: string
    job_order: string | null
    client: string | null
    client_id: number | null
    pm_id: number | null
  },
  data: DataLoader,
): string {
  const parts = [`${p.id}: ${p.name}`]
  if (p.client) parts.push(`client: ${p.client}`)
  if (p.job_order) parts.push(`job_order: ${p.job_order}`)
  if (p.pm_id) parts.push(`pm: ${data.personName(p.pm_id)}`)
  return parts.join(" | ")
}

export function registerLookupProject(server: McpServer, data: DataLoader) {
  server.registerTool(
    "lookup_project",
    {
      title: "Lookup Project",
      description:
        "Find a project by ID or search by name. Reads from local synced data (no API call). Returns id, name, client, job_order, pm.",
      inputSchema: {
        id: z
          .number()
          .int()
          .optional()
          .describe("Project ID for direct lookup"),
        search: z
          .string()
          .optional()
          .describe(
            "Search query to filter by project name or client name (case-insensitive)",
          ),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      const projects = data.getProjects()

      if (projects.size === 0) {
        return textResult(
          "SYNC REQUIRED: Project data not found. Run the sync tool to populate local data.",
        )
      }

      // Direct ID lookup
      if (params.id !== undefined) {
        const p = projects.get(params.id)
        if (!p) {
          return textResult(`Project ${params.id} not found.`)
        }
        return textResult(formatProject(p, data))
      }

      // Search by name or client
      if (params.search) {
        const query = params.search.toLowerCase()
        const matches = [...projects.values()].filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.client?.toLowerCase().includes(query),
        )

        if (matches.length === 0) {
          return textResult(`No project matching "${params.search}".`)
        }

        const lines = matches.map((p) => formatProject(p, data))
        return textResult(lines.join("\n"))
      }

      return textResult(
        `${projects.size} projects available. Provide id or search.`,
      )
    },
  )
}
