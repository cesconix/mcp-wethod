import { describe, expect, it } from "vitest"
import { registerGetAvailability } from "../../src/tools/planning/get-availability.mjs"
import { registerGetTeamTimesheet } from "../../src/tools/planning/get-team-timesheet.mjs"
import { registerGetWeeklyPlan } from "../../src/tools/planning/get-weekly-plan.mjs"

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
