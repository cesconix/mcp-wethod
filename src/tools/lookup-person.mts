/**
 * Tool: lookup_person
 *
 * Looks up a person by ID or searches by name from local YAML data.
 * No API call — reads from ~/.mcp-wethod/{company}/persons.yaml.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import type { DataLoader } from "../utils/data-loader.mjs"

export function registerLookupPerson(server: McpServer, data: DataLoader) {
  server.registerTool(
    "lookup_person",
    {
      title: "Lookup Person",
      description:
        "Find a person by ID or search by name/surname. Reads from local synced data (no API call). Returns id, name, surname, is_external.",
      inputSchema: {
        id: z.number().int().optional().describe("Person ID for direct lookup"),
        search: z
          .string()
          .optional()
          .describe(
            "Search query to filter by name or surname (case-insensitive)",
          ),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      const persons = data.getPersons()

      if (persons.size === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "SYNC REQUIRED: Person data not found. Run the sync tool to populate local data.",
            },
          ],
        }
      }

      // Direct ID lookup
      if (params.id !== undefined) {
        const p = persons.get(params.id)
        if (!p) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Person ${params.id} not found.`,
              },
            ],
          }
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `${p.id}: ${p.name} ${p.surname}${p.is_external ? " (external)" : ""}`,
            },
          ],
        }
      }

      // Search by name
      if (params.search) {
        const query = params.search.toLowerCase()
        const matches = [...persons.values()].filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.surname.toLowerCase().includes(query) ||
            `${p.name} ${p.surname}`.toLowerCase().includes(query),
        )

        if (matches.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No person matching "${params.search}".`,
              },
            ],
          }
        }

        const lines = matches.map(
          (p) =>
            `${p.id}: ${p.name} ${p.surname}${p.is_external ? " (ext)" : ""}`,
        )
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `${persons.size} persons available. Provide id or search.`,
          },
        ],
      }
    },
  )
}
