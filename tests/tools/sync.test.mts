import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, it, expect } from "vitest"
import {
  generatePersonsYaml,
  generateProjectsYaml,
  generateClientsYaml
} from "../../src/tools/sync.mjs"
import { DataLoader } from "../../src/utils/data-loader.mjs"

describe("sync tool", () => {
  it("registerSync is exported from index", async () => {
    const mod = await import("../../src/index.mjs")
    expect(typeof mod.registerSync).toBe("function")
  })

  describe("YAML generation and DataLoader round-trip", () => {
    const tempDir = join(tmpdir(), `mcp-wethod-sync-test-${Date.now()}`)

    // Sample data matching the API response shapes
    const persons = [
      { id: 42, name: "Salvatore", surname: "Lanzafame", is_external: false, is_archived: false },
      { id: 99, name: "Marco", surname: "Rossi", is_external: true, is_archived: false }
    ]

    const clients = [
      { id: 58, corporate_name: "Acme Corp" },
      { id: 120, corporate_name: "Beta Industries" }
    ]

    const clientMap = new Map<number, string>()
    for (const c of clients) {
      clientMap.set(c.id, c.corporate_name)
    }

    const projects = [
      { id: 25965, name: "Website Redesign Q1", job_order: "511502", client_id: 58, pm_id: 42, is_archived: false },
      { id: 30001, name: "Mobile App", job_order: null, client_id: 120, pm_id: null, is_archived: false }
    ]

    it("generates persons.yaml that DataLoader can parse", () => {
      mkdirSync(tempDir, { recursive: true })
      const yaml = generatePersonsYaml(persons)
      writeFileSync(join(tempDir, "persons.yaml"), yaml, "utf-8")

      const loader = new DataLoader(tempDir)
      const parsed = loader.getPersons()

      expect(parsed.size).toBe(2)

      const p1 = parsed.get(42)
      expect(p1).toBeDefined()
      expect(p1!.name).toBe("Salvatore")
      expect(p1!.surname).toBe("Lanzafame")
      expect(p1!.is_external).toBe(false)

      const p2 = parsed.get(99)
      expect(p2).toBeDefined()
      expect(p2!.name).toBe("Marco")
      expect(p2!.surname).toBe("Rossi")
      expect(p2!.is_external).toBe(true)
    })

    it("generates projects.yaml that DataLoader can parse", () => {
      const yaml = generateProjectsYaml(projects, clientMap)
      writeFileSync(join(tempDir, "projects.yaml"), yaml, "utf-8")

      const loader = new DataLoader(tempDir)
      const parsed = loader.getProjects()

      expect(parsed.size).toBe(2)

      const proj1 = parsed.get(25965)
      expect(proj1).toBeDefined()
      expect(proj1!.name).toBe("Website Redesign Q1")
      expect(proj1!.job_order).toBe("511502")
      expect(proj1!.client).toBe("Acme Corp")
      expect(proj1!.client_id).toBe(58)
      expect(proj1!.pm_id).toBe(42)

      const proj2 = parsed.get(30001)
      expect(proj2).toBeDefined()
      expect(proj2!.name).toBe("Mobile App")
      expect(proj2!.job_order).toBeNull()
      expect(proj2!.client).toBe("Beta Industries")
      expect(proj2!.client_id).toBe(120)
      expect(proj2!.pm_id).toBeNull()
    })

    it("generates clients.yaml that DataLoader can parse", () => {
      const yaml = generateClientsYaml(clients)
      writeFileSync(join(tempDir, "clients.yaml"), yaml, "utf-8")

      const loader = new DataLoader(tempDir)
      const parsed = loader.getClients()

      expect(parsed.size).toBe(2)

      const c1 = parsed.get(58)
      expect(c1).toBeDefined()
      expect(c1!.name).toBe("Acme Corp")

      const c2 = parsed.get(120)
      expect(c2).toBeDefined()
      expect(c2!.name).toBe("Beta Industries")
    })
  })
})
