/**
 * Tool: get_billability
 *
 * Calculates billability (chargeability) for one or more people over a date
 * range. For each person it fetches their timesheet entries, determines
 * whether each project is chargeable using local synced data, and reports
 * billable, non-billable, and unknown hours together with a billability %.
 *
 * "Unknown" hours are entries whose project has no project_type_id in local
 * data. Run sync to improve coverage.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import type { DataLoader } from "../utils/data-loader.mjs"
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

/** Fetch all timesheet entries for a person in the given date range. */
async function fetchTimesheets(
  client: WethodClient,
  personId: number,
  dateFrom: string,
  dateTo: string,
): Promise<Timesheet[]> {
  const pageSize = 100
  const all: Timesheet[] = []
  let offset = 0

  while (true) {
    const page = await client.request<Timesheet[]>("GET", "/api/timesheets", {
      params: {
        person_id: personId,
        date: `gte:${dateFrom}T00:00:00+00:00`,
        limit: pageSize,
        offset,
      },
    })

    // Keep only entries within the requested range
    const inRange = page.filter(
      (ts) => ts.date >= dateFrom && ts.date <= dateTo,
    )
    all.push(...inRange)

    // Stop when the page returned fewer than pageSize results
    if (page.length < pageSize) break
    offset += pageSize
  }

  return all
}

export function registerGetBillability(
  server: McpServer,
  client: WethodClient,
  data: DataLoader,
) {
  server.registerTool(
    "get_billability",
    {
      title: "Get Billability",
      description:
        "Calculate billability (chargeability) for one or more people over a date range. Returns billable, non-billable, and unknown hours per person, plus billability %. Requires synced project data to resolve project types — run sync first if results show many 'unknown' hours.",
      inputSchema: {
        person_ids: z
          .array(z.number().int())
          .describe("List of person IDs to analyse"),
        date_from: z.string().describe("Start date (YYYY-MM-DD, inclusive)"),
        date_to: z.string().describe("End date (YYYY-MM-DD, inclusive)"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const results = await Promise.all(
          params.person_ids.map(async (personId) => {
            const timesheets = await fetchTimesheets(
              client,
              personId,
              params.date_from,
              params.date_to,
            )

            let billable = 0
            let nonBillable = 0
            let unknown = 0

            for (const ts of timesheets) {
              const chargeable = data.isProjectChargeable(ts.project_id)
              if (chargeable === null) {
                unknown += ts.hours
              } else if (chargeable) {
                billable += ts.hours
              } else {
                nonBillable += ts.hours
              }
            }

            return { personId, billable, nonBillable, unknown }
          }),
        )

        const lines: string[] = [
          `BILLABILITY — ${params.date_from} to ${params.date_to}`,
          "",
        ]

        for (const { personId, billable, nonBillable, unknown } of results) {
          const total = billable + nonBillable + unknown
          const known = billable + nonBillable

          // Billability % excludes unknown hours (they don't penalise the rate)
          const rate = known > 0 ? Math.round((billable / known) * 100) : null

          lines.push(`Person ${personId}:`)
          lines.push(`  Billable:     ${billable}h`)
          lines.push(`  Non-billable: ${nonBillable}h`)

          if (unknown > 0) {
            lines.push(`  Unknown:      ${unknown}h  ← run sync to resolve`)
          }

          lines.push(`  Total logged: ${total}h`)

          if (rate !== null) {
            lines.push(`  Billability:  ${rate}% (excl. unknown)`)
          } else {
            lines.push("  Billability:  n/a (no classifiable hours)")
          }

          lines.push("")
        }

        return {
          content: [
            { type: "text" as const, text: lines.join("\n").trimEnd() },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
