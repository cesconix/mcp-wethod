/**
 * Tool: get_weekly_plan
 *
 * Shows who is working on what this week by fetching allocation data
 * for a list of people and grouping by project. Useful for team
 * planning and visibility.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import {
  READONLY_ANNOTATIONS,
  WORK_HOURS_PER_DAY,
} from "../utils/constants.mjs"
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

export function registerGetWeeklyPlan(server: McpServer, client: WethodClient) {
  server.registerTool(
    "get_weekly_plan",
    {
      title: "Get Weekly Plan",
      description:
        "Show who is working on what this week from allocation data. For each person, lists projects with allocated hours and day equivalents. Defaults to the current week (Mon-Fri) if dates are not provided.",
      inputSchema: {
        person_ids: z
          .array(z.number().int())
          .describe("List of person IDs to query"),
        date_from: z
          .string()
          .optional()
          .describe("Start date YYYY-MM-DD (defaults to current week Monday)"),
        date_to: z
          .string()
          .optional()
          .describe("End date YYYY-MM-DD (defaults to current week Friday)"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const dateFrom = params.date_from ?? getCurrentWeekMonday()
        const dateTo = params.date_to ?? addDays(dateFrom, 4) // Friday

        // Fetch allocations for all persons in parallel
        const results = await Promise.all(
          params.person_ids.map(async (personId) => {
            const allocations = await client.request<Allocation[]>(
              "GET",
              "/api/people-allocations",
              {
                params: {
                  person_id: personId,
                  date: `gte:${dateFrom}`,
                  limit: 100,
                  offset: 0,
                },
              },
            )

            // Filter to date range and exclude soft-deleted
            const filtered = allocations.filter(
              (a) =>
                a.date >= dateFrom && a.date <= dateTo && a.deleted_at === null,
            )

            // Group by project and sum hours
            const projectHours = new Map<number, number>()
            for (const a of filtered) {
              projectHours.set(
                a.project_id,
                (projectHours.get(a.project_id) ?? 0) + a.hours,
              )
            }

            return { personId, projectHours }
          }),
        )

        // Format output
        const blocks: string[] = []

        for (const { personId, projectHours } of results) {
          const lines: string[] = [`Person ${personId}:`]

          if (projectHours.size === 0) {
            lines.push("  No allocations")
          } else {
            for (const [projectId, hours] of projectHours) {
              const days = Math.round((hours / WORK_HOURS_PER_DAY) * 10) / 10
              lines.push(`  Project ${projectId}: ${hours}h (${days} days)`)
            }
          }

          blocks.push(lines.join("\n"))
        }

        const text = `WEEKLY PLAN (${dateFrom} to ${dateTo})\n\n${blocks.join("\n\n")}`

        return {
          content: [{ type: "text" as const, text }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
