/**
 * Tool: get_billability_report
 *
 * Calculates billability percentage for one or more people over a date range.
 * Cross-references timesheet entries with project type chargeability from
 * local cache to determine billable vs non-billable hours.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import type { DataLoader } from "../utils/data-loader.mjs"
import { fetchAllTimesheets } from "../utils/fetch-all-timesheets.mjs"
import { formatToolError } from "../utils/format.mjs"

export function registerGetBillabilityReport(
  server: McpServer,
  client: WethodClient,
  data: DataLoader,
) {
  server.registerTool(
    "get_billability_report",
    {
      title: "Get Billability Report",
      description:
        "Calculate billability percentage for multiple people over a date range. Cross-references timesheet hours with project type chargeability. Shows per-person breakdown with billable vs non-billable hours by project.",
      inputSchema: {
        person_ids: z
          .array(z.number().int())
          .describe("List of person IDs to query"),
        date_from: z
          .string()
          .describe("Start date YYYY-MM-DD (inclusive)"),
        date_to: z
          .string()
          .describe("End date YYYY-MM-DD (inclusive)"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const projects = data.getProjects()
        const projectTypes = data.getProjectTypes()

        // Fetch timesheets for all persons in parallel
        const results = await Promise.all(
          params.person_ids.map(async (personId) => {
            const timesheets = await fetchAllTimesheets(client, {
              person_id: personId,
              date_gte: params.date_from,
            })

            // Filter to date range (API only supports gte, so filter upper bound client-side)
            const filtered = timesheets.filter(
              (ts) => ts.date <= params.date_to,
            )

            // Group hours by project
            const projectHours = new Map<number, number>()
            for (const ts of filtered) {
              projectHours.set(
                ts.project_id,
                (projectHours.get(ts.project_id) ?? 0) + ts.hours,
              )
            }

            // Determine chargeability for each project
            type ProjectBreakdown = {
              projectId: number
              name: string
              hours: number
              chargeable: boolean | null
            }

            const breakdown: ProjectBreakdown[] = []
            let billableHours = 0
            let totalHours = 0

            for (const [projectId, hours] of projectHours) {
              totalHours += hours

              const project = projects.get(projectId)
              const projectTypeId = project?.project_type_id ?? null
              const projectType =
                projectTypeId !== null
                  ? projectTypes.get(projectTypeId)
                  : undefined

              const chargeable = projectType?.chargeable ?? null
              if (chargeable === true) {
                billableHours += hours
              }

              breakdown.push({
                projectId,
                name: data.projectName(projectId),
                hours,
                chargeable,
              })
            }

            // Sort breakdown: chargeable first, then non-chargeable, then unknown
            breakdown.sort((a, b) => {
              const order = (v: boolean | null) =>
                v === true ? 0 : v === false ? 1 : 2
              return order(a.chargeable) - order(b.chargeable)
            })

            return { personId, totalHours, billableHours, breakdown }
          }),
        )

        // Format output
        const blocks: string[] = []

        for (const { personId, totalHours, billableHours, breakdown } of results) {
          const personName = data.personName(personId)

          if (totalHours === 0) {
            blocks.push(`${personName}: no timesheets in this period`)
            continue
          }

          const pct = Math.round((billableHours / totalHours) * 100)
          const lines: string[] = [
            `${personName}: ${billableHours}/${totalHours}h billable (${pct}%)`,
          ]

          for (const entry of breakdown) {
            const tag =
              entry.chargeable === true
                ? "chargeable"
                : entry.chargeable === false
                  ? "non-chargeable"
                  : "unknown"
            lines.push(`  ${entry.name}: ${entry.hours}h (${tag})`)
          }

          blocks.push(lines.join("\n"))
        }

        const text = `BILLABILITY REPORT (${params.date_from} to ${params.date_to})\n\n${blocks.join("\n\n")}`

        return {
          content: [{ type: "text" as const, text }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
