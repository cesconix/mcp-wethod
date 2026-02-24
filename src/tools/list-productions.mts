/**
 * Tool: list_productions
 *
 * Lists production entries from the Wethod API with optional filtering by
 * project, date, and pagination support. Filters out deleted entries.
 * Returns formatted text lines suitable for LLM consumption.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError } from "../utils/format.mjs"

type Production = {
  id: number
  date: string
  value: number
  project_id: number
  deleted_at: string | null
}

export function registerListProductions(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "list_productions",
    {
      title: "List Productions",
      description:
        "List production entries from Wethod. Shows actual production values by project and date. Useful for tracking revenue recognition.",
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
        const productions = await client.request<Production[]>(
          "GET",
          "/api/productions",
          {
            params: {
              limit: params.limit,
              offset: params.offset,
              project_id: params.project_id,
              date: params.date,
            },
          },
        )

        const active = productions.filter((p) => p.deleted_at === null)

        if (active.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No productions found." }],
          }
        }

        const lines = active.map((p) => {
          return `id: ${p.id} | Project ${p.project_id} | ${p.date} | value: ${p.value}`
        })

        const text = `Found ${active.length} production(s):\n\n${lines.join("\n")}`

        return {
          content: [{ type: "text" as const, text }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
