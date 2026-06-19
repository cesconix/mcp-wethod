import { describe, expect, it } from "vitest"
import { registerGetProject } from "../../src/tools/projects/get-project.mjs"
import { registerListProjects } from "../../src/tools/projects/list-projects.mjs"

describe("project tools", () => {
  it("registerListProjects is a function", () => {
    expect(typeof registerListProjects).toBe("function")
  })

  it("registerGetProject is a function", () => {
    expect(typeof registerGetProject).toBe("function")
  })
})
