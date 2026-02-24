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

export function registerListProjects(server: McpServer, client: WethodClient) {
  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description:
        "List projects from Wethod. Supports filtering by probability and pagination. Returns formatted text with project ID, name, job order, probability, and value.",
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
        probability: z
          .number()
          .optional()
          .describe("Filter by project probability"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const projects = await client.request<Project[]>(
          "GET",
          "/api/projects",
          {
            params: {
              limit: params.limit,
              offset: params.offset,
              probability: params.probability,
            },
          },
        )

        if (projects.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No projects found." }],
          }
        }

        const lines = projects.map((p) => {
          const jobOrder = p.job_order ?? "—"
          return `id: ${p.id} | ${p.name} | ${jobOrder} | ${p.probability}% | ${p.value}`
        })

        const text = `Found ${projects.length} project(s):\n\n${lines.join("\n")}`

        return {
          content: [{ type: "text" as const, text }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
