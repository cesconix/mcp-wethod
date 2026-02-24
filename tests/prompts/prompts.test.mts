import { describe, it, expect } from "vitest"
import { registerTimesheetReminderPrompt } from "../../src/prompts/timesheet-reminder.mjs"
import { registerWeeklySummaryPrompt } from "../../src/prompts/weekly-summary.mjs"

describe("MCP prompts", () => {
  it("registerTimesheetReminderPrompt is a function", () => {
    expect(typeof registerTimesheetReminderPrompt).toBe("function")
  })

  it("registerWeeklySummaryPrompt is a function", () => {
    expect(typeof registerWeeklySummaryPrompt).toBe("function")
  })
})
