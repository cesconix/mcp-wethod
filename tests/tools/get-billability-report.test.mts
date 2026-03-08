import { describe, expect, it, vi } from "vitest"
import type { WethodClient } from "../../src/utils/client.mjs"

/**
 * Helper: creates a fake timesheet entry.
 */
function ts(overrides: {
  id?: number
  date: string
  hours: number
  project_id: number
  person_id?: number
}) {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 10000),
    date: overrides.date,
    hours: overrides.hours,
    notes: null,
    mode: "daily",
    project_id: overrides.project_id,
    person_id: overrides.person_id ?? 52,
  }
}

/**
 * Simulates the internal logic of get_billability_report:
 * fetches timesheets, filters by date range, groups by project,
 * cross-references with project types for chargeability.
 *
 * We test the fetchAllTimesheets pagination indirectly through
 * the tool's output.
 */
describe("get_billability_report pagination", () => {
  it("fetches all timesheets across multiple pages", async () => {
    // Dynamically import to get the actual function
    const { fetchAllTimesheets } = await import(
      "../../src/utils/fetch-all-timesheets.mjs"
    )

    // Create 150 timesheet entries (more than the 100-entry page size)
    const allEntries = Array.from({ length: 150 }, (_, i) => {
      // Spread across Jan-Feb 2026 dates
      const day = (i % 28) + 1
      const month = i < 100 ? "01" : "02"
      return ts({
        id: i + 1,
        date: `2026-${month}-${String(day).padStart(2, "0")}`,
        hours: 2,
        project_id: 100,
        person_id: 52,
      })
    })

    // Mock client that returns page-sized chunks
    const page1 = allEntries.slice(0, 100)
    const page2 = allEntries.slice(100, 150)

    const mockClient = {
      request: vi.fn<WethodClient["request"]>(),
    }

    // First call: returns 100 entries (full page)
    mockClient.request.mockResolvedValueOnce(page1)
    // Second call: returns 50 entries (partial page = last page)
    mockClient.request.mockResolvedValueOnce(page2)

    const result = await fetchAllTimesheets(
      mockClient as unknown as WethodClient,
      { person_id: 52, date_gte: "2026-01-01" },
    )

    // Should have fetched ALL 150 entries, not just 100
    expect(result).toHaveLength(150)

    // Should have made 2 API calls with proper pagination
    expect(mockClient.request).toHaveBeenCalledTimes(2)

    // First call: offset 0
    expect(mockClient.request).toHaveBeenNthCalledWith(
      1,
      "GET",
      "/api/timesheets",
      expect.objectContaining({
        params: expect.objectContaining({
          person_id: 52,
          date: "gte:2026-01-01",
          limit: 100,
          offset: 0,
        }),
      }),
    )

    // Second call: offset 100
    expect(mockClient.request).toHaveBeenNthCalledWith(
      2,
      "GET",
      "/api/timesheets",
      expect.objectContaining({
        params: expect.objectContaining({
          person_id: 52,
          date: "gte:2026-01-01",
          limit: 100,
          offset: 100,
        }),
      }),
    )
  })

  it("stops after first page when results are less than page size", async () => {
    const { fetchAllTimesheets } = await import(
      "../../src/utils/fetch-all-timesheets.mjs"
    )

    const entries = Array.from({ length: 50 }, (_, i) =>
      ts({
        id: i + 1,
        date: "2026-01-05",
        hours: 1,
        project_id: 100,
        person_id: 52,
      }),
    )

    const mockClient = {
      request: vi.fn<WethodClient["request"]>(),
    }
    mockClient.request.mockResolvedValueOnce(entries)

    const result = await fetchAllTimesheets(
      mockClient as unknown as WethodClient,
      { person_id: 52, date_gte: "2026-01-01" },
    )

    expect(result).toHaveLength(50)
    expect(mockClient.request).toHaveBeenCalledTimes(1)
  })

  it("handles exactly 100 entries (boundary case)", async () => {
    const { fetchAllTimesheets } = await import(
      "../../src/utils/fetch-all-timesheets.mjs"
    )

    const entries = Array.from({ length: 100 }, (_, i) =>
      ts({
        id: i + 1,
        date: "2026-01-05",
        hours: 1,
        project_id: 100,
        person_id: 52,
      }),
    )

    const mockClient = {
      request: vi.fn<WethodClient["request"]>(),
    }
    // First call: full page of 100
    mockClient.request.mockResolvedValueOnce(entries)
    // Second call: empty page
    mockClient.request.mockResolvedValueOnce([])

    const result = await fetchAllTimesheets(
      mockClient as unknown as WethodClient,
      { person_id: 52, date_gte: "2026-01-01" },
    )

    expect(result).toHaveLength(100)
    // Must make a 2nd call to confirm no more pages
    expect(mockClient.request).toHaveBeenCalledTimes(2)
  })
})
