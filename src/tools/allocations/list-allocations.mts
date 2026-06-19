/**
 * Tool: list_allocations
 *
 * Lists people allocations with optional filters for person, project,
 * and date range. Resolves person and project names via DataLoader
 * for human-readable output.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { fetchAllocations } from "../../utils/allocations.mjs"
import type { WethodClient } from "../../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../../utils/constants.mjs"
import type { DataLoader } from "../../utils/data-loader.mjs"
import { formatDate, formatToolError, textResult } from "../../utils/format.mjs"
import { paginationSchema } from "../../utils/schemas.mjs"

export function registerListAllocations(
  server: McpServer,
  client: WethodClient,
  data: DataLoader,
) {
  server.registerTool(
    "list_allocations",
    {
      title: "List Allocations",
      description:
        "List people allocations with filters for person, project, and date range. Returns formatted text with date, hours, project name, and allocation ID. Useful for checking who is allocated where and finding gaps in schedules.",
      inputSchema: {
        person_id: z
          .number()
          .int()
          .describe("ID of the person whose allocations to query"),
        project_id: z
          .number()
          .int()
          .optional()
          .describe("Filter by project ID"),
        date_from: z
          .string()
          .optional()
          .describe(
            "Start date filter YYYY-MM-DD (inclusive). Defaults to today.",
          ),
        date_to: z
          .string()
          .optional()
          .describe("End date filter YYYY-MM-DD (inclusive)"),
        ...paginationSchema,
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const allocations = await fetchAllocations(client, {
          person_id: params.person_id,
          project_id: params.project_id,
          date_from: params.date_from,
          date_to: params.date_to,
          limit: params.limit,
          offset: params.offset,
        })

        if (allocations.length === 0) {
          return textResult("No allocations found.")
        }

        const personName = data.personName(params.person_id)

        const lines = allocations.map((a) => {
          const datePart = formatDate(a.date)
          const project = data.projectName(a.project_id)
          return `${datePart} | ${a.hours}h | ${project} | id:${a.id}`
        })

        const text = `Allocations for ${personName} (${allocations.length} entries):\n\n${lines.join("\n")}`

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
