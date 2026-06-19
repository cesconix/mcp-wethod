/**
 * Tool: get_project_status
 *
 * Fetches a single project status by ID.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../../utils/constants.mjs"
import { formatToolError, textResult } from "../../utils/format.mjs"
import { ProjectStatusSchema } from "../../utils/schemas.mjs"

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
        const s = await client.request(
          "GET",
          `/api/project-statuses/${params.id}`,
          { schema: ProjectStatusSchema },
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

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
