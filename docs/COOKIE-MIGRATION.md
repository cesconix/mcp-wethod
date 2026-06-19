# Cookie Migration

## Why this exists

mcp-wethod authenticates almost everything with the Wethod public API **Bearer
token** (`src/utils/client.mts`). A small set of **sync-only** calls instead use
the browser **SF6SESSID session cookie**, because the public API does not expose
that data yet.

The cookie is a **workaround**: it must be copied by hand from browser DevTools,
it expires, and it is not acceptable for an official integration. This document
tracks every cookie-dependent call so it can be migrated to a proper API
endpoint when one becomes available.

## Convention

- All cookie auth is isolated in **`src/sync/wethod-session.mts`** — a second
  HTTP path, separate from `src/utils/client.mts`. No other file performs
  cookie-authenticated requests.
- The endpoint URLs are centralized in **`LEGACY_COOKIE_ENDPOINTS`** in that
  file, so they can be swapped in one place.
- Every cookie-dependent call site is tagged with a **`LEGACY-COOKIE`** comment.
  Find them all with:

  ```bash
  grep -rn "LEGACY-COOKIE" src/
  ```

## Endpoints to migrate

| # | Endpoint | Fetcher | Data provided | Sync phase → output | Public-API gap / target |
|---|---|---|---|---|---|
| 1 | `GET /report/timetracking/?date=<monday>` | `fetchWeek` | persons, projects, clients (weekly report rows) | Phase 1 → `persons.json`, `projects.json`, `clients.json` | `/api/projects` and `/api/clients` exist, but this report is the **only** source of the person roster — there is no public `/api/persons`. A public persons endpoint is the main blocker. |
| 2 | `GET /planningboard/employees` | `fetchPlanningboardEmployees` | employee enrichment: level, department, position, office, location, tags | Phase 3 → enriches `persons.json`, writes `levels.json` | No public equivalent. Need an employees/planningboard endpoint exposing level and tag metadata. |
| 3 | `GET /report/` | `fetchReport` | project → project_type mapping | Phase 2.5 → `project_type_id` on `projects.json` | Confirm whether `/api/projects` can return `project_type_id`. If so, this call can be dropped without a new endpoint. |

## Tools affected

- **Direct** (accept a `session_id` argument): `sync`, `setup`.
- **Indirect** (read the cookie-sourced JSON cache, no cookie themselves):
  `lookup_person`, `lookup_project`, `lookup_client`, `lookup_project_type`.
- Everything else uses the Bearer API token and needs no migration.

## Migration steps (when public endpoints exist)

1. Add the new endpoint(s) to the Bearer path in `src/utils/client.mts`, with
   response schemas in `src/utils/schemas.mts`.
2. Replace the corresponding fetcher in `src/sync/wethod-session.mts` with the
   API call inside the sync pipeline (`src/sync/perform-sync.mts`).
3. When all three are migrated: drop `session_id` from `sync` and `setup`, remove
   `src/sync/wethod-session.mts`, and update the setup instructions in
   `src/index.mts` and the README to stop asking for the SF6SESSID cookie.
4. Delete this document.
