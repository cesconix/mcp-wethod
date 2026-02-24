# Sync Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the `sync` tool to use the 2-phase timetracking report + public API strategy from the bash script, add project types support and a new lookup tool.

**Architecture:** Phase 1 fetches employees, projects, and project types from `/report/timetracking/` using session cookie auth, iterating through all Mondays of the current year. Phase 2 enriches projects with client names and PM IDs using the public API (Bearer token). Output is 4 YAML files. A new `lookup_project_type` tool reads from the project types cache.

**Tech Stack:** TypeScript, Node.js fetch API, Vitest

---

### Task 1: Add project types to DataLoader

**Files:**
- Modify: `src/utils/data-loader.mts`
- Modify: `tests/utils/format.test.mts` (no — separate test file needed)
- Test: `tests/tools/sync.test.mts` (will be updated in Task 5)

**Step 1: Add `ProjectTypeEntry` type and `parseProjectTypes` to `src/utils/data-loader.mts`**

Add after the `ClientEntry` type (line 36):

```typescript
export type ProjectTypeEntry = {
  id: number
  name: string
  chargeable: boolean
  hours_type: string
}
```

Add after the `parseClients` function (line 183):

```typescript
/**
 * Parses project-types.yaml
 *
 * Format:
 *   1: { name: "Billable", chargeable: true, hours_type: "workable" }
 */
function parseProjectTypes(dataDir: string): Map<number, ProjectTypeEntry> {
  const map = new Map<number, ProjectTypeEntry>()
  const lines = readLines(join(dataDir, "project-types.yaml"))

  const re =
    /^\s+(\d+):\s*\{\s*name:\s*"(.+?)",\s*chargeable:\s*(true|false),\s*hours_type:\s*"(.+?)"\s*\}/

  for (const line of lines) {
    const m = line.match(re)
    if (m) {
      const id = Number(m[1])
      map.set(id, {
        id,
        name: m[2],
        chargeable: m[3] === "true",
        hours_type: m[4],
      })
    }
  }

  return map
}
```

Add `getProjectTypes()` method to the `DataLoader` class (after `getClients`):

```typescript
getProjectTypes(): Map<number, ProjectTypeEntry> {
  return parseProjectTypes(this.dataDir)
}
```

**Step 2: Export `ProjectTypeEntry` from `src/index.mts`**

The type is already exported from `data-loader.mts` via the `export type`. No change needed — it's accessible via `DataLoader`.

**Step 3: Verify typecheck passes**

Run: `pnpm run typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/utils/data-loader.mts
git commit -m "feat: add project types parser to DataLoader"
```

---

### Task 2: Add `generateProjectTypesYaml` to sync tool

**Files:**
- Modify: `src/tools/sync.mts`

**Step 1: Add the type and YAML generator**

Add after the `ApiClient` type (line 44) in `src/tools/sync.mts`:

```typescript
type TimetrackingProjectType = {
  id: number
  name: string
  chargeable: number // 1 or 0 from API
  hoursType: string
}
```

Add after `generateClientsYaml` (line 104):

```typescript
/**
 * Generates project-types.yaml content.
 *
 * Format parsed by DataLoader:
 *   /^\s+(\d+):\s*\{\s*name:\s*"(.+?)",\s*chargeable:\s*(true|false),\s*hours_type:\s*"(.+?)"\s*\}/
 */
export function generateProjectTypesYaml(
  types: TimetrackingProjectType[],
): string {
  const lines = ["project_types:"]
  for (const t of types) {
    lines.push(
      `  ${t.id}: { name: "${t.name}", chargeable: ${t.chargeable === 1}, hours_type: "${t.hoursType}" }`,
    )
  }
  return `${lines.join("\n")}\n`
}
```

**Step 2: Verify typecheck passes**

Run: `pnpm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/tools/sync.mts
git commit -m "feat: add project types YAML generator"
```

---

### Task 3: Rewrite sync tool with 2-phase strategy

This is the main task. The sync tool handler will be rewritten to:
- Phase 1: Iterate Mondays, fetch `/report/timetracking/` with session cookie
- Phase 2: Enrich with public API data (clients, projects for client_id/pm_id)
- Write 4 YAML files

**Files:**
- Modify: `src/tools/sync.mts`

**Step 1: Add helper functions for phase 1**

Add after the YAML generators, before `fetchAllPages`:

