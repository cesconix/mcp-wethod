import { describe, expect, it } from "vitest"
import {
  BudgetSchema,
  ProjectSchema,
  ProjectStatusSchema,
  TimesheetSchema,
} from "../../src/utils/schemas.mjs"

describe("TimesheetSchema", () => {
  const valid = {
    id: 1,
    date: "2026-01-05",
    hours: 8,
    notes: null,
    mode: "DAILY",
    project_id: 100,
    person_id: 52,
  }

  it("parses a valid row and strips unknown keys", () => {
    const parsed = TimesheetSchema.parse({ ...valid, extra_beta_field: "x" })
    expect(parsed).toEqual(valid)
    expect("extra_beta_field" in parsed).toBe(false)
  })

  it("rejects a missing core field", () => {
    const { hours: _omit, ...missing } = valid
    expect(() => TimesheetSchema.parse(missing)).toThrow()
  })
})

describe("BudgetSchema", () => {
  it("requires the compute-critical fields and tolerates sparse descriptives", () => {
    const parsed = BudgetSchema.parse({
      id: 9,
      project_id: 100,
      total_days: 190,
      is_baseline: true,
      // status / version / costs / notes all absent — nullish, allowed
    })
    expect(parsed.total_days).toBe(190)
    expect(parsed.is_baseline).toBe(true)
  })

  it("rejects a budget without total_days", () => {
    expect(() =>
      BudgetSchema.parse({ id: 9, project_id: 100, is_baseline: true }),
    ).toThrow()
  })
})

describe("ProjectStatusSchema", () => {
  it("accepts nullable metrics and an absent deleted_at", () => {
    const parsed = ProjectStatusSchema.parse({
      id: 1,
      project_id: 100,
      date: "2026-01-05",
      days_left: 188,
      progress: null,
      notes: null,
      project_status_risk_id: null,
    })
    expect(parsed.deleted_at).toBeUndefined()
  })

  it("keeps deleted_at when present (soft-delete filtering depends on it)", () => {
    const parsed = ProjectStatusSchema.parse({
      id: 1,
      project_id: 100,
      date: "2026-01-05",
      days_left: null,
      progress: null,
      notes: null,
      project_status_risk_id: null,
      deleted_at: "2026-02-01",
    })
    expect(parsed.deleted_at).toBe("2026-02-01")
  })
})

describe("ProjectSchema", () => {
  it("tolerates a sparse pipeline project (descriptive fields nullish)", () => {
    const parsed = ProjectSchema.parse({
      id: 1,
      name: "Pipeline deal",
      job_order: null,
      pm_id: null,
      // value / probability / date_start / duration / is_archived / client_id absent
    })
    expect(parsed.name).toBe("Pipeline deal")
    expect(parsed.value).toBeUndefined()
  })
})
