/**
 * Tool: backfill_project_statuses
 *
 * Backfills weekly project statuses for one project across a range of weeks
 * (e.g. Jan→May). For each Monday in [date_from, date_to] it computes
 *
 *   days_left = budget.total_days − (Σ timesheet hours through end of week) / 8
 *
 * and creates the corresponding status. Existing weeks are skipped by default
 * (set overwrite=true to delete-and-recreate them).
 *
 * Safety: dry_run is true by default — the tool previews the full plan and
 * writes nothing. To execute, set dry_run=false AND confirm=true.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { WRITE_ANNOTATIONS } from "../utils/constants.mjs"
import { isMonday } from "../utils/date.mjs"
import { fetchAllProjectTimesheets } from "../utils/fetch-all-timesheets.mjs"
import { errorText, formatToolError, textResult } from "../utils/format.mjs"
import { fetchAllPages } from "../utils/paginate.mjs"
import {
  type BackfillPlanRow,
  mondaysInRange,
  planBackfill,
  toApiDaysLeft,
} from "../utils/project-status-compute.mjs"

type Budget = {
  total_days: number
  is_baseline: boolean
}

type ProjectStatus = {
  id: number
  date: string
  deleted_at?: string | null
}

/** Fetches all live (non-soft-deleted) project statuses for a project. */
async function fetchExistingStatuses(
  client: WethodClient,
  projectId: number,
): Promise<ProjectStatus[]> {
  const all = await fetchAllPages<ProjectStatus>(
    client,
    "/api/project-statuses",
    { project_id: projectId },
  )
  return all.filter((s) => !s.deleted_at)
}

