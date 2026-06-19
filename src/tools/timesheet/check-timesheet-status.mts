/**
 * Tool: check_timesheet_status
 *
 * Checks timesheet completeness for a given person and week. Fetches all
 * entries for the week, calculates hours per day (Mon-Fri, 8h expected),
 * and reports total hours, missing hours, and incomplete days.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../../utils/client.mjs"
import {
  READONLY_ANNOTATIONS,
  WORK_HOURS_PER_DAY,
} from "../../utils/constants.mjs"
import {
  addDays,
  getCurrentWeekMonday,
  isTodayOrPast,
} from "../../utils/date.mjs"
import { fetchAllTimesheets } from "../../utils/fetch-all-timesheets.mjs"
import {
  formatHours,
  formatToolError,
  textResult,
} from "../../utils/format.mjs"

const WORK_DAYS = ["mon", "tue", "wed", "thu", "fri"] as const

export function registerCheckTimesheetStatus(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "check_timesheet_status",
    {
      title: "Check Timesheet Status",
      description:
        "Check timesheet completeness for a person for a given week. Reports total hours, missing hours, and incomplete days. Defaults to the current week if week_start is not provided.",
      inputSchema: {
        person_id: z
          .number()
          .int()
          .describe("ID of the person whose timesheet to check"),
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

        // Fetch timesheets for the week
        const timesheets = await fetchAllTimesheets(client, {
          person_id: params.person_id,
          date_gte: weekMonday,
        })

        // Filter to just this week (Mon through Sun)
        const weekEnd = addDays(weekMonday, 6)
        const weekTimesheets = timesheets.filter(
          (ts) => ts.date >= weekMonday && ts.date <= weekEnd,
        )

        // Build hours map: date -> total hours
        const hoursMap = new Map<string, number>()
        for (const ts of weekTimesheets) {
          hoursMap.set(ts.date, (hoursMap.get(ts.date) ?? 0) + ts.hours)
        }

        // Analyse each workday (Mon-Fri)
        const dayDetails: string[] = []
        const incompleteDays: string[] = []
        let totalHours = 0
        let daysConsidered = 0

        for (let i = 0; i < 5; i++) {
          const dayDate = addDays(weekMonday, i)
          const dayName = WORK_DAYS[i]

          // Only count days that are today or in the past
          if (!isTodayOrPast(dayDate)) continue

          daysConsidered++
          const hours = hoursMap.get(dayDate) ?? 0
          totalHours += hours
          const missing = WORK_HOURS_PER_DAY - hours

          const status = missing > 0 ? `MISSING ${missing}h` : "OK"
          dayDetails.push(
            `${dayName.toUpperCase()} (${dayDate}): ${formatHours(hours, WORK_HOURS_PER_DAY)} ${status}`,
          )

          if (missing > 0) {
            incompleteDays.push(`${dayName} (${dayDate}): ${missing}h missing`)
          }
        }

        const expectedHours = daysConsidered * WORK_HOURS_PER_DAY
        const missingHours = expectedHours - totalHours
        const isComplete = missingHours <= 0

        const lines: string[] = [`TIMESHEET STATUS - Week of ${weekMonday}`, ""]

        if (isComplete) {
          lines.push(
            `Timesheet complete! (${totalHours}/${expectedHours}h)`,
            "",
          )
        } else {
          lines.push(
            `Missing ${missingHours}h out of ${expectedHours}h expected.`,
            "",
          )
        }

        lines.push("Daily breakdown:", ...dayDetails, "")
        lines.push(`Total: ${totalHours}/${expectedHours}h`)

        if (incompleteDays.length > 0) {
          lines.push("", "Incomplete days:", ...incompleteDays)
        }

        return textResult(lines.join("\n"))
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
