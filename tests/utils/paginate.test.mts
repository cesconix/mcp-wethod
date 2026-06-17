import { describe, expect, it, vi } from "vitest"
import type { WethodClient } from "../../src/utils/client.mjs"
import { fetchAllPages, PAGE_SIZE } from "../../src/utils/paginate.mjs"

function mockClient() {
  return { request: vi.fn<WethodClient["request"]>() }
}

function rows(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: i }))
}

describe("fetchAllPages", () => {
  it("walks every page until a short page ends it", async () => {
    const client = mockClient()
    client.request
      .mockResolvedValueOnce(rows(PAGE_SIZE)) // full page → keep going
      .mockResolvedValueOnce(rows(40)) // short page → stop

    const all = await fetchAllPages(
      client as unknown as WethodClient,
      "/api/things",
    )

    expect(all).toHaveLength(PAGE_SIZE + 40)
    expect(client.request).toHaveBeenCalledTimes(2)
  })

  it("merges extra params and advances the offset cursor", async () => {
    const client = mockClient()
    client.request
      .mockResolvedValueOnce(rows(PAGE_SIZE))
      .mockResolvedValueOnce(rows(0))

    await fetchAllPages(client as unknown as WethodClient, "/api/things", {
      project_id: 4242,
    })

    expect(client.request).toHaveBeenNthCalledWith(1, "GET", "/api/things", {
      params: { project_id: 4242, limit: PAGE_SIZE, offset: 0 },
    })
    expect(client.request).toHaveBeenNthCalledWith(2, "GET", "/api/things", {
      params: { project_id: 4242, limit: PAGE_SIZE, offset: PAGE_SIZE },
    })
  })

  it("makes a single call when the first page is short", async () => {
    const client = mockClient()
    client.request.mockResolvedValueOnce(rows(3))

    const all = await fetchAllPages(
      client as unknown as WethodClient,
      "/api/things",
    )

    expect(all).toHaveLength(3)
    expect(client.request).toHaveBeenCalledTimes(1)
  })

  it("preserves the row shape (generic T is never narrowed)", async () => {
    const client = mockClient()
    client.request.mockResolvedValueOnce([
      { id: 1, deleted_at: "2026-01-01" },
      { id: 2, deleted_at: null },
    ])

    const all = await fetchAllPages<{ id: number; deleted_at: string | null }>(
      client as unknown as WethodClient,
      "/api/project-statuses",
    )

    expect(all.filter((s) => !s.deleted_at)).toEqual([
      { id: 2, deleted_at: null },
    ])
  })
})
