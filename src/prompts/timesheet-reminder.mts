/**
 * Prompt: timesheet_reminder
 *
 * Guides the LLM through checking team timesheet status and generating
 * friendly reminder messages for team members with incomplete timesheets.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerTimesheetReminderPrompt(server: McpServer) {
  server.registerPrompt(
    "timesheet_reminder",
    {
      title: "Timesheet Reminder",
      description:
        "Check team timesheet status and generate friendly reminders",
      argsSchema: {
        channel: z
          .enum(["slack", "teams"])
          .optional()
          .describe("Target channel. Defaults to Slack."),
      },
    },
    (params) => {
      const channel = params.channel ?? "slack"

      const channelInstructions =
        channel === "slack"
          ? "Format messages for Slack (direct send, informal tone)."
          : "Format messages for Microsoft Teams (proxy message with multiple tones: formale, professionale, informale, diretto)."

      const text = `Check timesheet completion for the team. Follow these steps:

1. Use get_team_timesheet to check who has filled in their hours this week.
2. For each person with incomplete timesheets, generate a friendly, informal reminder message in Italian.
3. Present the messages for approval before sending.
4. ${channelInstructions}`

      return {
        messages: [{ role: "user" as const, content: { type: "text", text } }],
      }
    },
  )
}
