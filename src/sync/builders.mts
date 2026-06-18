/**
 * Pure builders that turn raw Wethod responses into the local entry shapes
 * (`DataLoader` types) written to the JSON cache.
 *
 * No I/O — exercised directly by the sync round-trip tests.
 */

import type {
  ClientEntry,
  LevelEntry,
  PersonEntry,
  ProjectEntry,
  ProjectTypeEntry,
} from "../utils/data-loader.mjs"
import type {
  ApiClient,
  PersonEnrichment,
  PlanningboardEmployee,
  PlanningboardTag,
  TimetrackingEmployee,
  TimetrackingProject,
  TimetrackingProjectType,
} from "./types.mjs"

/** Reads a single planningboard tag value by its category name. */
export function extractTag(
  tags: PlanningboardTag[] | null,
  category: string,
): string | null {
  if (!tags) return null
  const tag = tags.find((t) => t.category?.name === category)
  return tag?.name ?? null
}

export function buildPersons(
  employees: Map<number, TimetrackingEmployee>,
  enrichmentByPersonId: Map<number, PersonEnrichment>,
): PersonEntry[] {
  return [...employees.values()]
    .map((e) => {
      const enrichment = enrichmentByPersonId.get(e.id)
      return {
        id: e.id,
        name: e.name,
        surname: e.surname,
        is_external: e.is_external,
        level: enrichment?.level ?? null,
        department: enrichment?.department ?? null,
        position: enrichment?.position ?? null,
        hierarchy: enrichment?.hierarchy ?? null,
        office: enrichment?.office ?? null,
        location: enrichment?.location ?? null,
        price_list: enrichment?.price_list ?? null,
        job_title: enrichment?.job_title ?? null,
      }
    })
    .sort((a, b) => a.id - b.id)
}

export function buildLevels(
  planningboardEmployees: PlanningboardEmployee[],
): LevelEntry[] {
  const seen = new Map<number, LevelEntry>()
  for (const emp of planningboardEmployees) {
    if (emp.level && !seen.has(emp.level.id)) {
      seen.set(emp.level.id, {
        id: emp.level.id,
        name: emp.level.name,
        short_name: emp.level.short_name,
      })
    }
  }
  return [...seen.values()].sort((a, b) => a.id - b.id)
}

export function buildProjects(
  projects: Map<number, TimetrackingProject>,
  apiProjectMap: Map<
    number,
    { client_id: number; pm_id: number | null; project_type_id: number | null }
  >,
  clientMap: Map<number, string>,
): ProjectEntry[] {
  return [...projects.values()]
    .map((p) => {
      const api = apiProjectMap.get(p.id)
      const clientId = api?.client_id ?? null
      return {
        id: p.id,
        name: p.name,
        job_order: p.job_order,
        client: clientId !== null ? (clientMap.get(clientId) ?? null) : null,
        client_id: clientId,
        pm_id: api?.pm_id ?? null,
        project_type_id: api?.project_type_id ?? null,
      }
    })
    .sort((a, b) => a.id - b.id)
}

export function buildClients(apiClients: ApiClient[]): ClientEntry[] {
  return apiClients
    .map((c) => ({ id: c.id, name: c.corporate_name }))
    .sort((a, b) => a.id - b.id)
}

export function buildProjectTypes(
  types: TimetrackingProjectType[],
): ProjectTypeEntry[] {
  return types
    .map((t) => ({
      id: t.id,
      name: t.name,
      chargeable: t.chargeable === 1,
      hours_type: t.hoursType,
    }))
    .sort((a, b) => a.id - b.id)
}
