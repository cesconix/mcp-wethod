import { describe, expect, it } from "vitest"
import { registerDeleteProjectStatus } from "../../src/tools/project-status/delete-project-status.mjs"

describe("delete_project_status tool", () => {
  it("registerDeleteProjectStatus is a function", () => {
    expect(typeof registerDeleteProjectStatus).toBe("function")
  })
})
