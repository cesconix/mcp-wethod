/**
 * Tool: reset
 *
 * Wipes all local data and configuration, returning the server to
 * a fresh state. After reset the user must reconnect, which will
 * trigger the setup flow again.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { clearAll } from "../utils/config.mjs"
import { DELETE_ANNOTATIONS } from "../utils/constants.mjs"
import { textResult } from "../utils/format.mjs"

export function registerReset(server: McpServer) {
  server.registerTool(
    "reset",
    {
      title: "Reset Configuration",
      description:
        "Deletes all local data and configuration (config.json, synced JSON files). After this, reconnect the MCP server to start the setup flow from scratch.",
      inputSchema: {},
      annotations: DELETE_ANNOTATIONS,
    },
    async () => {
      clearAll()

      return textResult(
        "All data and configuration have been deleted. Please reconnect the MCP server to start setup again.",
      )
    },
  )
}
