/**
 * Tool: get_availability
 *
 * Shows how loaded each person is for a given week. Compares allocated
 * hours against the standard 40h work week and reports utilization
 * percentage and available capacity.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS, WEEK_TOTAL_HOURS } from "../utils/constants.mjs"
import { addDays, getCurrentWeekMonday } from "../utils/date.mjs"
import { formatToolError } from "../utils/format.mjs"

type Allocation = {
  id: number
  date: string
  hours: number
  project_id: number
  person_id: number
  deleted_at: string | null
}

export function registerGetAvailability(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "get_availability",
    {
      title: "Get Availability",
      description:
        "Show how loaded each person is for a given week. Compares allocated hours to the standard 40h work week and reports utilization percentage and available capacity. Defaults to the current week if week_start is not provided.",
      inputSchema: {
        person_ids: z
          .array(z.number().int())
          .describe("List of person IDs to query"),
        week_start: z
          .string()
          .optional()
          .describe(
            "Monday date of the week to check (YYYY-MM-DD). Defaults to current week.",
          ),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const weekMonday = params.week_start ?? getCurrentWeekMonday()
        const weekFriday = addDays(weekMonday, 4)

        // Fetch allocations for all persons in parallel
        const results = await Promise.all(
          params.person_ids.map(async (personId) => {
            const allocations = await client.request<Allocation[]>(
              "GET",
              "/api/people-allocations",
              {
                params: {
                  person_id: personId,
                  date: `gte:${weekMonday}`,
                  limit: 100,
                  offset: 0,
                },
              },
            )

            // Filter to Mon-Fri range and exclude soft-deleted
            const filtered = allocations.filter(
              (a) =>
                a.date >= weekMonday &&
                a.date <= weekFriday &&
                a.deleted_at === null,
            )

            const totalHours = filtered.reduce((sum, a) => sum + a.hours, 0)
            return { personId, totalHours }
          }),
        )

        // Format output
        const lines: string[] = [`AVAILABILITY — Week of ${weekMonday}`, ""]

        for (const { personId, totalHours } of results) {
          const available = Math.max(0, WEEK_TOTAL_HOURS - totalHours)
          const utilization = Math.round((totalHours / WEEK_TOTAL_HOURS) * 100)

          const availPart =
            available === 0 ? "fully booked" : `${available}h available`

          lines.push(
            `Person ${personId}: ${totalHours}/${WEEK_TOTAL_HOURS}h allocated (${utilization}%) — ${availPart}`,
          )
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
