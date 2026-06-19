import { describe, expect, it } from "vitest"
import { registerCheckTimesheetStatus } from "../../src/tools/timesheet/check-timesheet-status.mjs"
import { registerCreateTimesheet } from "../../src/tools/timesheet/create-timesheet.mjs"
import { registerDeleteTimesheet } from "../../src/tools/timesheet/delete-timesheet.mjs"
import { registerListTimesheets } from "../../src/tools/timesheet/list-timesheets.mjs"
import { registerUpdateTimesheet } from "../../src/tools/timesheet/update-timesheet.mjs"

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
