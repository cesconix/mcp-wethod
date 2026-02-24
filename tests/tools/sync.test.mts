import { mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  buildClients,
  buildPersons,
  buildProjects,
  buildProjectTypes,
} from "../../src/tools/sync.mjs"
import { DataLoader } from "../../src/utils/data-loader.mjs"

describe("sync tool", () => {
  it("registerSync is exported from index", async () => {
    const mod = await import("../../src/index.mjs")
    expect(typeof mod.registerSync).toBe("function")
  })

  describe("JSON generation and DataLoader round-trip", () => {
    const tempDir = join(tmpdir(), `mcp-wethod-sync-test-${Date.now()}`)

    const employeesMap = new Map([
      [
        42,
        { id: 42, name: "Salvatore", surname: "Lanzafame", is_external: false },
      ],
      [99, { id: 99, name: "Marco", surname: "Rossi", is_external: true }],
    ])

    const projectsMap = new Map([
      [25965, { id: 25965, name: "Website Redesign Q1", job_order: "511502" }],
      [30001, { id: 30001, name: "Mobile App", job_order: null }],
    ])

    const apiProjectMap = new Map([
      [25965, { client_id: 58, pm_id: 42 }],
      [30001, { client_id: 120, pm_id: null }],
    ])

    const clientMap = new Map([
      [58, "Acme Corp"],
      [120, "Beta Industries"],
    ])

    const apiClients = [
      { id: 58, corporate_name: "Acme Corp" },
      { id: 120, corporate_name: "Beta Industries" },
    ]

    const rawProjectTypes = [
      { id: 1, name: "Billable", chargeable: 1, hoursType: "workable" },
      { id: 2, name: "General", chargeable: 0, hoursType: "workable" },
    ]

    it("persons round-trip", () => {
      mkdirSync(tempDir, { recursive: true })
      const persons = buildPersons(employeesMap)
      writeFileSync(
        join(tempDir, "persons.json"),
        JSON.stringify(persons),
        "utf-8",
      )

      const loader = new DataLoader(tempDir)
      const parsed = loader.getPersons()

      expect(parsed.size).toBe(2)
      const p1 = parsed.get(42)
      expect(p1?.name).toBe("Salvatore")
      expect(p1?.surname).toBe("Lanzafame")
      expect(p1?.is_external).toBe(false)

      const p2 = parsed.get(99)
      expect(p2?.name).toBe("Marco")
      expect(p2?.is_external).toBe(true)
    })

    it("projects round-trip", () => {
      const projects = buildProjects(projectsMap, apiProjectMap, clientMap)
      writeFileSync(
        join(tempDir, "projects.json"),
        JSON.stringify(projects),
        "utf-8",
      )

      const loader = new DataLoader(tempDir)
      const parsed = loader.getProjects()

      expect(parsed.size).toBe(2)
      const proj1 = parsed.get(25965)
      expect(proj1?.name).toBe("Website Redesign Q1")
      expect(proj1?.job_order).toBe("511502")
      expect(proj1?.client).toBe("Acme Corp")
      expect(proj1?.client_id).toBe(58)
      expect(proj1?.pm_id).toBe(42)

      const proj2 = parsed.get(30001)
      expect(proj2?.name).toBe("Mobile App")
      expect(proj2?.job_order).toBeNull()
      expect(proj2?.client).toBe("Beta Industries")
      expect(proj2?.pm_id).toBeNull()
    })

    it("clients round-trip", () => {
      const clients = buildClients(apiClients)
      writeFileSync(
        join(tempDir, "clients.json"),
        JSON.stringify(clients),
        "utf-8",
      )

      const loader = new DataLoader(tempDir)
      const parsed = loader.getClients()

      expect(parsed.size).toBe(2)
      expect(parsed.get(58)?.name).toBe("Acme Corp")
      expect(parsed.get(120)?.name).toBe("Beta Industries")
    })

    it("project types round-trip", () => {
      const types = buildProjectTypes(rawProjectTypes)
      writeFileSync(
        join(tempDir, "project-types.json"),
        JSON.stringify(types),
        "utf-8",
      )

      const loader = new DataLoader(tempDir)
      const parsed = loader.getProjectTypes()

      expect(parsed.size).toBe(2)
      const t1 = parsed.get(1)
      expect(t1?.name).toBe("Billable")
      expect(t1?.chargeable).toBe(true)
      expect(t1?.hours_type).toBe("workable")

      const t2 = parsed.get(2)
      expect(t2?.name).toBe("General")
      expect(t2?.chargeable).toBe(false)
    })
  })

  it("registerLookupProjectType is a function", async () => {
    const { registerLookupProjectType } = await import(
      "../../src/tools/lookup-project-type.mjs"
    )
    expect(typeof registerLookupProjectType).toBe("function")
  })
})
