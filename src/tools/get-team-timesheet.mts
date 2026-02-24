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

const WORK_DAYS = ["lun", "mar", "mer", "gio", "ven"] as const

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
            const timesheets = await client.request<Timesheet[]>(
              "GET",
              "/api/timesheets",
              {
                params: {
                  person_id: personId,
                  date: `gte:${weekMonday}`,
                },
              },
            )

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
              `Person ${personId}: ${totalHours}/${expectedHours}h — ${missing}h missing (${daysList} incompleti)`,
            )
          }
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
