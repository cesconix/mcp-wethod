/**
 * Tool: update_timesheet
 *
 * Updates an existing timesheet entry. Only the provided fields (hours
 * and/or notes) are sent in the PATCH request. Requires explicit
 * confirmation.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { WORK_HOURS_PER_DAY, WRITE_ANNOTATIONS } from "../utils/constants.mjs"
import { errorText, formatToolError, textResult } from "../utils/format.mjs"

type Timesheet = {
  id: number
  date: string
  hours: number
  notes: string | null
  mode: string
  project_id: number
  person_id: number
}

export function registerUpdateTimesheet(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "update_timesheet",
    {
      title: "Update Timesheet",
      description:
        "Update an existing timesheet entry by ID. Only hours and/or notes can be changed. Requires confirm=true.",
      inputSchema: {
        id: z.number().int().describe("Timesheet ID to update"),
        hours: z
          .number()
          .positive()
          .max(WORK_HOURS_PER_DAY)
          .optional()
          .describe(`New hours value (max ${WORK_HOURS_PER_DAY}h)`),
        notes: z.string().optional().describe("New notes value"),
        confirm: z
          .boolean()
          .describe(
            "Must be true to execute. Show a recap and get user confirmation first.",
          ),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (params) => {
      try {
        if (!params.confirm) {
          return errorText(
            "Operation not confirmed. You must show a recap to the user and get confirmation before setting confirm=true.",
          )
        }

        // Build body with only the fields that were provided
        const body: Record<string, unknown> = {}
        if (params.hours !== undefined) body.hours = params.hours
        if (params.notes !== undefined) body.notes = params.notes

        if (Object.keys(body).length === 0) {
          return errorText(
            "Nothing to update. Provide at least one of: hours, notes.",
          )
        }

        const timesheet = await client.request<Timesheet>(
          "PATCH",
          `/api/timesheets/${params.id}`,
          { body },
        )

        const text = [
          "Timesheet updated successfully.",
          "",
          `ID: ${timesheet.id}`,
          `Date: ${timesheet.date}`,
          `Hours: ${timesheet.hours}h`,
          `Project: ${timesheet.project_id}`,
          `Notes: ${timesheet.notes ?? "N/A"}`,
        ].join("\n")

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
