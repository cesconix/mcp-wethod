import { describe, expect, it } from "vitest"
import { registerCreateProjectStatus } from "../../src/tools/project-status/create-project-status.mjs"

describe("create_project_status tool", () => {
  it("registerCreateProjectStatus is a function", () => {
    expect(typeof registerCreateProjectStatus).toBe("function")
  })
})