```typescript
// --- Phase 1: Timetracking report helpers ---

type TimetrackingEmployee = {
  id: number
  name: string
  surname: string
  is_external: boolean
}

type TimetrackingProject = {
  id: number
  name: string
  job_order: string | null
  project_type_id?: number
}

type TimetrackingResponse = {
  status: string
  data: {
    employees: (TimetrackingEmployee & { timetrackings?: unknown })[]
    project: TimetrackingProject[]
    project_types: TimetrackingProjectType[]
  }
}

/** Generate all Mondays from Jan 1 of current year to current week's Monday. */
function generateMondays(): string[] {
  const now = new Date()
  const year = now.getFullYear()
  const start = new Date(year, 0, 1) // Jan 1

  // Find first Monday of the year
  while (start.getDay() !== 1) {
    start.setDate(start.getDate() + 1)
  }

  // Find current week's Monday
  const today = new Date()
  const currentMonday = new Date(today)
  currentMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

  const mondays: string[] = []
  const d = new Date(start)
  while (d <= currentMonday) {
    mondays.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 7)
  }

  return mondays
}

/** Fetch a single week's timetracking report using session cookie auth. */
async function fetchWeek(
  monday: string,
  sessionId: string,
  company: string,
): Promise<TimetrackingResponse | null> {
  try {
    const response = await fetch(
      `https://api.wethod.com/report/timetracking/?date=${monday}`,
      {
        headers: {
          cookie: `SF6SESSID=${sessionId}; companyHostname=${company}.wethod.com`,
          origin: `https://${company}.wethod.com`,
          referer: `https://${company}.wethod.com/`,
        },
      },
    )

    if (!response.ok) return null

    const json = (await response.json()) as TimetrackingResponse
    if (json.status !== "Ok") return null

    return json
  } catch {
    return null
  }
}

const DELAY_MS = 2000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

**Step 2: Rewrite the `registerSync` function**

Replace the entire `registerSync` function with:

```typescript
export function registerSync(
  server: McpServer,
  client: WethodClient,
  dataDir: string,
  company: string,
) {
  server.registerTool(
    "sync",
    {
      title: "Sync Reference Data",
      description:
        "Fetches persons, projects, clients, and project types from Wethod and saves them as local YAML cache files. Requires a session ID (SF6SESSID cookie from browser DevTools → Application → Cookies → api.wethod.com). Run this before using lookup tools, or to refresh stale data.",
      inputSchema: {
        session_id: z
          .string()
          .describe(
            "SF6SESSID cookie value from browser DevTools (Application → Cookies → api.wethod.com)",
          ),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (params) => {
      try {
        const mondays = generateMondays()
        const log: string[] = []

        // --- Phase 1: Timetracking report (session cookie) ---

        const employeesMap = new Map<number, TimetrackingEmployee>()
        const projectsMap = new Map<number, TimetrackingProject>()
        let projectTypes: TimetrackingProjectType[] = []
        let failed = 0

        for (let i = 0; i < mondays.length; i++) {
          const monday = mondays[i]
          const response = await fetchWeek(monday, params.session_id, company)

          if (!response) {
            failed++
            continue
          }

          // Accumulate employees (deduplicate by id, last wins)
          for (const emp of response.data.employees) {
            const { timetrackings: _, ...person } = emp as TimetrackingEmployee & { timetrackings?: unknown }
            employeesMap.set(person.id, person)
          }

          // Accumulate projects (deduplicate by id, last wins)
          for (const proj of response.data.project) {
            projectsMap.set(proj.id, proj)
          }

          // Project types from first successful response
          if (projectTypes.length === 0 && response.data.project_types) {
            projectTypes = response.data.project_types
          }

          // Rate limit between requests
          if (i < mondays.length - 1) {
            await sleep(DELAY_MS)
          }
        }

        if (failed === mondays.length) {
          return formatToolError(
            new Error(
              "All requests failed. Check your SF6SESSID cookie — it may have expired.",
            ),
          )
        }

        log.push(
          `Phase 1: ${mondays.length - failed}/${mondays.length} weeks OK, ${employeesMap.size} persons, ${projectsMap.size} projects, ${projectTypes.length} types`,
        )

        // --- Phase 2: Enrichment from public API ---

        const [allClients, allApiProjects] = await Promise.all([
          fetchAllPages<ApiClient>(client, "/api/clients"),
          fetchAllPages<ApiProject>(client, "/api/projects"),
        ])

        // Build lookup maps
        const clientMap = new Map<number, string>()
        for (const c of allClients) {
          clientMap.set(c.id, c.corporate_name)
        }

        const apiProjectMap = new Map<
          number,
          { client_id: number; pm_id: number | null }
        >()
        for (const p of allApiProjects) {
          apiProjectMap.set(p.id, { client_id: p.client_id, pm_id: p.pm_id })
        }

        log.push(
          `Phase 2: ${allClients.length} clients, ${allApiProjects.length} projects from API`,
        )

        // --- Build enriched projects for YAML ---

        const enrichedProjects: ApiProject[] = [...projectsMap.values()].map(
          (p) => {
            const api = apiProjectMap.get(p.id)
            return {
              id: p.id,
              name: p.name,
              job_order: p.job_order,
              client_id: api?.client_id ?? 0,
              pm_id: api?.pm_id ?? null,
              is_archived: false,
            }
          },
        )

        // --- Generate YAML and write files ---

        const persons = [...employeesMap.values()]
        const personsForYaml = persons.map((p) => ({
          ...p,
          is_archived: false,
        }))

        const personsYaml = generatePersonsYaml(personsForYaml)
        const projectsYaml = generateProjectsYaml(enrichedProjects, clientMap)
        const clientsYaml = generateClientsYaml(allClients)
        const typesYaml = generateProjectTypesYaml(projectTypes)

        mkdirSync(dataDir, { recursive: true })
        writeFileSync(join(dataDir, "persons.yaml"), personsYaml, "utf-8")
        writeFileSync(join(dataDir, "projects.yaml"), projectsYaml, "utf-8")
        writeFileSync(join(dataDir, "clients.yaml"), clientsYaml, "utf-8")
        writeFileSync(
          join(dataDir, "project-types.yaml"),
          typesYaml,
          "utf-8",
        )

        log.push(
          `Saved to ${dataDir}/: ${persons.length} persons, ${enrichedProjects.length} projects, ${allClients.length} clients, ${projectTypes.length} types`,
        )

        return {
          content: [
            { type: "text" as const, text: log.join("\n") },
          ],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
```

