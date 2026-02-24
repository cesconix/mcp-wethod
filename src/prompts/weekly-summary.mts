/**
 * Prompt: weekly_summary
 *
 * Guides the LLM through generating a comprehensive weekly summary of
 * team activity and project status from Wethod data.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerWeeklySummaryPrompt(server: McpServer) {
  server.registerPrompt(
    "weekly_summary",
    {
      title: "Weekly Summary",
      description:
        "Generate a weekly summary of team activity and project status from Wethod data"
    },
    () => {
      const text = `Generate a weekly summary from Wethod data. Follow these steps:

1. Use get_weekly_plan to see who worked on what this week.
2. Use get_availability to check team utilization.
3. Use get_team_timesheet to verify timesheet completion.
4. Use list_projects to get project names for the IDs found.
5. Compile a summary including: team allocation overview, utilization rates, timesheet completion status, and any concerns (overloaded team members, missing timesheets).`

      return {
        messages: [{ role: "user" as const, content: { type: "text", text } }]
      }
    }
  )
}
