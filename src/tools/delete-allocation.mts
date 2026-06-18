/**
 * Tool: delete_allocation
 *
 * Deletes allocation entries. Supports two modes:
 * - Single: delete by allocation ID
 * - Range: delete all own allocations in a date range, optionally filtered by project
 *
 * Requires explicit confirmation.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { fetchAllocations } from "../utils/allocations.mjs"
import type { WethodClient } from "../utils/client.mjs"
import { DELETE_ANNOTATIONS } from "../utils/constants.mjs"
import {
  errorText,
  formatToolError,
  requireConfirm,
  textResult,
} from "../utils/format.mjs"

export function registerDeleteAllocation(
  server: McpServer,
  client: WethodClient,
  personId: number,
) {
  server.registerTool(
    "delete_allocation",
    {
      title: "Delete Allocation",
      description:
        "Delete allocation entries. Two modes: (1) single — provide 'id', or (2) range — provide 'date_from' and 'date_to' to delete all your allocations in that period (optionally filtered by project_id). Requires confirm=true.",
      inputSchema: {
        id: z
          .number()
          .int()
          .optional()
          .describe("Allocation ID to delete. Use this OR date_from+date_to."),
        date_from: z
          .string()
          .optional()
          .describe(
            "Range start YYYY-MM-DD (inclusive). Must be used with date_to.",
          ),
        date_to: z
          .string()
          .optional()
          .describe(
            "Range end YYYY-MM-DD (inclusive). Must be used with date_from.",
          ),
        project_id: z
          .number()
          .int()
          .optional()
          .describe(
            "Filter by project ID (only for range mode). If omitted, deletes all allocations in the range.",
          ),
        confirm: z
          .boolean()
          .describe(
            "Must be true to execute. Show a recap and get user confirmation first.",
          ),
      },
      annotations: DELETE_ANNOTATIONS,
    },
    async (params) => {
      try {
        const gate = requireConfirm(params.confirm)
        if (gate) return gate

        // Single delete mode
        if (params.id !== undefined) {
          await client.request("DELETE", `/api/people-allocations/${params.id}`)

          return textResult(`Allocation ${params.id} deleted successfully.`)
        }

        // Range delete mode
        if (!params.date_from || !params.date_to) {
          return errorText(
            "Provide either 'id' for a single deletion, or both 'date_from' and 'date_to' for a range.",
          )
        }

        // Fetch allocations to delete
        const allocations = await fetchAllocations(client, {
          person_id: personId,
          project_id: params.project_id,
          date_from: params.date_from,
          date_to: params.date_to,
        })

        if (allocations.length === 0) {
          return textResult("No allocations found in the specified range.")
        }

        const results: { id: number; ok: boolean; error?: string }[] = []

        // Delete all in parallel
        await Promise.all(
          allocations.map(async (a) => {
            try {
              await client.request("DELETE", `/api/people-allocations/${a.id}`)
              results.push({ id: a.id, ok: true })
            } catch (error) {
              results.push({
                id: a.id,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              })
            }
          }),
        )

        const deleted = results.filter((r) => r.ok)
        const failed = results.filter((r) => !r.ok)
        const deletedIds = new Set(deleted.map((r) => r.id))
        const totalHours = allocations
          .filter((a) => deletedIds.has(a.id))
          .reduce((sum, a) => sum + a.hours, 0)

        const lines: string[] = [
          `Deleted ${deleted.length}/${allocations.length} allocation(s) from ${params.date_from} to ${params.date_to} (${totalHours}h total).`,
        ]

        if (failed.length > 0) {
          lines.push("")
          lines.push("Errors:")
          for (const f of failed) {
            lines.push(`  id:${f.id}: ${f.error}`)
          }
        }

        return {
          isError: failed.length > 0 && deleted.length === 0,
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
