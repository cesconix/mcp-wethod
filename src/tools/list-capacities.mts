/**
 * Tool: list_capacities
 *
 * Lists work capacity configurations from the Wethod API with pagination
 * support. Calculates total weekly hours from daily minutes. Returns
 * formatted text lines suitable for LLM consumption.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError, textResult } from "../utils/format.mjs"

type Capacity = {
  id: number
  name: string
  monday_minutes: number
  tuesday_minutes: number
  wednesday_minutes: number
  thursday_minutes: number
  friday_minutes: number
  saturday_minutes: number
  sunday_minutes: number
  is_default: boolean
}

export function registerListCapacities(
  server: McpServer,
  client: WethodClient,
) {
  server.registerTool(
    "list_capacities",
    {
      title: "List Capacities",
      description:
        "List work capacity configurations from Wethod. Shows weekly work schedules with daily minutes for each capacity type.",
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
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const capacities = await client.request<Capacity[]>(
          "GET",
          "/api/capacities",
          {
            params: {
              limit: params.limit,
              offset: params.offset,
            },
          },
        )

        if (capacities.length === 0) {
          return textResult("No capacities found.")
        }

        const lines = capacities.map((c) => {
          const totalMinutes =
            c.monday_minutes +
            c.tuesday_minutes +
            c.wednesday_minutes +
            c.thursday_minutes +
            c.friday_minutes +
            c.saturday_minutes +
            c.sunday_minutes
          const totalWeeklyHours = Math.round((totalMinutes / 60) * 100) / 100
          const defaultTag = c.is_default ? " (default)" : ""
          return `id: ${c.id} | ${c.name} | ${totalWeeklyHours}h/week${defaultTag}`
        })

        const text = `Found ${capacities.length} capacity(ies):\n\n${lines.join("\n")}`

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
