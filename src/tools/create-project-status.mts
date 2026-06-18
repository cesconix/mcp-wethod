/**
 * Tool: create_project_status
 *
 * Creates a weekly project status (remaining-days mode). The `days_left`
 * value can be passed explicitly or computed automatically from the
 * project's baseline budget and its logged timesheet hours:
 *
 *   days_left = budget.total_days − (Σ hours through end of week) / 8
 *
 * Requires confirm=true. When confirm is false the tool returns a recap
 * (including the resolved days_left) so the user can approve the exact
 * value before anything is written.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { WRITE_ANNOTATIONS } from "../utils/constants.mjs"
import { addDays, isMonday } from "../utils/date.mjs"
import { fetchAllProjectTimesheets } from "../utils/fetch-all-timesheets.mjs"
import { errorText, formatToolError, textResult } from "../utils/format.mjs"
import {
  computeDaysLeft,
  hoursToDays,
  sumHoursOnOrBefore,
  toApiDaysLeft,
} from "../utils/project-status-compute.mjs"
import type { Budget, ProjectStatus } from "../utils/schemas.mjs"

type Resolved = {
  daysLeft: number
  /** Present only when days_left was auto-computed. */
  detail?: {
    totalDays: number
    consumedHours: number
    consumedDays: number
    weekEnd: string
  }
}

export function registerCreateProjectStatus(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "create_project_status",
    {
      title: "Create Project Status",
      description:
        "Create a weekly project status in remaining-days mode. 'date' must be a Monday (YYYY-MM-DD). If 'days_left' is omitted it is auto-computed from the project's baseline budget minus logged timesheet days through the end of that week. Requires confirm=true: call once with confirm=false to get a recap (with the resolved days_left), show it to the user, then call again with confirm=true.",
      inputSchema: {
        project_id: z.number().int().describe("Project ID"),
        date: z
          .string()
          .describe("Week start (must be a Monday, YYYY-MM-DD format)"),
        days_left: z
          .number()
          .optional()
          .describe(
            "Remaining budget days. If omitted, auto-computed from budget − timesheet.",
          ),
        notes: z.string().optional().describe("Optional notes"),
        project_status_risk_id: z
          .number()
          .int()
          .optional()
          .describe("Optional project status risk ID"),
        confirm: z
          .boolean()
          .describe(
            "Must be true to execute. Show the recap to the user and get confirmation first.",
          ),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (params) => {
      try {
        if (!isMonday(params.date)) {
          return errorText(
            `Date ${params.date} is not a Monday. Project statuses are weekly and must start on a Monday.`,
          )
        }

        // Resolve days_left: explicit value, or auto-compute from budget + timesheet.
        const resolved = await resolveDaysLeft(client, params)

        // Recap-before-write: surface the resolved value, do not write yet.
        if (!params.confirm) {
          return errorText(recapText(params, resolved))
        }

        const created = await client.request<ProjectStatus>(
          "POST",
          "/api/project-statuses",
          {
            body: {
              project_id: params.project_id,
              date: params.date,
              // Wethod requires an integer days_left (fractional → 400).
              days_left: toApiDaysLeft(resolved.daysLeft),
              notes: params.notes,
              project_status_risk_id: params.project_status_risk_id,
            },
          },
        )

        const text = [
          "Project status created successfully.",
          "",
          `ID: ${created.id}`,
          `Project: ${created.project_id}`,
          `Date: ${created.date}`,
          `Days left: ${created.days_left ?? resolved.daysLeft}`,
          `Progress: ${created.progress ?? "N/A"}% (derived by Wethod)`,
          `Notes: ${created.notes ?? "N/A"}`,
        ].join("\n")

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}

/** Resolves days_left from an explicit value or by computing it from the API. */
async function resolveDaysLeft(
  client: WethodClient,
  params: { project_id: number; date: string; days_left?: number },
): Promise<Resolved> {
  if (params.days_left !== undefined) {
    return { daysLeft: params.days_left }
  }

  const budgets = await client.request<Budget[]>("GET", "/api/budgets", {
    params: { project_id: params.project_id },
  })
  const baseline = budgets.find((b) => b.is_baseline) ?? budgets[0]
  if (!baseline) {
    throw new Error(
      `No budget found for project ${params.project_id}; cannot auto-compute days_left. Pass days_left explicitly.`,
    )
  }

  const weekEnd = addDays(params.date, 6)
  const timesheets = await fetchAllProjectTimesheets(client, {
    project_id: params.project_id,
  })
  const consumedHours = sumHoursOnOrBefore(timesheets, weekEnd)
  const daysLeft = computeDaysLeft(baseline.total_days, consumedHours)

  return {
    daysLeft,
    detail: {
      totalDays: baseline.total_days,
      consumedHours,
      consumedDays: hoursToDays(consumedHours),
      weekEnd,
    },
  }
}

function recapText(
  params: {
    project_id: number
    date: string
    notes?: string
    project_status_risk_id?: number
  },
  resolved: Resolved,
): string {
  const written = toApiDaysLeft(resolved.daysLeft)
  const daysLeftLine =
    written === resolved.daysLeft
      ? `Days left (written): ${written}`
      : `Days left (written): ${written} (computed ${resolved.daysLeft})`
  const lines = [
    "RECAP — about to create a project status (not yet written).",
    "",
    `Project: ${params.project_id}`,
    `Week (Monday): ${params.date}`,
    daysLeftLine,
  ]

  if (resolved.detail) {
    const d = resolved.detail
    lines.push(
      `  ↳ auto-computed: ${d.totalDays} budget days − ${d.consumedHours}h (${d.consumedDays}d) logged through ${d.weekEnd}`,
    )
  } else {
    lines.push("  ↳ provided explicitly")
  }

  if (params.notes) lines.push(`Notes: ${params.notes}`)
  if (params.project_status_risk_id !== undefined) {
    lines.push(`Risk: ${params.project_status_risk_id}`)
  }

  lines.push("", "Call again with confirm=true to write it.")
  return lines.join("\n")
}
