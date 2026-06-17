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

On first use, the `setup` tool guides you through interactive configuration: company slug, API token, and SF6SESSID cookie. Credentials are stored in `~/.mcp-wethod/config.json`.

For CI or scripted setups, pass all three environment variables to skip interactive setup:

```bash
claude mcp add wethod \
  -e WETHOD_COMPANY=your-company \
  -e WETHOD_API_TOKEN=your-token \
  -e WETHOD_PERSON_ID=your-person-id \
  -- npx mcp-wethod
```

### Environment Variables

When all three are set, environment variables override `config.json`.

| Variable | Description |
|---|---|
| `WETHOD_COMPANY` | Company slug (the part before `.wethod.com`) |
| `WETHOD_API_TOKEN` | Bearer token for Wethod API authentication |
| `WETHOD_PERSON_ID` | Your person ID in Wethod |


## Tools (33)

### Configuration

| Tool | Description |
|---|---|
| `setup` | Two-step onboarding: provide credentials and sync data (`step=credentials`), then set your person ID (`step=identify`) |
| `reset` | Delete all local data and configuration to start setup from scratch |

### Timesheet

| Tool | Description | Endpoint |
|---|---|---|
| `list_timesheets` | List timesheet entries for a person, with optional project/date filters | `GET /api/timesheets` |
| `create_timesheet` | Create a new timesheet entry (validates 8h daily limit) | `GET /api/timesheets` `POST /api/timesheets` |
| `update_timesheet` | Update hours or notes on an existing timesheet entry | `PATCH /api/timesheets/:id` |
| `delete_timesheet` | Delete a timesheet entry by ID | `DELETE /api/timesheets/:id` |
| `check_timesheet_status` | Check timesheet completeness for a person for a given week | `GET /api/timesheets` |
| `list_timesheet_logs` | List timesheet change logs for auditing | `GET /api/timesheet-logs` |

### Allocations

| Tool | Description | Endpoint |
|---|---|---|
| `list_allocations` | List people allocations with filters for person, project, and date range | `GET /api/people-allocations` |
| `create_allocation` | Create allocation entries (single date or date range for weekdays Mon-Fri, validates 8h daily limit) | `POST /api/people-allocations` |
| `update_allocation` | Update hours of an existing allocation by ID | `PATCH /api/people-allocations/:id` |
| `delete_allocation` | Delete allocation entries (single by ID or range by date, optionally filtered by project) | `DELETE /api/people-allocations/:id` |

### Team & Planning

| Tool | Description | Endpoint |
|---|---|---|
| `get_team_timesheet` | Check timesheet completion status for multiple people | `GET /api/timesheets` |
| `get_weekly_plan` | Show who is working on what this week from allocation data | `GET /api/people-allocations` |
| `get_availability` | Show utilization and available capacity per person | `GET /api/people-allocations` |

### Reporting

| Tool | Description | Endpoint |
|---|---|---|
| `get_billability_report` | Calculate billability percentage for multiple people over a date range | `GET /api/timesheets` |

### Projects

| Tool | Description | Endpoint |
|---|---|---|
| `list_projects` | List projects with filtering by probability and pagination | `GET /api/projects` |
| `get_project` | Get full details of a single project by ID | `GET /api/projects/:id` |
| `list_budgets` | List project budgets with status, days, costs, and prices | `GET /api/budgets` |
| `list_productions` | List actual production values by project and date | `GET /api/productions` |
| `list_production_plans` | List planned production values for variance tracking | `GET /api/production-plans` |

### Project Statuses

| Tool | Description | Endpoint |
|---|---|---|
| `list_project_statuses` | List weekly project statuses, filterable by project | `GET /api/project-statuses` |
| `get_project_status` | Get full details of a single project status by ID | `GET /api/project-statuses/:id` |
| `create_project_status` | Create a weekly status (remaining-days mode); `days_left` explicit or auto-computed from budget − timesheet; requires `confirm` | `GET /api/budgets` `GET /api/timesheets` `POST /api/project-statuses` |
| `delete_project_status` | Delete a project status by ID (corrections are done as delete + create) | `DELETE /api/project-statuses/:id` |
| `backfill_project_statuses` | Backfill weekly statuses across a Monday range; dry-run by default, skip or overwrite existing | `GET /api/budgets` `GET /api/timesheets` `GET`/`POST`/`DELETE /api/project-statuses` |

### Clients & Capacities

| Tool | Description | Endpoint |
|---|---|---|
| `list_clients` | List clients with company names, contacts, and details | `GET /api/clients` |
| `list_capacities` | List work capacity configurations and weekly schedules | `GET /api/capacities` |

### Lookup

| Tool | Description | Source |
|---|---|---|
| `lookup_person` | Find a person by ID or name from local synced data | `persons.json` |
| `lookup_project` | Find a project by ID or name from local synced data | `projects.json` |
| `lookup_client` | Find a client by ID or name from local synced data | `clients.json` |
| `lookup_project_type` | Find a project type by ID or name from local synced data | `project-types.json` |

### Sync

| Tool | Description | Endpoint |
|---|---|---|
| `sync` | Fetch persons, projects, clients, and project types (requires SF6SESSID session cookie) | `GET /report/timetracking` `GET /api/clients` `GET /api/projects` |


## Prompts (2)

| Prompt | Description |
|---|---|
| `timesheet_reminder` | Check team timesheet status and generate friendly reminders |
| `weekly_summary` | Generate a weekly summary of team activity and project status |


## Data Sync

The `sync` tool fetches reference data (persons, projects, clients) from the Wethod API and writes local JSON cache files. These files are used by the `lookup_*` tools for fast, offline lookups.

Data is stored in:

```
~/.mcp-wethod/
├── config.json
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

To connect to multiple Wethod companies, register separate MCP instances using environment variables:

```bash
claude mcp add wethod-acme \
  -e WETHOD_COMPANY=acme \
  -e WETHOD_API_TOKEN=token-for-acme \
  -e WETHOD_PERSON_ID=person-id-for-acme \
  -- npx mcp-wethod

claude mcp add wethod-globex \
  -e WETHOD_COMPANY=globex \
  -e WETHOD_API_TOKEN=token-for-globex \
  -e WETHOD_PERSON_ID=person-id-for-globex \
  -- npx mcp-wethod
```


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
