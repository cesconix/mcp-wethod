/**
 * Tool: delete_timesheet
 *
 * Deletes a timesheet entry by ID. This is a destructive operation and
 * requires explicit confirmation.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { DELETE_ANNOTATIONS } from "../utils/constants.mjs"
import {
  formatToolError,
  requireConfirm,
  textResult,
} from "../utils/format.mjs"

export function registerDeleteTimesheet(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "delete_timesheet",
    {
      title: "Delete Timesheet",
      description:
        "Delete a timesheet entry by ID. This is destructive and cannot be undone. Requires confirm=true.",
      inputSchema: {
        id: z.number().int().describe("Timesheet ID to delete"),
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
        const gate = requireConfirm(params.confirm)
        if (gate) return gate

        await client.request("DELETE", `/api/timesheets/${params.id}`)

        return textResult(`Timesheet ${params.id} deleted successfully.`)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
