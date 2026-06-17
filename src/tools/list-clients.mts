/**
 * Tool: list_clients
 *
 * Lists clients from the Wethod API with pagination support. Returns
 * formatted text lines suitable for LLM consumption.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WethodClient } from "../utils/client.mjs"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import { formatToolError, textResult } from "../utils/format.mjs"

type Client = {
  id: number
  corporate_name: string
  acronym: string | null
  email: string | null
  town: string | null
  country: string | null
  phone: string | null
  website: string | null
}

export function registerListClients(server: McpServer, client: WethodClient) {
  server.registerTool(
    "list_clients",
    {
      title: "List Clients",
      description:
        "List clients from Wethod. Returns client company names, contacts, and details.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(100)
          .describe("Maximum results to return (1-100, default: 100)"),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Number of results to skip for pagination"),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      try {
        const clients = await client.request<Client[]>("GET", "/api/clients", {
          params: {
            limit: params.limit,
            offset: params.offset,
          },
        })

        if (clients.length === 0) {
          return textResult("No clients found.")
        }

        const lines = clients.map((c) => {
          const town = c.town ?? "\u2014"
          const country = c.country ?? "\u2014"
          return `id: ${c.id} | ${c.corporate_name} | ${town}, ${country}`
        })

        const text = `Found ${clients.length} client(s):\n\n${lines.join("\n")}`

        return textResult(text)
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
