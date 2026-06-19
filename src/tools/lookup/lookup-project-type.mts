/**
 * Tool: lookup_project_type
 *
 * Looks up a project type by ID or searches by name from local JSON data.
 * No API call — reads from ~/.mcp-wethod/{company}/project-types.json.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { READONLY_ANNOTATIONS } from "../../utils/constants.mjs"
import type { DataLoader } from "../../utils/data-loader.mjs"
import { textResult } from "../../utils/format.mjs"

export function registerLookupProjectType(server: McpServer, data: DataLoader) {
  server.registerTool(
    "lookup_project_type",
    {
      title: "Lookup Project Type",
      description:
        "Find a project type by ID or search by name. Reads from local synced data (no API call). Returns id, name, chargeable, hours_type.",
      inputSchema: {
        id: z
          .number()
          .int()
          .optional()
          .describe("Project type ID for direct lookup"),
        search: z
          .string()
          .optional()
          .describe(
            "Search query to filter by project type name (case-insensitive)",
          ),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      const types = data.getProjectTypes()

      if (types.size === 0) {
        return textResult(
          "SYNC REQUIRED: Project type data not found. Run the sync tool to populate local data.",
        )
      }

      if (params.id !== undefined) {
        const t = types.get(params.id)
        if (!t) {
          return textResult(`Project type ${params.id} not found.`)
        }
        return textResult(
          `${t.id}: ${t.name} | chargeable: ${t.chargeable} | hours_type: ${t.hours_type}`,
        )
      }

      if (params.search) {
        const query = params.search.toLowerCase()
        const matches = [...types.values()].filter((t) =>
          t.name.toLowerCase().includes(query),
        )

        if (matches.length === 0) {
          return textResult(`No project type matching "${params.search}".`)
        }

        const lines = matches.map(
          (t) =>
            `${t.id}: ${t.name} | chargeable: ${t.chargeable} | hours_type: ${t.hours_type}`,
        )
        return textResult(lines.join("\n"))
      }

      return textResult(
        `${types.size} project types available. Provide id or search.`,
      )
    },
  )
}
