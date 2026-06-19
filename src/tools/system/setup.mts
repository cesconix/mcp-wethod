/**
 * Tool: setup
 *
 * Onboarding tool for first-time configuration. Two-step flow:
 *
 * Step 1 (credentials): Provide company, API token, session ID.
 *   → Clears old data, runs full sync, asks user to identify themselves.
 *
 * Step 2 (identify): Provide person_id after reviewing synced persons.
 *   → Saves config, instructs user to reconnect.
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { WethodClient } from "../../utils/client.mjs"
import { CONFIG_DIR, clearData, writeConfig } from "../../utils/config.mjs"
import { WRITE_ANNOTATIONS } from "../../utils/constants.mjs"
import { DataLoader } from "../../utils/data-loader.mjs"
import { errorText, formatToolError, textResult } from "../../utils/format.mjs"
import { performSync } from "./sync.mjs"

const PENDING_FILE = join(CONFIG_DIR, ".setup-pending.json")

export function registerSetup(server: McpServer) {
  server.registerTool(
    "setup",
    {
      title: "Setup Wethod",
      description:
        "Configure mcp-wethod with your Wethod credentials. Two steps: first call with step='credentials' to sync data, then call with step='identify' to set your person ID.",
      inputSchema: {
        step: z
          .enum(["credentials", "identify"])
          .describe(
            '"credentials" to provide company/token/session and sync data, "identify" to set your person ID after sync.',
          ),
        company: z
          .string()
          .optional()
          .describe(
            'Step "credentials": Wethod company slug (the part before .wethod.com).',
          ),
        api_token: z
          .string()
          .optional()
          .describe(
            'Step "credentials": Wethod API token (Bearer token for REST API).',
          ),
        session_id: z
          .string()
          .optional()
          .describe(
            'Step "credentials": SF6SESSID cookie value from browser DevTools (Application → Cookies → api.wethod.com).',
          ),
        person_id: z
          .number()
          .int()
          .optional()
          .describe('Step "identify": Your person ID from the synced data.'),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (params) => {
      try {
        if (params.step === "credentials") {
          if (!params.company || !params.api_token || !params.session_id) {
            return errorText(
              "Missing required fields. Provide company, api_token, and session_id.",
            )
          }

          // Clear old data before re-sync
          clearData()

          // Run full sync
          const client = new WethodClient({
            company: params.company,
            apiToken: params.api_token,
          })

          const result = await performSync({
            sessionId: params.session_id,
            company: params.company,
            client,
            dataDir: CONFIG_DIR,
            full: true,
          })

          // Save partial config for step 2
          writeFileSync(
            PENDING_FILE,
            JSON.stringify({
              company: params.company,
              apiToken: params.api_token,
            }),
            "utf-8",
          )

          const text = [
            ...result.log,
            "",
            `Synced ${result.persons.length} persons. Now I need to know who you are.`,
            "Tell me your name and I will look you up, then call setup again with step='identify' and your person_id.",
          ].join("\n")

          return textResult(text)
        }

        if (params.step === "identify") {
          if (!params.person_id) {
            return errorText(
              "Missing person_id. Tell me your name first so I can look it up.",
            )
          }

          if (!existsSync(PENDING_FILE)) {
            return errorText(
              'No pending setup found. Run setup with step="credentials" first.',
            )
          }

          const pending = JSON.parse(readFileSync(PENDING_FILE, "utf-8"))

          // Verify person exists in synced data
          const data = new DataLoader(CONFIG_DIR)
          const person = data.getPersons().get(params.person_id)

          if (!person) {
            return errorText(
              `Person ID ${params.person_id} not found in synced data. Check the ID and try again.`,
            )
          }

          // Save final config
          writeConfig({
            company: pending.company,
            apiToken: pending.apiToken,
            personId: params.person_id,
          })

          unlinkSync(PENDING_FILE)

          const text = [
            `Setup complete! Configured as ${person.name} ${person.surname} (ID: ${params.person_id}) for company "${pending.company}".`,
            "",
            "Please reconnect the MCP server to apply the new configuration.",
          ].join("\n")

          return textResult(text)
        }

        return errorText('Invalid step. Use "credentials" or "identify".')
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
