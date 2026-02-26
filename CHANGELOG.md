# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.0](https://github.com/cesconix/mcp-wethod/releases/tag/v0.4.0) — 2026-02-26

### Added

- `setup` tool: two-step interactive onboarding (provide credentials and sync data, then identify yourself by person ID)
- `reset` tool: wipe all local data and configuration to start setup from scratch
- `WETHOD_PERSON_ID` environment variable for scripted/CI usage
- Server setup mode: when unconfigured, only `setup` and `lookup_person` tools are registered with guided instructions
- `performSync` shared function extracted from `sync` tool (reused by `setup`)

### Changed

- Server no longer requires `WETHOD_COMPANY` / `WETHOD_API_TOKEN` env vars at startup — interactive `setup` flow handles first-time configuration
- Configuration stored in `~/.mcp-wethod/config.json`; env vars override it when all three are set
- Data directory flattened to `~/.mcp-wethod/` (was `~/.mcp-wethod/{company}/`)
- `createMcpServer()` reads config automatically — no options argument needed

### Removed

- Hard exit on missing env vars in `bin.mjs`

## [0.3.0](https://github.com/cesconix/mcp-wethod/releases/tag/v0.3.0) — 2026-02-26

### Added

- Shared date helpers module (`src/utils/date.mts`) replacing duplicated code across 5 tool files
- In-memory cache in `DataLoader` with automatic invalidation after sync
- Auto-generated server version from `package.json` at build time
- 8h daily limit validation in `update_timesheet` (matching `create_timesheet` behavior)
- Incremental sync mode with `.last-sync` file and optional `full` parameter for re-sync
- `channel` argument to `timesheet_reminder` prompt (slack/teams)
- `week_start` argument to `weekly_summary` prompt for past-week summaries
- Graceful shutdown handlers (SIGINT/SIGTERM) in `bin.mjs`
- Zod schemas for runtime response validation (`src/utils/schemas.mts`)
- Optional `schema` parameter in `WethodClient.request()` for runtime validation

### Changed

- Standardized all output to English (`formatHours`, `formatDate`, `get-team-timesheet`)
- Improved API error messages to show human-readable text instead of raw JSON

### Removed

- `list_persons` tool (use `lookup_person` instead)
- Duplicated date helper functions from individual tool files

## [0.2.0](https://github.com/cesconix/mcp-wethod/releases/tag/v0.2.0) — 2025-06-04

### Added

- `lookup_project_type` tool for local project type lookups
- 2-phase sync strategy: session cookie for timetracking reports + API token for enrichment
- JSON-based data storage replacing YAML format

### Changed

- Rewrote `DataLoader` to use JSON instead of YAML regex parsers
- Rewrote sync tool with parallel API enrichment phase

### Fixed

- Compute actual date from Monday + day offset in `create_timesheet`

## [0.1.0](https://github.com/cesconix/mcp-wethod/releases/tag/v0.1.0) — 2025-05-21

### Added

- Initial release
- MCP server with stdio transport
- Timesheet CRUD tools: `create_timesheet`, `update_timesheet`, `delete_timesheet`, `list_timesheets`
- Status tools: `check_timesheet_status`, `get_team_timesheet`
- Planning tools: `get_weekly_plan`, `get_availability`
- Project tools: `list_projects`, `get_project`
- Budget tools: `list_budgets`, `list_productions`, `list_production_plans`
- Lookup tools: `lookup_person`, `lookup_project`, `lookup_client`
- Sync tool for local data cache
- Prompts: `timesheet_reminder`, `weekly_summary`
- CI/CD: GitHub Actions for lint, typecheck, test, build + npm publish on tag
