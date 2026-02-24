# CI/CD: Biome + GitHub Actions + npm Publish

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Biome for linting/formatting, GitHub Actions CI on push/PR to main, and automated npm publish with OIDC provenance on git tag push.

**Architecture:** Biome replaces the current `tsc --noEmit` lint script with full formatting + linting checks. Two GitHub Actions workflows: `ci.yml` runs on push/PR to main (lint, typecheck, test, build); `publish.yml` runs on `v*` tag push and publishes to npm with provenance via OIDC. No npm token needed — GitHub's OIDC identity is used.

**Tech Stack:** Biome 2.4.4, GitHub Actions, pnpm 10, Node 22, npm provenance (OIDC)

---

### Task 1: Install and configure Biome

**Files:**
- Create: `biome.json`
- Modify: `package.json`

**Step 1: Install Biome**

Run: `pnpm add -D --save-exact @biomejs/biome@2.4.4`

**Step 2: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "asNeeded"
    }
  },
  "files": {
    "include": ["src/**", "tests/**"],
    "ignore": ["dist/**", "node_modules/**"]
  }
}
```

**Step 3: Update `package.json` scripts**

Replace the current scripts block with:

```json
{
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check src/ tests/",
    "format": "biome check --write src/ tests/",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "tsc"
  }
}
```

**Step 4: Run Biome check to see current issues**

Run: `pnpm run lint`
Expected: May report formatting/linting issues on existing code.

**Step 5: Auto-fix all existing code**

Run: `pnpm run format`
Expected: Biome formats and fixes all auto-fixable issues.

**Step 6: Verify lint passes clean**

Run: `pnpm run lint`
Expected: No errors.

**Step 7: Verify typecheck still passes**

Run: `pnpm run typecheck`
Expected: No errors.

**Step 8: Verify tests still pass**

Run: `pnpm run test`
Expected: All tests pass.

**Step 9: Commit**

```bash
git add biome.json package.json pnpm-lock.yaml src/ tests/
git commit -m "feat: add biome for formatting and linting"
```

---

### Task 2: Create CI workflow (lint + typecheck + test + build)

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the CI workflow file**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint (biome)
        run: pnpm run lint

      - name: Typecheck (tsc)
        run: pnpm run typecheck

      - name: Test
        run: pnpm run test

      - name: Build
        run: pnpm run build
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add github actions workflow for lint, typecheck, test, build"
```

---

### Task 3: Create publish workflow (npm + OIDC provenance)

**Files:**
- Create: `.github/workflows/publish.yml`

**Step 1: Create the publish workflow file**

```yaml
name: Publish

on:
  push:
    tags: ["v*"]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - run: pnpm install --frozen-lockfile

      - name: Lint (biome)
        run: pnpm run lint

      - name: Typecheck (tsc)
        run: pnpm run typecheck

      - name: Test
        run: pnpm run test

      - name: Build
        run: pnpm run build

      - name: Publish to npm
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Note: Even with OIDC provenance, npm still requires an automation token set as `NPM_TOKEN` secret in the GitHub repo settings. The `--provenance` flag adds the OIDC attestation on top of the token-based auth.

**Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add npm publish workflow with provenance on tag push"
```

---

### Task 4: Verify everything works end-to-end locally

**Step 1: Run the full local pipeline**

```bash
pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build
```

Expected: All four steps pass without errors.

**Step 2: Final commit if any adjustments were needed**

Only if previous tasks required fixups. Otherwise skip.

---

## Release Workflow (for reference)

When ready to publish a new version:

```bash
# 1. Update version in package.json
npm version patch  # or minor, or major

# 2. Push commit and tag
git push && git push --tags

# 3. GitHub Actions publishes to npm automatically
```
