/**
 * mcp-wethod — MCP server for Wethod project management.
 *
 * Exposes Wethod's timesheet, project, and planning capabilities as MCP
 * tools and prompts, allowing AI assistants to interact with the Wethod
 * API through a standardized protocol.
 *
 * Two usage modes:
 *
 * 1. **Standalone CLI** (`bin.mjs`):
 *    AI client <-> stdio <-> mcp-wethod process <-> HTTP <-> Wethod API
 *    Uses StdioServerTransport. The AI spawns this as a subprocess.
 *
 * 2. **Embedded** (library usage):
 *    Import `registerAll` and call it with your own server and client
 *    instances, using whichever transport you prefer.
 *
 * In both modes the tool/prompt logic is identical — only the transport
 * differs. `registerAll` is the shared entry point that both modes use.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { McpServer as McpServerImpl } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { registerTimesheetReminderPrompt } from "./prompts/timesheet-reminder.mjs"
import { registerWeeklySummaryPrompt } from "./prompts/weekly-summary.mjs"
import { registerCheckTimesheetStatus } from "./tools/check-timesheet-status.mjs"
import { registerCreateTimesheet } from "./tools/create-timesheet.mjs"
import { registerDeleteTimesheet } from "./tools/delete-timesheet.mjs"
import { registerGetAvailability } from "./tools/get-availability.mjs"
import { registerGetProject } from "./tools/get-project.mjs"
import { registerGetTeamTimesheet } from "./tools/get-team-timesheet.mjs"
import { registerGetWeeklyPlan } from "./tools/get-weekly-plan.mjs"
import { registerListBudgets } from "./tools/list-budgets.mjs"
import { registerListCapacities } from "./tools/list-capacities.mjs"
import { registerListClients } from "./tools/list-clients.mjs"
import { registerListPersons } from "./tools/list-persons.mjs"
import { registerListProductionPlans } from "./tools/list-production-plans.mjs"
import { registerListProductions } from "./tools/list-productions.mjs"
import { registerListProjects } from "./tools/list-projects.mjs"
import { registerListTimesheetLogs } from "./tools/list-timesheet-logs.mjs"
import { registerListTimesheets } from "./tools/list-timesheets.mjs"
import { registerLookupClient } from "./tools/lookup-client.mjs"
import { registerLookupPerson } from "./tools/lookup-person.mjs"
import { registerLookupProject } from "./tools/lookup-project.mjs"
import { registerLookupProjectType } from "./tools/lookup-project-type.mjs"
import { registerSync } from "./tools/sync.mjs"
import { registerUpdateTimesheet } from "./tools/update-timesheet.mjs"
import { WethodClient, type WethodClientOptions } from "./utils/client.mjs"
import { DataLoader } from "./utils/data-loader.mjs"

export { WethodClient, DataLoader, registerSync }
export type { WethodClientOptions }

/**
 * Registers all Wethod MCP tools on the given server.
 *
 * Exported separately from `createMcpServer` so that embedded usage can
 * call it with its own transport and client instance, without going
 * through the stdio-based `createMcpServer` factory.
 */
export function registerAllTools(
  server: McpServer,
  client: WethodClient,
  data: DataLoader,
) {
  // Local data lookups (from synced JSON files — required before using other tools)
  registerLookupPerson(server, data)
  registerLookupProject(server, data)
  registerLookupClient(server, data)
  registerLookupProjectType(server, data)

  // Timesheet CRUD
  registerListTimesheets(server, client)
  registerCreateTimesheet(server, client)
  registerUpdateTimesheet(server, client)
  registerDeleteTimesheet(server, client)

  // Timesheet status & planning
  registerCheckTimesheetStatus(server, client)
  registerGetWeeklyPlan(server, client)
  registerGetAvailability(server, client)

  // Team
  registerGetTeamTimesheet(server, client)

  // People
  registerListPersons(server, client)

  // Projects
  registerListProjects(server, client)
  registerGetProject(server, client)

  // Budgets & financials
  registerListBudgets(server, client)
  registerListProductions(server, client)
  registerListProductionPlans(server, client)

  // Clients
  registerListClients(server, client)

  // Capacities
  registerListCapacities(server, client)

  // Timesheet logs
  registerListTimesheetLogs(server, client)
}

/**
 * Registers all Wethod MCP prompts on the given server.
 */
export function registerAllPrompts(server: McpServer) {
  registerTimesheetReminderPrompt(server)
  registerWeeklySummaryPrompt(server)
}

/**
 * Registers all Wethod MCP capabilities (tools + prompts).
 */
export function registerAll(
  server: McpServer,
  client: WethodClient,
  data: DataLoader,
  dataDir: string,
  company: string,
) {
  registerAllTools(server, client, data)
  registerSync(server, client, dataDir, company)
  registerAllPrompts(server)
}

/**
 * Creates a standalone MCP server with stdio transport.
 * Used by the CLI entry point (`bin.mjs`) when running as a subprocess.
 */
export async function createMcpServer(
  options: WethodClientOptions & { dataDir: string },
) {
  const client = new WethodClient(options)
  const data = new DataLoader(options.dataDir)

  const server = new McpServerImpl({
    name: "wethod",
    version: "0.1.0",
  })

  registerAll(server, client, data, options.dataDir, options.company)

  // Stdio transport: the AI client communicates via the process's
  // stdin/stdout streams (standard MCP subprocess model).
  const transport = new StdioServerTransport()
  await server.connect(transport)

  return server
}
