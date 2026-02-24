/**
 * Tool: lookup_client
 *
 * Looks up a client by ID or searches by name from local YAML data.
 * No API call — reads from ~/.mcp-wethod/{company}/clients.yaml.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import type { DataLoader } from "../utils/data-loader.mjs"

export function registerLookupClient(server: McpServer, data: DataLoader) {
  server.registerTool(
    "lookup_client",
    {
      title: "Lookup Client",
      description:
        "Find a client by ID or search by name. Reads from local synced data (no API call). Returns id and corporate name.",
      inputSchema: {
        id: z.number().int().optional().describe("Client ID for direct lookup"),
        search: z
          .string()
          .optional()
          .describe("Search query to filter by client name (case-insensitive)"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      const clients = data.getClients()

      if (clients.size === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "SYNC REQUIRED: Client data not found. Run the sync tool to populate local data.",
            },
          ],
        }
      }

      // Direct ID lookup
      if (params.id !== undefined) {
        const c = clients.get(params.id)
        if (!c) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Client ${params.id} not found.`,
              },
            ],
          }
        }
        return {
          content: [{ type: "text" as const, text: `${c.id}: ${c.name}` }],
        }
      }

      // Search by name
      if (params.search) {
        const query = params.search.toLowerCase()
        const matches = [...clients.values()].filter((c) =>
          c.name.toLowerCase().includes(query),
        )

        if (matches.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No client matching "${params.search}".`,
              },
            ],
          }
        }

        const lines = matches.map((c) => `${c.id}: ${c.name}`)
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `${clients.size} clients available. Provide id or search.`,
          },
        ],
      }
    },
  )
}