export function registerBackfillProjectStatuses(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "backfill_project_statuses",
    {
      title: "Backfill Project Statuses",
      description:
        "Backfill weekly project statuses for one project across a range of Mondays. For each week, days_left is computed from the baseline budget minus logged timesheet days through that week. Existing weeks are skipped unless overwrite=true. SAFETY: dry_run defaults to true (previews the plan, writes nothing); to execute set dry_run=false AND confirm=true. date_from and date_to must both be Mondays (YYYY-MM-DD).",
      inputSchema: {
        project_id: z.number().int().describe("Project ID to backfill"),
        date_from: z
          .string()
          .describe("First week (Monday, YYYY-MM-DD), inclusive"),
        date_to: z
          .string()
          .describe("Last week (Monday, YYYY-MM-DD), inclusive"),
        overwrite: z
          .boolean()
          .default(false)
          .describe(
            "If true, delete-and-recreate weeks that already have a status. Default false = skip existing.",
          ),
        dry_run: z
          .boolean()
          .default(true)
          .describe(
            "If true (default), only preview the plan; nothing is written.",
          ),
        confirm: z
          .boolean()
          .default(false)
          .describe(
            "Required together with dry_run=false to actually write. Show the plan first.",
          ),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (params) => {
      try {
        // --- Validate range ---
        if (!isMonday(params.date_from)) {
          return errorText(`date_from ${params.date_from} is not a Monday.`)
        }
        if (!isMonday(params.date_to)) {
          return errorText(`date_to ${params.date_to} is not a Monday.`)
        }
        if (params.date_from > params.date_to) {
          return errorText(
            `date_from ${params.date_from} is after date_to ${params.date_to}.`,
          )
        }

        // --- Gather inputs (read-only) ---
        const budgets = await client.request<Budget[]>("GET", "/api/budgets", {
          params: { project_id: params.project_id },
        })
        const baseline = budgets.find((b) => b.is_baseline) ?? budgets[0]
        if (!baseline) {
          return errorText(
            `No budget found for project ${params.project_id}; cannot backfill.`,
          )
        }

        const timesheets = await fetchAllProjectTimesheets(client, {
          project_id: params.project_id,
        })
        const existing = await fetchExistingStatuses(client, params.project_id)
        const existingIds: Record<string, number> = {}
        for (const s of existing) {
          existingIds[s.date] = s.id
        }

        // --- Build the plan (pure) ---
        const weeks = mondaysInRange(params.date_from, params.date_to)
        const plan = planBackfill({
          totalDays: baseline.total_days,
          timesheets,
          weeks,
          existingIds,
          overwrite: params.overwrite,
        })

        const counts = {
          create: plan.filter((p) => p.action === "create").length,
          overwrite: plan.filter((p) => p.action === "overwrite").length,
          skip: plan.filter((p) => p.action === "skip").length,
        }

        const willWrite = !params.dry_run && params.confirm
        const header = params.dry_run
          ? "DRY RUN — preview only, nothing written."
          : params.confirm
            ? "EXECUTING backfill."
            : "RECAP — set dry_run=false and confirm=true to execute."

        // --- Preview / recap path ---
        if (!willWrite) {
          return textResult(
            renderPlan(params, baseline.total_days, plan, counts, header),
          )
        }

        // --- Execute path (sequential; gentle on the API) ---
        const results = {
          created: 0,
          overwritten: 0,
          skipped: counts.skip,
          errors: [] as string[],
        }
        for (const row of plan) {
          if (row.action === "skip") continue
          try {
            // Replace semantics: drop the old status before writing the new one.
            if (row.action === "overwrite" && row.existingId !== undefined) {
              await client.request(
                "DELETE",
                `/api/project-statuses/${row.existingId}`,
              )
            }
            await client.request("POST", "/api/project-statuses", {
              body: {
                project_id: params.project_id,
                date: row.week,
                // Wethod requires an integer days_left (fractional → 400).
                days_left: toApiDaysLeft(row.daysLeft),
              },
            })
            if (row.action === "overwrite") results.overwritten++
            else results.created++
          } catch (e) {
            results.errors.push(
              `${row.week}: ${e instanceof Error ? e.message : String(e)}`,
            )
          }
        }

        const summary = [
          "Backfill complete.",
          "",
          `Project: ${params.project_id}`,
          `Range: ${params.date_from} → ${params.date_to} (${plan.length} weeks)`,
          `Created: ${results.created}`,
          `Overwritten: ${results.overwritten}`,
          `Skipped (already present): ${results.skipped}`,
          `Errors: ${results.errors.length}`,
        ]
        if (results.errors.length > 0) {
          summary.push(
            "",
            "Failed weeks:",
            ...results.errors.map((e) => `  - ${e}`),
          )
        }
        return textResult(summary.join("\n"))
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}

function renderPlan(
  params: { project_id: number; date_from: string; date_to: string },
  totalDays: number,
  plan: BackfillPlanRow[],
  counts: { create: number; overwrite: number; skip: number },
  header: string,
): string {
  const lines = [
    header,
    "",
    `Project: ${params.project_id} | baseline budget: ${totalDays} days`,
    `Range: ${params.date_from} → ${params.date_to} (${plan.length} weeks)`,
    `Plan: ${counts.create} create, ${counts.overwrite} overwrite, ${counts.skip} skip`,
    "",
    "Week (Mon) | days_left (written) | consumed | action",
    "-----------|---------------------|----------|-------",
  ]
  for (const p of plan) {
    const flag = p.daysLeft < 0 ? " ⚠️over" : ""
    const written = toApiDaysLeft(p.daysLeft)
    // Show the integer that will actually be POSTed; surface the precise
    // value in parens when rounding changed it.
    const value =
      written === p.daysLeft ? `${written}` : `${written} (${p.daysLeft})`
    lines.push(
      `${p.week} | ${value}${flag} | ${p.consumedHours}h | ${p.action}`,
    )
  }
  if (counts.create + counts.overwrite > 0) {
    lines.push(
      "",
      "To execute: call again with dry_run=false and confirm=true.",
    )
  }
  return lines.join("\n")
}
