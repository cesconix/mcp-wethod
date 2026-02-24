/**
 * Tool: list_production_plans
 *
 * Lists production plan entries from the Wethod API with optional filtering
 * by project, date, and pagination support. Filters out deleted entries.
 * Returns formatted text lines suitable for LLM consumption.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError } from "../utils/format.mjs"

type ProductionPlan = {
  id: number
  date: string
  value: number
  project_id: number
  deleted_at: string | null
}

export function registerListProductionPlans(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "list_production_plans",
    {
      title: "List Production Plans",
      description:
        "List production plan entries from Wethod. Shows planned production values by project and date. Compare with actual productions to track variance.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(100)
          .describe("Maximum results to return (1-100, default: 100)"),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Number of results to skip for pagination"),
        project_id: z
          .number()
          .int()
          .optional()
          .describe("Filter by project ID"),
        date: z
          .string()
          .optional()
          .describe("Date filter with operator (e.g. 'gt:2026-01-01')"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const plans = await client.request<ProductionPlan[]>(
          "GET",
          "/api/production-plans",
          {
            params: {
              limit: params.limit,
              offset: params.offset,
              project_id: params.project_id,
              date: params.date,
            },
          },
        )

        const active = plans.filter((p) => p.deleted_at === null)

        if (active.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No production plans found." },
            ],
          }
        }

        const lines = active.map((p) => {
          return `id: ${p.id} | Project ${p.project_id} | ${p.date} | planned: ${p.value}`
        })

        const text = `Found ${active.length} production plan(s):\n\n${lines.join("\n")}`

        return {
          content: [{ type: "text" as const, text }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
