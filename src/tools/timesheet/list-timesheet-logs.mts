/**
 * Tool: list_timesheet_logs
 *
 * Lists timesheet change logs from the Wethod API with optional filtering
 * by person, project, date, and pagination support. Returns formatted text
 * lines suitable for LLM consumption.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../../utils/constants.mjs"
import { formatToolError, textResult } from "../../utils/format.mjs"
import { paginationSchema } from "../../utils/schemas.mjs"

type TimesheetLog = {
  id: number
  person_id: number
  date: string
  project_id: number
  to_project_id: number | null
  mode: string
  from_hours: number
  to_hours: number
  author_id: number
}

export function registerListTimesheetLogs(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "list_timesheet_logs",
    {
      title: "List Timesheet Logs",
      description:
        "List timesheet change logs from Wethod. Shows who modified timesheets, when, and what changed. Useful for auditing timesheet entries.",
      inputSchema: {
        ...paginationSchema,
        person_id: z.number().int().optional().describe("Filter by person ID"),
        project_id: z
          .number()
          .int()
          .optional()
          .describe("Filter by project ID"),
        date: z
          .string()
          .optional()
          .describe("Date filter with operator (e.g. 'gt:2026-01-01')"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const logs = await client.request<TimesheetLog[]>(
          "GET",
          "/api/timesheet-logs",
          {
            params: {
              limit: params.limit,
              offset: params.offset,
              person_id: params.person_id,
              project_id: params.project_id,
              date: params.date,
            },
          },
        )

        if (logs.length === 0) {
          return textResult("No timesheet logs found.")
        }

        const lines = logs.map((l) => {
          return `id: ${l.id} | Person ${l.person_id} | ${l.date} | ${l.from_hours}h \u2192 ${l.to_hours}h | Project ${l.project_id} | by ${l.author_id}`
        })

        const text = `Found ${logs.length} timesheet log(s):\n\n${lines.join("\n")}`

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
