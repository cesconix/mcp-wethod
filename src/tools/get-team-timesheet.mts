/**
 * Tool: get_team_timesheet
 *
 * Checks timesheet completion status for multiple people for a given
 * week. Designed for the timesheet-reminder skill — quickly shows who
 * has completed their timesheets and who is behind.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import {
  READONLY_ANNOTATIONS,
  WORK_HOURS_PER_DAY,
} from "../utils/constants.mjs"
import { addDays, getCurrentWeekMonday, isTodayOrPast } from "../utils/date.mjs"
import { fetchAllTimesheets } from "../utils/fetch-all-timesheets.mjs"
import { formatToolError, textResult } from "../utils/format.mjs"

const WORK_DAYS = ["mon", "tue", "wed", "thu", "fri"] as const

export function registerGetTeamTimesheet(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "get_team_timesheet",
    {
      title: "Get Team Timesheet",
      description:
        "Check timesheet completion status for multiple people for a given week. Reports per person: total hours entered, expected hours (up to today), missing hours, and status. Useful for timesheet reminders. Defaults to the current week if week_start is not provided.",
      inputSchema: {
        person_ids: z
          .array(z.number().int())
          .describe("List of person IDs to check"),
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
        const weekEnd = addDays(weekMonday, 6)

        // Determine how many workdays to consider (up to today)
        let daysConsidered = 0
        for (let i = 0; i < 5; i++) {
          const dayDate = addDays(weekMonday, i)
          if (isTodayOrPast(dayDate)) daysConsidered++
        }
        const expectedHours = daysConsidered * WORK_HOURS_PER_DAY

        // Fetch timesheets for all persons in parallel
        const results = await Promise.all(
          params.person_ids.map(async (personId) => {
            const timesheets = await fetchAllTimesheets(client, {
              person_id: personId,
              date_gte: weekMonday,
            })

            // Filter to just this week (Mon through Sun)
            const weekTimesheets = timesheets.filter(
              (ts) => ts.date >= weekMonday && ts.date <= weekEnd,
            )

            // Build hours per day
            const hoursMap = new Map<string, number>()
            for (const ts of weekTimesheets) {
              hoursMap.set(ts.date, (hoursMap.get(ts.date) ?? 0) + ts.hours)
            }

            // Calculate totals and find incomplete days
            let totalHours = 0
            const incompleteDays: string[] = []

            for (let i = 0; i < 5; i++) {
              const dayDate = addDays(weekMonday, i)
              if (!isTodayOrPast(dayDate)) continue

              const hours = hoursMap.get(dayDate) ?? 0
              totalHours += hours

              if (hours < WORK_HOURS_PER_DAY) {
                incompleteDays.push(WORK_DAYS[i])
              }
            }

            return { personId, totalHours, incompleteDays }
          }),
        )

        // Format output
        const lines: string[] = [`TEAM TIMESHEET — Week of ${weekMonday}`, ""]

        for (const { personId, totalHours, incompleteDays } of results) {
          const missing = expectedHours - totalHours

          if (missing <= 0) {
            lines.push(
              `Person ${personId}: ${totalHours}/${expectedHours}h — complete`,
            )
          } else if (totalHours === 0) {
            lines.push(`Person ${personId}: 0/${expectedHours}h — not started`)
          } else {
            const daysList = incompleteDays.join(", ")
            lines.push(
              `Person ${personId}: ${totalHours}/${expectedHours}h — ${missing}h missing (${daysList} incomplete)`,
            )
          }
        }

        return textResult(lines.join("\n"))
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
