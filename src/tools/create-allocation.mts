/**
 * Tool: create_allocation
 *
 * Creates people allocation entries. Supports two modes:
 * - Single date: creates one allocation
 * - Date range: creates allocations for all weekdays (Mon-Fri) in the range
 *
 * Always uses the authenticated user's person_id. Validates the 8h daily
 * limit before creating. Requires explicit confirmation.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { Allocation } from "../utils/allocations.mjs"
import { fetchAllocations } from "../utils/allocations.mjs"
import type { WethodClient } from "../utils/client.mjs"
import { WORK_HOURS_PER_DAY, WRITE_ANNOTATIONS } from "../utils/constants.mjs"
import type { DataLoader } from "../utils/data-loader.mjs"
import { getWeekdaysInRange } from "../utils/date.mjs"
import { formatToolError } from "../utils/format.mjs"

export function registerCreateAllocation(
  server: McpServer,
  client: WethodClient,
  data: DataLoader,
  personId: number,
) {
  server.registerTool(
    "create_allocation",
    {
      title: "Create Allocation",
      description:
        "Create people allocation entries for yourself. Two modes: (1) single date — provide 'date', or (2) date range — provide 'date_from' and 'date_to' to allocate all weekdays Mon-Fri in the range. Validates the 8h daily limit. Requires confirm=true.",
      inputSchema: {
        date: z
          .string()
          .optional()
          .describe(
            "Single date YYYY-MM-DD. Use this OR date_from+date_to, not both.",
          ),
        date_from: z
          .string()
          .optional()
          .describe(
            "Range start YYYY-MM-DD (inclusive). Must be used with date_to.",
          ),
        date_to: z
          .string()
          .optional()
          .describe(
            "Range end YYYY-MM-DD (inclusive). Must be used with date_from.",
          ),
        hours: z
          .number()
          .int()
          .min(1)
          .max(WORK_HOURS_PER_DAY)
          .describe(`Hours per day (1-${WORK_HOURS_PER_DAY})`),
        project_id: z.number().int().describe("Project ID"),
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
          return {
            isError: true as const,
            content: [
              {
                type: "text" as const,
                text: "Operation not confirmed. Show a recap and get user confirmation first.",
              },
            ],
          }
        }

        // Determine target dates
        let dates: string[]
        if (params.date) {
          dates = [params.date]
        } else if (params.date_from && params.date_to) {
          dates = getWeekdaysInRange(params.date_from, params.date_to)
        } else {
          return {
            isError: true as const,
            content: [
              {
                type: "text" as const,
                text: "Provide either 'date' for a single day, or both 'date_from' and 'date_to' for a range.",
              },
            ],
          }
        }

        if (dates.length === 0) {
          return {
            isError: true as const,
            content: [
              {
                type: "text" as const,
                text: "No weekdays found in the specified range.",
              },
            ],
          }
        }

        const projectName = data.projectName(params.project_id)
        const results: {
          date: string
          ok: boolean
          id?: number
          error?: string
        }[] = []

        // Batch-fetch existing allocations for the entire range (1 API call instead of N)
        const existingAllocations = await fetchAllocations(client, {
          person_id: personId,
          date_from: dates[0],
          date_to: dates[dates.length - 1],
        })

        const hoursByDate = new Map<string, number>()
        for (const a of existingAllocations) {
          hoursByDate.set(a.date, (hoursByDate.get(a.date) ?? 0) + a.hours)
        }

        // Execute all creates in parallel
        await Promise.all(
          dates.map(async (date) => {
            try {
              // Check 8h daily limit
              const existing = hoursByDate.get(date) ?? 0
              if (existing + params.hours > WORK_HOURS_PER_DAY) {
                results.push({
                  date,
                  ok: false,
                  error: `would exceed daily limit (existing: ${existing}h, requested: ${params.hours}h, limit: ${WORK_HOURS_PER_DAY}h)`,
                })
                return
              }

              const allocation = await client.request<Allocation>(
                "POST",
                "/api/people-allocations",
                {
                  body: {
                    person_id: personId,
                    project_id: params.project_id,
                    date,
                    hours: params.hours,
                  },
                },
              )

              results.push({ date, ok: true, id: allocation.id })
            } catch (error) {
              results.push({
                date,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              })
            }
          }),
        )

        // Sort by date for readable output
        results.sort((a, b) => a.date.localeCompare(b.date))

        const created = results.filter((r) => r.ok)
        const failed = results.filter((r) => !r.ok)
        const totalHours = created.length * params.hours

        const lines: string[] = [
          `Created ${created.length}/${dates.length} allocation(s) for ${projectName} at ${params.hours}h/day (${totalHours}h total).`,
        ]

        if (failed.length > 0) {
          lines.push("")
          lines.push("Errors:")
          for (const f of failed) {
            lines.push(`  ${f.date}: ${f.error}`)
          }
        }

        return {
          isError: failed.length > 0 && created.length === 0,
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
