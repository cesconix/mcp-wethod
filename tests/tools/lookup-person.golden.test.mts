import { describe, expect, it } from "vitest"
import { registerLookupPerson } from "../../src/tools/lookup/lookup-person.mjs"
import type { DataLoader, PersonEntry } from "../../src/utils/data-loader.mjs"
import { createToolHarness } from "../helpers/tool-harness.mjs"

/**
 * Golden-output test for lookup_person — locks the SYNC-REQUIRED, found,
 * not-found, search, and summary branches so envelope refactors are safe.
 * lookup_person reads from local DataLoader data (no API call).
 */

function person(over: Partial<PersonEntry> & { id: number }): PersonEntry {
  return {
    id: over.id,
    name: over.name ?? "Mario",
    surname: over.surname ?? "Rossi",
    ...over,
  } as PersonEntry
}

function fakeData(persons: PersonEntry[]): DataLoader {
  const map = new Map(persons.map((p) => [p.id, p]))
  return { getPersons: () => map } as unknown as DataLoader
}

describe("lookup_person golden output", () => {
  it("asks for sync when no data is present", async () => {
    const h = createToolHarness()
    registerLookupPerson(h.server, fakeData([]))

    expect(await h.text("lookup_person", {})).toBe(
      "SYNC REQUIRED: Person data not found. Run the sync tool to populate local data.",
    )
  })

  it("formats a person found by id (minimal fields)", async () => {
    const h = createToolHarness()
    registerLookupPerson(h.server, fakeData([person({ id: 52 })]))

    expect(await h.text("lookup_person", { id: 52 })).toBe("52: Mario Rossi")
  })

  it("appends enrichment details when present", async () => {
    const h = createToolHarness()
    registerLookupPerson(
      h.server,
      fakeData([person({ id: 7, level: "Senior", department: "Eng" })]),
    )

    expect(await h.text("lookup_person", { id: 7 })).toBe(
      "7: Mario Rossi | Senior | Eng",
    )
  })

  it("reports a missing id", async () => {
    const h = createToolHarness()
    registerLookupPerson(h.server, fakeData([person({ id: 52 })]))

    expect(await h.text("lookup_person", { id: 999 })).toBe(
      "Person 999 not found.",
    )
  })

  it("searches by name", async () => {
    const h = createToolHarness()
    registerLookupPerson(
      h.server,
      fakeData([
        person({ id: 1, name: "Anna", surname: "Bianchi" }),
        person({ id: 2, name: "Mario", surname: "Rossi" }),
      ]),
    )

    expect(await h.text("lookup_person", { search: "anna" })).toBe(
      "1: Anna Bianchi",
    )
  })

  it("reports no search match", async () => {
    const h = createToolHarness()
    registerLookupPerson(h.server, fakeData([person({ id: 1 })]))

    expect(await h.text("lookup_person", { search: "zzz" })).toBe(
      'No person matching "zzz".',
    )
  })

  it("summarises when neither id nor search is given", async () => {
    const h = createToolHarness()
    registerLookupPerson(
      h.server,
      fakeData([person({ id: 1 }), person({ id: 2 })]),
    )

    expect(await h.text("lookup_person", {})).toBe(
      "2 persons available. Provide id or search.",
    )
  })
})
