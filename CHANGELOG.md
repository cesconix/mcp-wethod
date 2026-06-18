# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.0](https://github.com/cesconix/mcp-wethod/releases/tag/v0.6.0) — 2026-06-18

### Added

- `list_project_statuses` and `get_project_status` tools for reading weekly project statuses
- `create_project_status` tool — creates a weekly status in remaining-days mode; `days_left` is explicit or auto-computed from budget − timesheet
- `delete_project_status` tool — corrections are done as delete + create
- `backfill_project_statuses` tool — backfills weekly statuses across a Monday range, dry-run by default
- Runtime response validation wired into the read tools (`list_budgets`, `list_projects`, `get_project`, `list_project_statuses`, `get_project_status`, `list_timesheets`)
- Golden-output test harness plus unit tests for the shared pagination and schema helpers
- "Writing a tool" conventions section in the README

### Changed

- Centralized domain types as Zod schemas in `utils/schemas.mts`; tools import them instead of re-declaring response shapes inline
- Unified offset-pagination into a single generic `fetchAllPages` (`utils/paginate.mts`); `list_*` tools spread a shared `paginationSchema`
- Extracted shared `textResult()` / `errorText()` output helpers and a `requireConfirm()` confirmation gate
- Decomposed `sync.mts` into focused `src/sync/` modules and unified the three session fetchers into one

### Fixed

- `clearData()` now also removes `levels.json`

## [0.5.0](https://github.com/cesconix/mcp-wethod/releases/tag/v0.5.0) — 2026-03-08

### Added

- `PersonEntry` enriched with department, position, hierarchy, office, location, price_list, and job_title from planningboard tags
- `LevelEntry` type and `levels.json` synced from planningboard data
- `fetchAllTimesheets` shared utility with pagination support (handles >100 entries)
- `lookup_person` now supports searching by department, position, office, and location
- Project type mapping from `/report/` endpoint (Phase 2.5 in sync)
- `project_type_id` field on `ProjectEntry` for billability cross-referencing
- `get_billability_report` tool for calculating team billability over date ranges

### Changed

- `lookup_person` displays enriched fields in pipe-separated format
- `buildPersons()` accepts enrichment map instead of level-only map
- Sync Phase 3 extracts full employee metadata (was level-only)
- Refactored `check_timesheet_status`, `get_billability_report`, and `get_team_timesheet` to use shared `fetchAllTimesheets`

### Fixed

- Removed redundant 8h daily limit pre-validation from `update_timesheet` (API enforces server-side)

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
