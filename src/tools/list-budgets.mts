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
import { formatToolError, textResult } from "../utils/format.mjs"
import { BudgetSchema } from "../utils/schemas.mjs"

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
        const budgets = await client.request("GET", "/api/budgets", {
          params: {
            limit: params.limit,
            offset: params.offset,
            project_id: params.project_id,
          },
          schema: z.array(BudgetSchema),
        })

        if (budgets.length === 0) {
          return textResult("No budgets found.")
        }

        const lines = budgets.map((b) => {
          return `id: ${b.id} | Project ${b.project_id} | ${b.status} | ${b.total_days} days | cost: ${b.total_cost} | price: ${b.total_price} | net: ${b.final_net_price}`
        })

        const text = `Found ${budgets.length} budget(s):\n\n${lines.join("\n")}`

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
