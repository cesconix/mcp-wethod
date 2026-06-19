/**
 * Tool: sync
 *
 * Registers the `sync` MCP tool. The actual pipeline lives in `src/sync/`:
 * session fetchers (wethod-session), pure JSON builders (builders), and the
 * orchestrator (perform-sync). This file only wires the tool to the server.
 *
 * `performSync` is re-exported so the `setup` tool can run the same pipeline.
 *
 * LEGACY-COOKIE: this tool takes a `session_id` (SF6SESSID browser cookie)
 * because its pipeline reads endpoints the public API does not expose. See
 * docs/COOKIE-MIGRATION.md.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { performSync } from "../../sync/perform-sync.mjs"
import type { WethodClient } from "../../utils/client.mjs"
import { WRITE_ANNOTATIONS } from "../../utils/constants.mjs"
import type { DataLoader } from "../../utils/data-loader.mjs"
import { formatToolError, textResult } from "../../utils/format.mjs"

export { performSync }

export function registerSync(
  server: McpServer,
  client: WethodClient,
  dataDir: string,
  company: string,
  data: DataLoader,
) {
  server.registerTool(
    "sync",
    {
      title: "Sync Reference Data",
      description:
        "Fetches persons, projects, clients, and project types from Wethod and saves them as local JSON cache files. Requires a session ID (SF6SESSID cookie from browser DevTools → Application → Cookies → api.wethod.com). Run this before using lookup tools, or to refresh stale data.",
      inputSchema: {
        session_id: z
          .string()
          .describe(
            "SF6SESSID cookie value from browser DevTools (Application → Cookies → api.wethod.com)",
          ),
        full: z
          .boolean()
          .optional()
          .describe(
            "Force a full re-sync from Jan 1 of the current year. Defaults to false (incremental from last sync).",
          ),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (params) => {
      try {
        const result = await performSync({
          sessionId: params.session_id,
          company,
          client,
          dataDir,
          full: params.full,
        })

        data.invalidate()

        return textResult(result.log.join("\n"))
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
