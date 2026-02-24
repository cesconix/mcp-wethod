/**
 * Tool: create_timesheet
 *
 * Creates a new timesheet entry. Validates that the daily hour limit (8h)
 * will not be exceeded by fetching existing entries for the same person
 * and date before writing. Requires explicit confirmation.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { WORK_HOURS_PER_DAY, WRITE_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError } from "../utils/format.mjs"

type Timesheet = {
  id: number
  date: string
  hours: number
  notes: string | null
  mode: string
  project_id: number
  person_id: number
}

export function registerCreateTimesheet(
  server: McpServer,
  client: WethodClient
) {
  server.registerTool(
    "create_timesheet",
    {
      title: "Create Timesheet",
      description:
        "Create a new timesheet entry. Requires confirm=true. Before creating, validates that adding the hours will not exceed the 8h daily limit. The 'date' must be a Monday (YYYY-MM-DD). Use the project_id from list_timesheets or list_projects.",
      inputSchema: {
        person_id: z
          .number()
          .int()
          .describe("ID of the person to create the timesheet for"),
        date: z
          .string()
          .describe("Date of the week (must be a Monday, YYYY-MM-DD format)"),
        day: z
          .enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])
          .describe("Day of the week"),
        hours: z
          .number()
          .positive()
          .max(WORK_HOURS_PER_DAY)
          .describe(`Hours worked (max ${WORK_HOURS_PER_DAY}h per day)`),
        project_id: z.number().int().describe("Project ID"),
        notes: z.string().optional().describe("Optional notes"),
        confirm: z
          .boolean()
          .describe(
            "Must be true to execute. Show a recap and get user confirmation first."
          )
      },
      annotations: WRITE_ANNOTATIONS
    },
    async (params) => {
      try {
        if (!params.confirm) {
          return {
            isError: true as const,
            content: [
              {
                type: "text" as const,
                text: "Operation not confirmed. You must show a recap to the user and get confirmation before setting confirm=true."
              }
            ]
          }
        }

        // Fetch existing timesheets for the same person + date to validate hours
        const existing = await client.request<Timesheet[]>(
          "GET",
          "/api/timesheets",
          {
            params: {
              person_id: params.person_id,
              date: params.date
            }
          }
        )

        const existingHours = existing.reduce((sum, ts) => sum + ts.hours, 0)
        const totalHours = existingHours + params.hours

        if (totalHours > WORK_HOURS_PER_DAY) {
          return {
            isError: true as const,
            content: [
              {
                type: "text" as const,
                text: `Cannot create: adding ${params.hours}h would exceed the daily limit.\nExisting hours for ${params.date}: ${existingHours}h\nTotal would be: ${totalHours}h (limit: ${WORK_HOURS_PER_DAY}h)`
              }
            ]
          }
        }

        const timesheet = await client.request<Timesheet>(
          "POST",
          "/api/timesheets",
          {
            body: {
              date: params.date,
              day: params.day,
              hours: params.hours,
              project_id: params.project_id,
              person_id: params.person_id,
              mode: "DAILY",
              notes: params.notes
            }
          }
        )

        const remaining = WORK_HOURS_PER_DAY - totalHours
        const statusLine =
          remaining > 0
            ? `Remaining for ${params.date}: ${remaining}h`
            : `Day ${params.date} is now complete (${WORK_HOURS_PER_DAY}/${WORK_HOURS_PER_DAY}h)`

        const text = [
          "Timesheet created successfully.",
          "",
          `ID: ${timesheet.id}`,
          `Date: ${timesheet.date} (${params.day})`,
          `Hours: ${timesheet.hours}h`,
          `Project: ${timesheet.project_id}`,
          `Notes: ${timesheet.notes ?? "N/A"}`,
          "",
          statusLine
        ].join("\n")

        return {
          content: [{ type: "text" as const, text }]
        }
      } catch (error) {
        return formatToolError(error)
      }
    }
  )
}
