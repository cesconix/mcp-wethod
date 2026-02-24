import { describe, it, expect } from "vitest"
import { registerGetWeeklyPlan } from "../../src/tools/get-weekly-plan.mjs"
import { registerGetAvailability } from "../../src/tools/get-availability.mjs"
import { registerGetTeamTimesheet } from "../../src/tools/get-team-timesheet.mjs"

describe("team tools", () => {
  it("registerGetWeeklyPlan is a function", () => {
    expect(typeof registerGetWeeklyPlan).toBe("function")
  })

  it("registerGetAvailability is a function", () => {
    expect(typeof registerGetAvailability).toBe("function")
  })

  it("registerGetTeamTimesheet is a function", () => {
    expect(typeof registerGetTeamTimesheet).toBe("function")
  })
})
