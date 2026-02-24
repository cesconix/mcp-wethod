/**
 * Shared constants for MCP tool/resource registrations and Wethod API.
 */

/**
 * Annotation set for read-only tools (queries, lookups).
 * These tools never modify server-side state.
 */
export const READONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
} as const

/**
 * Annotation set for write tools (create, update).
 * These tools modify state but are not destructive.
 */
export const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false
} as const

/**
 * Annotation set for delete tools.
 * These tools are destructive and remove data.
 */
export const DELETE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false
} as const

/** Wethod API version sent via the Wethod-Version header. */
export const API_VERSION = "2024-06-15"

/** Default Wethod API base URL. */
export const DEFAULT_BASE_URL = "https://api.wethod.com"

/** Standard working hours in a single day. */
export const WORK_HOURS_PER_DAY = 8

/** Standard working days in a week (Monday-Friday). */
export const WORK_DAYS_PER_WEEK = 5

/** Total expected working hours per week. */
export const WEEK_TOTAL_HOURS = WORK_HOURS_PER_DAY * WORK_DAYS_PER_WEEK
