/**
 * Tool: list_projects
 *
 * Lists projects from the Wethod API with optional filtering by probability
 * and pagination support. Returns formatted text lines suitable for LLM
 * consumption.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError, textResult } from "../utils/format.mjs"
import { ProjectSchema, paginationSchema } from "../utils/schemas.mjs"

export function registerListProjects(server: McpServer, client: WethodClient) {
  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description:
        "List projects from Wethod. Supports filtering by probability and pagination. Returns formatted text with project ID, name, job order, probability, and value.",
      inputSchema: {
        ...paginationSchema,
        probability: z
          .number()
          .optional()
          .describe("Filter by project probability"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const projects = await client.request("GET", "/api/projects", {
          params: {
            limit: params.limit,
            offset: params.offset,
            probability: params.probability,
          },
          schema: z.array(ProjectSchema),
        })

        if (projects.length === 0) {
          return textResult("No projects found.")
        }

        const lines = projects.map((p) => {
          const jobOrder = p.job_order ?? "—"
          return `id: ${p.id} | ${p.name} | ${jobOrder} | ${p.probability}% | ${p.value}`
        })

        const text = `Found ${projects.length} project(s):\n\n${lines.join("\n")}`

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
