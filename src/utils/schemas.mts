/**
 * Zod schemas + inferred types for Wethod API response entities.
 *
 * Single home for the response shapes the tools consume. Two jobs:
 *
 *  1. Types: each schema exports an inferred type (`z.infer`) that tools import
 *     instead of re-declaring the same shape inline.
 *  2. Runtime validation: schemas are passed to `client.request({ schema })` at
 *     the read boundary, so a silent Wethod API change surfaces as a loud tool
 *     error rather than malformed output.
 *
 * Permissiveness (the Wethod API is in beta): zod strips unknown keys, so extra
 * fields are ignored, never rejected. Core identity fields a tool relies on
 * (ids, dates, and values used in computation) are required; purely descriptive
 * fields are `.nullish()` so one sparse row never fails a whole list. If a real
 * response trips validation, loosen the offending field here — that is the one
 * place to change.
 */

import { z } from "zod"

/**
 * Shared limit/offset input fields for the `list_*` tools. Spread into a tool's
 * inputSchema alongside its own filters:
 *
 * ```ts
 * inputSchema: { ...paginationSchema, project_id: z.number().int().optional() }
 * ```
 */
export const paginationSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(100)
    .describe("Maximum results to return (1-100, default: 100)"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of results to skip for pagination"),
}

/** Timesheet entry — `/api/timesheets`. */
export const TimesheetSchema = z.object({
  id: z.number(),
  date: z.string(),
  hours: z.number(),
  notes: z.string().nullable(),
  mode: z.string(),
  project_id: z.number(),
  person_id: z.number(),
})
export type Timesheet = z.infer<typeof TimesheetSchema>

/** Project — public projects endpoint `/api/projects`. */
export const ProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  job_order: z.string().nullable(),
  value: z.number().nullish(),
  probability: z.number().nullish(),
  date_start: z.string().nullish(),
  duration: z.number().nullish(),
  is_archived: z.boolean().nullish(),
  client_id: z.number().nullish(),
  pm_id: z.number().nullable(),
})
export type Project = z.infer<typeof ProjectSchema>

/** Weekly project status — `/api/project-statuses`. Full shape (get/list). */
export const ProjectStatusSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  date: z.string(),
  days_left: z.number().nullable(),
  progress: z.number().nullable(),
  notes: z.string().nullable(),
  project_status_risk_id: z.number().nullable(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  deleted_at: z.string().nullish(),
})
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>

/** Project budget — `/api/budgets`. `total_days`/`is_baseline` drive compute. */
export const BudgetSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  status: z.string().nullish(),
  version: z.number().nullish(),
  total_days: z.number(),
  total_cost: z.number().nullish(),
  total_price: z.number().nullish(),
  final_net_price: z.number().nullish(),
  total_external_cost: z.number().nullish(),
  is_baseline: z.boolean(),
  notes: z.string().nullish(),
})
export type Budget = z.infer<typeof BudgetSchema>

/** People-allocation entry — `/api/people-allocations`. */
export const AllocationSchema = z.object({
  id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  date: z.string(),
  hours: z.number(),
  project_id: z.number(),
  person_id: z.number(),
  deleted_at: z.string().nullable(),
})
export type Allocation = z.infer<typeof AllocationSchema>
