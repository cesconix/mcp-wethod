/**
 * Tool: get_project
 *
 * Fetches a single project by ID from the Wethod API and returns all
 * project details in a readable text format.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError } from "../utils/format.mjs"

type Project = {
  id: number
  name: string
  job_order: string | null
  value: number
  probability: number
  date_start: string
  duration: number
  is_archived: boolean
  client_id: number
  pm_id: number | null
}

export function registerGetProject(
  server: McpServer,
  client: WethodClient
) {
  server.registerTool(
    "get_project",
    {
      title: "Get Project",
      description:
        "Get full details of a single Wethod project by its ID. Returns all project fields in readable text format.",
      inputSchema: {
        id: z
          .number()
          .int()
          .describe("Project ID")
      },
      annotations: READONLY_ANNOTATIONS
    },
    async (params) => {
      try {
        const project = await client.request<Project>(
          "GET",
          `/api/projects/${params.id}`
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
          `PM ID: ${project.pm_id ?? "—"}`
        ]

        const text = lines.join("\n")

        return {
          content: [{ type: "text" as const, text }]
        }
      } catch (error) {
        return formatToolError(error)
      }
    }
  )
}
