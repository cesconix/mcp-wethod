/**
 * Tool: list_persons
 *
 * Lists people from the Wethod API with optional search by name/surname.
 * Since the API doesn't support server-side name filtering, we fetch
 * pages and filter client-side when a search query is provided.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError } from "../utils/format.mjs"

type Person = {
  id: number
  name: string
  surname: string
  email: string
  role: string | null
  is_archived: boolean
}

export function registerListPersons(
  server: McpServer,
  client: WethodClient
) {
  server.registerTool(
    "list_persons",
    {
      title: "List Persons",
      description:
        "Search for people in Wethod by name, surname, or email. Returns person ID, name, surname, email, and role. Use this to find a person's wethod ID.",
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe(
            "Search query to filter by name, surname, or email (case-insensitive, client-side)"
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(100)
          .describe("Maximum results per API page (1-100, default: 100)"),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Number of results to skip for pagination")
      },
      annotations: READONLY_ANNOTATIONS
    },
    async (params) => {
      try {
        const persons = await client.request<Person[]>(
          "GET",
          "/api/persons",
          {
            params: {
              limit: params.limit,
              offset: params.offset
            }
          }
        )

        let filtered = persons.filter((p) => !p.is_archived)

        if (params.search) {
          const query = params.search.toLowerCase()
          filtered = filtered.filter(
            (p) =>
              p.name.toLowerCase().includes(query) ||
              p.surname.toLowerCase().includes(query) ||
              p.email.toLowerCase().includes(query)
          )
        }

        if (filtered.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No persons found." }
            ]
          }
        }

        const lines = filtered.map((p) => {
          const role = p.role ?? "—"
          return `id: ${p.id} | ${p.name} ${p.surname} | ${p.email} | ${role}`
        })

        const text = `Found ${filtered.length} person(s):\n\n${lines.join("\n")}`

        return {
          content: [{ type: "text" as const, text }]
        }
      } catch (error) {
        return formatToolError(error)
      }
    }
  )
}
