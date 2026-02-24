# Sync Refactor Design

## Overview

Rewrite the `sync` MCP tool in TypeScript to replicate the bash script's 2-phase strategy: weekly fetch from the timetracking report endpoint (session cookie) + enrichment from the public API. Add project types support and a new lookup tool.

## Phase 1: Timetracking Report Fetch

- Generate all Mondays from January 1 of current year to today
- For each Monday, call `GET /report/timetracking/?date={monday}` with cookie header `SF6SESSID={session_id}; companyHostname={company}.wethod.com`
- Extract and accumulate: employees, projects, project_types (first valid response only)
- Deduplicate by ID (last-wins strategy)

## Phase 2: Public API Enrichment

- Paginated fetch of `/api/clients` (Bearer token)
- Paginated fetch of `/api/projects` (Bearer token)
- Build lookup tables to enrich projects with `client` (name), `client_id`, `pm_id`

## Output: 4 YAML Files

```
~/.mcp-wethod/{company}/
├── persons.yaml
├── projects.yaml
├── clients.yaml
└── project-types.yaml
```

No `wethod-` prefix (directory already namespaced).

## Tool MCP `sync`

- Input: `session_id` (string, required) — Claude asks the user
- Range: January 1 of current year to today, not configurable
- Uses both session cookie (phase 1) and Bearer token (phase 2)

## New Tool: `lookup_project_type`

- Lookup by ID or search by name
- Shows: name, chargeable, hours_type

## DataLoader Changes

- Add parser for `project-types.yaml`
- New type: `ProjectTypeEntry { id, name, chargeable, hours_type }`

## README Updates

- Document how to retrieve SF6SESSID (browser DevTools → cookies)
- Update tool count (add `lookup_project_type`)
