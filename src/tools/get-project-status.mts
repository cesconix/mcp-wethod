/**
 * Tool: get_project_status
 *
 * Fetches a single project status by ID.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError } from "../utils/format.mjs"

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

export function registerGetProjectStatus(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "get_project_status",
    {
      title: "Get Project Status",
      description: "Get full details of a single project status by ID.",
      inputSchema: {
        id: z.number().int().describe("Project status ID"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const s = await client.request<ProjectStatus>(
          "GET",
          `/api/project-statuses/${params.id}`,
        )

        const text = [
          `ID: ${s.id}`,
          `Project: ${s.project_id}`,
          `Date: ${s.date}`,
          `Days left: ${s.days_left ?? "N/A"}`,
          `Progress: ${s.progress ?? "N/A"}%`,
          `Risk: ${s.project_status_risk_id ?? "N/A"}`,
          `Notes: ${s.notes ?? "N/A"}`,
          `Created: ${s.created_at}`,
          `Updated: ${s.updated_at}`,
        ].join("\n")

        return {
          content: [{ type: "text" as const, text }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
