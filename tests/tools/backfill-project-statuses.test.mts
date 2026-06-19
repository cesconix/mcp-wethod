import { describe, expect, it } from "vitest"
import { registerBackfillProjectStatuses } from "../../src/tools/project-status/backfill-project-statuses.mjs"

describe("backfill_project_statuses tool", () => {
  it("registerBackfillProjectStatuses is a function", () => {
    expect(typeof registerBackfillProjectStatuses).toBe("function")
  })
})
