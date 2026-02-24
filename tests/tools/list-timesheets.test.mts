import { describe, it, expect } from "vitest"
import { registerListTimesheets } from "../../src/tools/list-timesheets.mjs"
import { registerCreateTimesheet } from "../../src/tools/create-timesheet.mjs"
import { registerUpdateTimesheet } from "../../src/tools/update-timesheet.mjs"
import { registerDeleteTimesheet } from "../../src/tools/delete-timesheet.mjs"
import { registerCheckTimesheetStatus } from "../../src/tools/check-timesheet-status.mjs"

describe("timesheet tools", () => {
  it("registerListTimesheets is a function", () => {
    expect(typeof registerListTimesheets).toBe("function")
  })

  it("registerCreateTimesheet is a function", () => {
    expect(typeof registerCreateTimesheet).toBe("function")
  })

  it("registerUpdateTimesheet is a function", () => {
    expect(typeof registerUpdateTimesheet).toBe("function")
  })

  it("registerDeleteTimesheet is a function", () => {
    expect(typeof registerDeleteTimesheet).toBe("function")
  })

  it("registerCheckTimesheetStatus is a function", () => {
    expect(typeof registerCheckTimesheetStatus).toBe("function")
  })
})
