/**
 * Zod schemas for runtime validation of critical Wethod API responses.
 *
 * Used to catch silent API changes that would otherwise produce malformed
 * tool output. Only the most commonly used response shapes are validated.
 */

import { z } from "zod"

export const TimesheetSchema = z.object({
  id: z.number(),
  date: z.string(),
  hours: z.number(),
  notes: z.string().nullable(),
  mode: z.string(),
  project_id: z.number(),
  person_id: z.number(),
})

export const TimesheetArraySchema = z.array(TimesheetSchema)

export const ProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  job_order: z.string().nullable(),
  client_id: z.number(),
  pm_id: z.number().nullable(),
  is_archived: z.boolean(),
})

export const ProjectArraySchema = z.array(ProjectSchema)

export const PersonSchema = z.object({
  id: z.number(),
  name: z.string(),
  surname: z.string(),
})

export const PersonArraySchema = z.array(PersonSchema)

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

export const AllocationArraySchema = z.array(AllocationSchema)

export type TimesheetResponse = z.infer<typeof TimesheetSchema>
export type ProjectResponse = z.infer<typeof ProjectSchema>
export type PersonResponse = z.infer<typeof PersonSchema>
export type AllocationResponse = z.infer<typeof AllocationSchema>
