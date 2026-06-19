/**
 * Tool: get_project
 *
 * Fetches a single project by ID from the Wethod API and returns all
 * project details in a readable text format.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../../utils/constants.mjs"
import { formatToolError, textResult } from "../../utils/format.mjs"
import { ProjectSchema } from "../../utils/schemas.mjs"

export function registerGetProject(server: McpServer, client: WethodClient) {
  server.registerTool(
    "get_project",
    {
      title: "Get Project",
      description:
        "Get full details of a single Wethod project by its ID. Returns all project fields in readable text format.",
      inputSchema: {
        id: z.number().int().describe("Project ID"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const project = await client.request(
          "GET",
          `/api/projects/${params.id}`,
          {
            schema: ProjectSchema,
          },
        )

        const lines = [
          `Project: ${project.name}`,
          `ID: ${project.id}`,
          `Job Order: ${project.job_order ?? "—"}`,
          `Value: ${project.value}`,
          `Probability: ${project.probability}%`,
          `Start Date: ${project.date_start}`,
          `Duration: ${project.duration} months`,
          `Archived: ${project.is_archived ? "Yes" : "No"}`,
          `Client ID: ${project.client_id}`,
          `PM ID: ${project.pm_id ?? "—"}`,
        ]

        const text = lines.join("\n")

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
