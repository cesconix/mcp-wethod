/**
 * Prompt: weekly_summary
 *
 * Guides the LLM through generating a comprehensive weekly summary of
 * team activity and project status from Wethod data.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerWeeklySummaryPrompt(server: McpServer) {
  server.registerPrompt(
    "weekly_summary",
    {
      title: "Weekly Summary",
      description:
        "Generate a weekly summary of team activity and project status from Wethod data",
      argsSchema: {
        week_start: z
          .string()
          .optional()
          .describe(
            "Monday date of the week to summarize (YYYY-MM-DD). Defaults to current week.",
          ),
      },
    },
    (params) => {
      const weekClause = params.week_start
        ? ` for the week of ${params.week_start}`
        : ""
      const weekParam = params.week_start
        ? ` with week_start="${params.week_start}"`
        : ""

      const text = `Generate a weekly summary from Wethod data${weekClause}. Follow these steps:

1. Use get_weekly_plan${weekParam} to see who worked on what.
2. Use get_availability${weekParam} to check team utilization.
3. Use get_team_timesheet${weekParam} to verify timesheet completion.
4. Use list_projects to get project names for the IDs found.
5. Compile a summary including: team allocation overview, utilization rates, timesheet completion status, and any concerns (overloaded team members, missing timesheets).`

      return {
        messages: [{ role: "user" as const, content: { type: "text", text } }],
      }
    },
  )
}
