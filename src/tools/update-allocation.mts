/**
 * Tool: update_allocation
 *
 * Updates the hours of an existing allocation entry by ID.
 * Requires explicit confirmation.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { Allocation } from "../utils/allocations.mjs"
import type { WethodClient } from "../utils/client.mjs"
import { WORK_HOURS_PER_DAY, WRITE_ANNOTATIONS } from "../utils/constants.mjs"
import type { DataLoader } from "../utils/data-loader.mjs"
import { formatToolError } from "../utils/format.mjs"

export function registerUpdateAllocation(
  server: McpServer,
  client: WethodClient,
  data: DataLoader,
) {
  server.registerTool(
    "update_allocation",
    {
      title: "Update Allocation",
      description:
        "Update the hours of an existing allocation by ID. Requires confirm=true.",
      inputSchema: {
        id: z.number().int().describe("Allocation ID to update"),
        hours: z
          .number()
          .int()
          .min(1)
          .max(WORK_HOURS_PER_DAY)
          .describe(`New hours value (1-${WORK_HOURS_PER_DAY})`),
        confirm: z
          .boolean()
          .describe(
            "Must be true to execute. Show a recap and get user confirmation first.",
          ),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (params) => {
      try {
        if (!params.confirm) {
          return {
            isError: true as const,
            content: [
              {
                type: "text" as const,
                text: "Operation not confirmed. Show a recap and get user confirmation first.",
              },
            ],
          }
        }

        const allocation = await client.request<Allocation>(
          "PATCH",
          `/api/people-allocations/${params.id}`,
          { body: { hours: params.hours } },
        )

        const projectName = data.projectName(allocation.project_id)

        const text = [
          "Allocation updated successfully.",
          "",
          `ID: ${allocation.id}`,
          `Date: ${allocation.date}`,
          `Hours: ${allocation.hours}h`,
          `Project: ${projectName}`,
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
