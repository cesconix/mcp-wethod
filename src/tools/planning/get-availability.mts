/**
 * Tool: get_availability
 *
 * Shows how loaded each person is for a given week. Compares allocated
 * hours against the standard 40h work week and reports utilization
 * percentage and available capacity.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { fetchAllocations } from "../../utils/allocations.mjs"
import type { WethodClient } from "../../utils/client.mjs"
import {
  READONLY_ANNOTATIONS,
  WEEK_TOTAL_HOURS,
} from "../../utils/constants.mjs"
import type { DataLoader } from "../../utils/data-loader.mjs"
import { addDays, getCurrentWeekMonday } from "../../utils/date.mjs"
import { formatToolError, textResult } from "../../utils/format.mjs"

export function registerGetAvailability(
  server: McpServer,
  client: WethodClient,
  data: DataLoader,
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
            const allocations = await fetchAllocations(client, {
              person_id: personId,
              date_from: weekMonday,
              date_to: weekFriday,
            })

            const totalHours = allocations.reduce((sum, a) => sum + a.hours, 0)
            return { personId, totalHours }
          }),
        )

        // Format output
        const lines: string[] = [`AVAILABILITY — Week of ${weekMonday}`, ""]

        for (const { personId, totalHours } of results) {
          const personName = data.personName(personId)
          const available = Math.max(0, WEEK_TOTAL_HOURS - totalHours)
          const utilization = Math.round((totalHours / WEEK_TOTAL_HOURS) * 100)

          const availPart =
            available === 0 ? "fully booked" : `${available}h available`

          lines.push(
            `${personName}: ${totalHours}/${WEEK_TOTAL_HOURS}h allocated (${utilization}%) — ${availPart}`,
          )
        }

        return textResult(lines.join("\n"))
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
