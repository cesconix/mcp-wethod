# mcp-wethod

[![npm version](https://img.shields.io/npm/v/mcp-wethod)](https://www.npmjs.com/package/mcp-wethod)
[![CI](https://github.com/cesconix/mcp-wethod/actions/workflows/ci.yml/badge.svg)](https://github.com/cesconix/mcp-wethod/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)

MCP server for [Wethod](https://www.wethod.com/) project management — timesheet, planning, budgets, and team tools.

## Installation

```bash
claude mcp add wethod -- npx mcp-wethod
```

Set the required environment variables:

```bash
claude mcp add wethod \
  -e WETHOD_COMPANY=your-company \
  -e WETHOD_API_TOKEN=your-token \
  -- npx mcp-wethod
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `WETHOD_COMPANY` | Yes | Company slug (used in `Wethod-Company` header) |
| `WETHOD_API_TOKEN` | Yes | Bearer token for Wethod API authentication |

## Tools (22)

### Timesheet

| Tool | Description |
|---|---|
| `list_timesheets` | List timesheet entries for a person, with optional project/date filters |
| `create_timesheet` | Create a new timesheet entry (validates 8h daily limit) |
| `update_timesheet` | Update hours or notes on an existing timesheet entry |
| `delete_timesheet` | Delete a timesheet entry by ID |
| `check_timesheet_status` | Check timesheet completeness for a person for a given week |
| `list_timesheet_logs` | List timesheet change logs for auditing |

### Team & Planning

| Tool | Description |
|---|---|
| `get_team_timesheet` | Check timesheet completion status for multiple people |
| `get_weekly_plan` | Show who is working on what this week from allocation data |
| `get_availability` | Show utilization and available capacity per person |

### Projects

| Tool | Description |
|---|---|
| `list_projects` | List projects with filtering by probability and pagination |
| `get_project` | Get full details of a single project by ID |
| `list_budgets` | List project budgets with status, days, costs, and prices |
| `list_productions` | List actual production values by project and date |
| `list_production_plans` | List planned production values for variance tracking |

### People & Clients

| Tool | Description |
|---|---|
| `list_persons` | Search for people by name, surname, or email |
| `list_clients` | List clients with company names, contacts, and details |
| `list_capacities` | List work capacity configurations and weekly schedules |

### Lookup

| Tool | Description |
|---|---|
| `lookup_person` | Find a person by ID or name from local synced data (no API call) |
| `lookup_project` | Find a project by ID or name from local synced data (no API call) |
| `lookup_client` | Find a client by ID or name from local synced data (no API call) |
| `lookup_project_type` | Find a project type by ID or name from local synced data (no API call) |

### Sync

| Tool | Description |
|---|---|
| `sync` | Fetch persons, projects, clients, and project types from Wethod (requires SF6SESSID session cookie) |

## Prompts (2)

| Prompt | Description |
|---|---|
| `timesheet-reminder` | Check team timesheet status and generate friendly reminders |
| `weekly-summary` | Generate a weekly summary of team activity and project status |

## Data Sync

The `sync` tool fetches reference data (persons, projects, clients) from the Wethod API and writes local YAML cache files. These files are used by the three `lookup_*` tools for fast, offline lookups.

Data is stored in:

```
~/.mcp-wethod/{company}/
├── persons.json
├── projects.json
├── clients.json
└── project-types.json
```

Run `sync` once before using lookup tools, and periodically to keep the cache fresh.

### Getting the Session ID

The `sync` tool requires an `SF6SESSID` cookie for accessing the timetracking report. To retrieve it:

1. Open your browser and log in to Wethod
2. Open DevTools (F12 or Cmd+Opt+I)
3. Go to **Application** → **Cookies** → `api.wethod.com`
4. Copy the value of the `SF6SESSID` cookie
5. When Claude asks for the session ID, paste the value

The session ID expires periodically — you'll need to retrieve a fresh one when it does.

## Multi-instance

To connect to multiple Wethod companies, register separate MCP instances:

```bash
claude mcp add wethod-acme \
  -e WETHOD_COMPANY=acme \
  -e WETHOD_API_TOKEN=token-for-acme \
  -- npx mcp-wethod

claude mcp add wethod-globex \
  -e WETHOD_COMPANY=globex \
  -e WETHOD_API_TOKEN=token-for-globex \
  -- npx mcp-wethod
```

Each instance gets its own data directory (`~/.mcp-wethod/acme/`, `~/.mcp-wethod/globex/`).

## Development

```bash
pnpm install          # Install dependencies
pnpm run lint         # Lint and format check (Biome)
pnpm run format       # Auto-fix lint and formatting
pnpm run typecheck    # Type-check (tsc --noEmit)
pnpm run test         # Run tests (Vitest)
pnpm run build        # Build (tsc)
```

Requires Node.js >= 22.

## License

MIT
