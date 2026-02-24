/**
 * Tool: list_budgets
 *
 * Lists project budgets from the Wethod API with optional filtering by
 * project and pagination support. Returns formatted text lines suitable
 * for LLM consumption.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError } from "../utils/format.mjs"

type Budget = {
  id: number
  project_id: number
  status: string
  version: number
  total_days: number
  total_cost: number
  total_price: number
  final_net_price: number
  total_external_cost: number
  is_baseline: boolean
  notes: string | null
}

export function registerListBudgets(server: McpServer, client: WethodClient) {
  server.registerTool(
    "list_budgets",
    {
      title: "List Budgets",
      description:
        "List project budgets from Wethod. Returns budget status, total days, costs, and prices per project.",
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
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const budgets = await client.request<Budget[]>("GET", "/api/budgets", {
          params: {
            limit: params.limit,
            offset: params.offset,
            project_id: params.project_id,
          },
        })

        if (budgets.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No budgets found." }],
          }
        }

        const lines = budgets.map((b) => {
          return `id: ${b.id} | Project ${b.project_id} | ${b.status} | ${b.total_days} days | cost: ${b.total_cost} | price: ${b.total_price} | net: ${b.final_net_price}`
        })

        const text = `Found ${budgets.length} budget(s):\n\n${lines.join("\n")}`

        return {
          content: [{ type: "text" as const, text }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
