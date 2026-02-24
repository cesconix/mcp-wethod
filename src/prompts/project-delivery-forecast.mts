/**
 * Prompt: project_delivery_forecast
 *
 * Guides the LLM through estimating when a new project can be started
 * and delivered, based on current team capacity and allocations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerProjectDeliveryForecastPrompt(server: McpServer) {
  server.registerPrompt(
    "project_delivery_forecast",
    {
      title: "Project Delivery Forecast",
      description:
        "Estimate when a new project can start and be delivered, based on team capacity and current allocations",
    },
    () => {
      const text = `Estimate when a new project can start and be delivered. Follow these steps:

1. Ask the user for the project requirements:
   - Total effort in days (from budget or estimate)
   - Number and profile of people needed (e.g. "2 senior developers, 1 designer")
   - Any hard deadline or preferred start date

2. Use list_persons to find team members matching the required profiles.

3. Use get_availability for those people starting from next week, then the week after, and so on (up to 8 weeks ahead), until you find a week where the team collectively has enough free days to absorb the project.
   - A person with 40h/week and X hours already allocated has (40 - X) / 8 free days that week.
   - Sum free days across the required team members for each week.

4. Once you identify the earliest viable start week, calculate the estimated end date:
   - Total days needed / average weekly capacity of the assigned team = number of weeks to complete.
   - End week = start week + number of weeks.

5. Report:
   - Earliest possible start week
   - Estimated delivery week / date
   - Team utilisation overview for those weeks
   - Any risks: people already fully booked, gaps in the required profiles, tight deadlines`

      return {
        messages: [{ role: "user" as const, content: { type: "text", text } }],
      }
    },
  )
}
