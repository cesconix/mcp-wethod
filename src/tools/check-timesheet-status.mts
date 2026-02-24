/**
 * Tool: check_timesheet_status
 *
 * Checks timesheet completeness for a given person and week. Fetches all
 * entries for the week, calculates hours per day (Mon-Fri, 8h expected),
 * and reports total hours, missing hours, and incomplete days.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import {
  READONLY_ANNOTATIONS,
  WORK_HOURS_PER_DAY,
} from "../utils/constants.mjs"
import { formatHours, formatToolError } from "../utils/format.mjs"

type Timesheet = {
  id: number
  date: string
  hours: number
  notes: string | null
  mode: string
  project_id: number
  person_id: number
}

const WORK_DAYS = ["mon", "tue", "wed", "thu", "fri"] as const

/**
 * Returns the Monday of the current week as a YYYY-MM-DD string.
 */
function getCurrentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return formatISODate(monday)
}

/**
 * Formats a Date as YYYY-MM-DD.
 */
function formatISODate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Adds N days to a YYYY-MM-DD string and returns YYYY-MM-DD.
 */
function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + n)
  return formatISODate(d)
}

/**
 * Returns true if the date is today or in the past.
 */
function isTodayOrPast(dateStr: string): boolean {
  const today = formatISODate(new Date())
  return dateStr <= today
}

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
        const timesheets = await client.request<Timesheet[]>(
          "GET",
          "/api/timesheets",
          {
            params: {
              person_id: params.person_id,
              date: `gte:${weekMonday}`,
            },
          },
        )

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

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