**Step 3: Add `z` import**

Add to the imports at the top of the file (if not already present):

```typescript
import { z } from "zod"
```

**Step 4: Update `src/index.mts` to pass `company` to `registerSync`**

The `registerSync` function now needs a `company` parameter. Update `registerAll` in `src/index.mts`:

Change the `registerAll` function signature and call:

```typescript
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
```

Update `createMcpServer` to pass `company`:

```typescript
registerAll(server, client, data, options.dataDir, options.company)
```

**Step 5: Verify typecheck passes**

Run: `pnpm run typecheck`
Expected: No errors.

**Step 6: Verify tests still pass**

Run: `pnpm run test`
Expected: All tests pass (the sync round-trip tests still use the YAML generators directly).

**Step 7: Commit**

```bash
git add src/tools/sync.mts src/index.mts
git commit -m "feat: rewrite sync with 2-phase timetracking + API strategy"
```

---

### Task 4: Add `lookup_project_type` tool

**Files:**
- Create: `src/tools/lookup-project-type.mts`
- Modify: `src/index.mts`

**Step 1: Create `src/tools/lookup-project-type.mts`**

```typescript
/**
 * Tool: lookup_project_type
 *
 * Looks up a project type by ID or searches by name from local YAML data.
 * No API call — reads from ~/.mcp-wethod/{company}/project-types.yaml.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { READONLY_ANNOTATIONS } from "../utils/constants.mjs"
import type { DataLoader } from "../utils/data-loader.mjs"

export function registerLookupProjectType(
  server: McpServer,
  data: DataLoader,
) {
  server.registerTool(
    "lookup_project_type",
    {
      title: "Lookup Project Type",
      description:
        "Find a project type by ID or search by name. Reads from local synced data (no API call). Returns id, name, chargeable, hours_type.",
      inputSchema: {
        id: z
          .number()
          .int()
          .optional()
          .describe("Project type ID for direct lookup"),
        search: z
          .string()
          .optional()
          .describe(
            "Search query to filter by project type name (case-insensitive)",
          ),
      },
      annotations: READONLY_ANNOTATIONS,
    },
    async (params) => {
      const types = data.getProjectTypes()

      if (types.size === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "SYNC REQUIRED: Project type data not found. Run the sync tool to populate local data.",
            },
          ],
        }
      }

      // Direct ID lookup
      if (params.id !== undefined) {
        const t = types.get(params.id)
        if (!t) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Project type ${params.id} not found.`,
              },
            ],
          }
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `${t.id}: ${t.name} | chargeable: ${t.chargeable} | hours_type: ${t.hours_type}`,
            },
          ],
        }
      }

      // Search by name
      if (params.search) {
        const query = params.search.toLowerCase()
        const matches = [...types.values()].filter((t) =>
          t.name.toLowerCase().includes(query),
        )

        if (matches.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No project type matching "${params.search}".`,
              },
            ],
          }
        }

        const lines = matches.map(
          (t) =>
            `${t.id}: ${t.name} | chargeable: ${t.chargeable} | hours_type: ${t.hours_type}`,
        )
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `${types.size} project types available. Provide id or search.`,
          },
        ],
      }
    },
  )
}
```

**Step 2: Register in `src/index.mts`**

Add import:

```typescript
import { registerLookupProjectType } from "./tools/lookup-project-type.mjs"
```

Add registration in `registerAllTools`, after `registerLookupClient`:

```typescript
registerLookupProjectType(server, data)
```

**Step 3: Verify typecheck passes**

Run: `pnpm run typecheck`

**Step 4: Verify tests pass**

Run: `pnpm run test`

**Step 5: Commit**

```bash
git add src/tools/lookup-project-type.mts src/index.mts
git commit -m "feat: add lookup_project_type tool"
```

---

### Task 5: Update tests

**Files:**
- Modify: `tests/tools/sync.test.mts`

**Step 1: Add project types YAML round-trip test**

Add import of `generateProjectTypesYaml` to the existing imports:

```typescript
import {
  generateClientsYaml,
  generatePersonsYaml,
  generateProjectTypesYaml,
  generateProjectsYaml,
} from "../../src/tools/sync.mjs"
```

Add sample data after the existing `projects` array:

```typescript
const projectTypes = [
  { id: 1, name: "Billable", chargeable: 1, hoursType: "workable" },
  { id: 2, name: "General", chargeable: 0, hoursType: "workable" },
]
```

Add test after the clients round-trip test:

```typescript
it("generates project-types.yaml that DataLoader can parse", () => {
  const yaml = generateProjectTypesYaml(projectTypes)
  writeFileSync(join(tempDir, "project-types.yaml"), yaml, "utf-8")

  const loader = new DataLoader(tempDir)
  const parsed = loader.getProjectTypes()

  expect(parsed.size).toBe(2)

  const t1 = parsed.get(1)
  expect(t1).toBeDefined()
  expect(t1?.name).toBe("Billable")
  expect(t1?.chargeable).toBe(true)
  expect(t1?.hours_type).toBe("workable")

  const t2 = parsed.get(2)
  expect(t2).toBeDefined()
  expect(t2?.name).toBe("General")
  expect(t2?.chargeable).toBe(false)
  expect(t2?.hours_type).toBe("workable")
})
```

**Step 2: Add lookup_project_type registration test**

Add a new describe block or add to existing:

```typescript
it("registerLookupProjectType is a function", async () => {
  const { registerLookupProjectType } = await import(
    "../../src/tools/lookup-project-type.mjs"
  )
  expect(typeof registerLookupProjectType).toBe("function")
})
```

**Step 3: Run tests**

Run: `pnpm run test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add tests/
git commit -m "test: add project types round-trip and lookup registration tests"
```

---

### Task 6: Update README

**Files:**
- Modify: `README.md`

**Step 1: Update tool count and add project type to tables**

Change `## Tools (21)` to `## Tools (22)`.

Add `lookup_project_type` to the Lookup table:

```markdown
| `lookup_project_type` | Find a project type by ID or name from local synced data (no API call) |
```

**Step 2: Update sync tool description**

In the Sync table, update the description:

```markdown
| `sync` | Fetch persons, projects, clients, and project types from Wethod (requires SF6SESSID session cookie) |
```

**Step 3: Add session ID instructions**

Add a section after "Data Sync" or within it:

```markdown
### Getting the Session ID

The `sync` tool requires an `SF6SESSID` cookie for accessing the timetracking report. To retrieve it:

1. Open your browser and log in to Wethod
2. Open DevTools (F12 or Cmd+Opt+I)
3. Go to **Application** → **Cookies** → `api.wethod.com`
4. Copy the value of the `SF6SESSID` cookie
5. When Claude asks for the session ID, paste the value

The session ID expires periodically — you'll need to retrieve a fresh one when it does.
```

**Step 4: Update data directory listing**

```
~/.mcp-wethod/{company}/
├── persons.yaml
├── projects.yaml
├── clients.yaml
└── project-types.yaml
```

**Step 5: Verify lint passes**

Run: `pnpm run lint`

**Step 6: Commit**

```bash
git add README.md
git commit -m "docs: update README with project types and session ID instructions"
```

---

### Task 7: Final verification

**Step 1: Run full pipeline**

```bash
pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build
```

Expected: All pass.

**Step 2: Commit any fixups if needed**
