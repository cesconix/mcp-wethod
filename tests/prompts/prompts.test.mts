import { describe, expect, it } from "vitest"
import { registerProjectDeliveryForecastPrompt } from "../../src/prompts/project-delivery-forecast.mjs"
import { registerTimesheetReminderPrompt } from "../../src/prompts/timesheet-reminder.mjs"
import { registerWeeklySummaryPrompt } from "../../src/prompts/weekly-summary.mjs"

describe("MCP prompts", () => {
  it("registerTimesheetReminderPrompt is a function", () => {
    expect(typeof registerTimesheetReminderPrompt).toBe("function")
  })

  it("registerWeeklySummaryPrompt is a function", () => {
    expect(typeof registerWeeklySummaryPrompt).toBe("function")
  })

  it("registerProjectDeliveryForecastPrompt is a function", () => {
    expect(typeof registerProjectDeliveryForecastPrompt).toBe("function")
  })
})
