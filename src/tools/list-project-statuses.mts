/**
 * Tool: list_project_statuses
 *
 * Lists project statuses from the Wethod API with optional filtering by
 * project and pagination support.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError, textResult } from "../utils/format.mjs"

type ProjectStatus = {
  id: number
  project_id: number
  date: string
  days_left: number | null
  progress: number | null
  notes: string | null
  project_status_risk_id: number | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export function registerListProjectStatuses(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "list_project_statuses",
    {
      title: "List Project Statuses",
      description:
        "List project statuses from Wethod. Filter by project_id and paginate. Each status reports days_left or progress for a given Monday.",
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
        const statuses = await client.request<ProjectStatus[]>(
          "GET",
          "/api/project-statuses",
          {
            params: {
              limit: params.limit,
              offset: params.offset,
              project_id: params.project_id,
            },
          },
        )

        if (statuses.length === 0) {
          return textResult("No project statuses found.")
        }

        const lines = statuses.map((s) => {
          const metric =
            s.days_left !== null && s.days_left !== undefined
              ? `days_left: ${s.days_left}`
              : `progress: ${s.progress ?? "N/A"}%`
          const risk =
            s.project_status_risk_id !== null &&
            s.project_status_risk_id !== undefined
              ? ` | risk: ${s.project_status_risk_id}`
              : ""
          return `id: ${s.id} | Project ${s.project_id} | ${s.date} | ${metric}${risk}`
        })

        const text = `Found ${statuses.length} project status(es):\n\n${lines.join("\n")}`

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
