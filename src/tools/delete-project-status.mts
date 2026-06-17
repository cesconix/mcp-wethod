/**
 * Tool: delete_project_status
 *
 * Deletes a project status by ID. Destructive; requires confirm=true.
 *
 * Project-status corrections are performed as delete + create (not update),
 * because Wethod's PATCH/update endpoint is broken server-side (returns 500
 * on every valid payload).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { DELETE_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError } from "../utils/format.mjs"

export function registerDeleteProjectStatus(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "delete_project_status",
    {
      title: "Delete Project Status",
      description:
        "Delete a project status by ID. This is destructive and cannot be undone. Requires confirm=true. (Corrections are done as delete + create because Wethod's update/PATCH endpoint is broken server-side.)",
      inputSchema: {
        id: z.number().int().describe("Project status ID to delete"),
        confirm: z
          .boolean()
          .describe(
            "Must be true to execute. Show a recap and get user confirmation first.",
          ),
      },
      annotations: DELETE_ANNOTATIONS,
    },
    async (params) => {
      try {
        if (!params.confirm) {
          return {
            isError: true as const,
            content: [
              {
                type: "text" as const,
                text: "Operation not confirmed. You must show a recap to the user and get confirmation before setting confirm=true.",
              },
            ],
          }
        }

        await client.request("DELETE", `/api/project-statuses/${params.id}`)

        return {
          content: [
            {
              type: "text" as const,
              text: `Project status ${params.id} deleted successfully.`,
            },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
