/**
 * Tool: list_timesheets
 *
 * Lists timesheet entries for a given person, with optional filters for
 * project, date, and pagination. Returns formatted text lines suitable
 * for LLM consumption.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import { formatDate, formatToolError, textResult } from "../utils/format.mjs"
import { TimesheetSchema } from "../utils/schemas.mjs"

export function registerListTimesheets(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "list_timesheets",
    {
      title: "List Timesheets",
      description:
        "List timesheet entries for a person. Supports filtering by project, date (with operator, e.g. 'gt:2026-01-01'), and pagination. Returns formatted text with date, hours, project ID, timesheet ID, and notes.",
      inputSchema: {
        person_id: z
          .number()
          .int()
          .describe("ID of the person whose timesheets to query"),
        project_id: z
          .number()
          .int()
          .optional()
          .describe("Filter by project ID"),
        date: z
          .string()
          .optional()
          .describe("Date filter with operator (e.g. 'gt:2026-01-01')"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(100)
          .describe("Maximum results to return (1-100, default: 100)"),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Number of results to skip for pagination"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const timesheets = await client.request("GET", "/api/timesheets", {
          params: {
            person_id: params.person_id,
            project_id: params.project_id,
            date: params.date,
            limit: params.limit,
            offset: params.offset,
          },
          schema: z.array(TimesheetSchema),
        })

        if (timesheets.length === 0) {
          return textResult("No timesheets found.")
        }

        const lines = timesheets.map((ts) => {
          const datePart = formatDate(ts.date)
          const notesPart = ts.notes ? ` | ${ts.notes}` : ""
          return `${datePart} | ${ts.hours}h | project:${ts.project_id} | id:${ts.id}${notesPart}`
        })

        const text = `Found ${timesheets.length} timesheet(s):\n\n${lines.join("\n")}`

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
