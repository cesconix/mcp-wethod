# Releasing

Publishing to npm is **tag-driven and automated**. Pushing a `v*` tag to GitHub
triggers the [`publish.yml`](.github/workflows/publish.yml) workflow, which runs
lint → typecheck → test → build and then `npm publish --provenance --access public`.

You never run `npm publish` by hand. You never need to `npm login` locally —
the workflow authenticates with the `NPM_TOKEN` repository secret.

## Prerequisites

- Push access to `main` and permission to create tags.
- `main` is green in CI and up to date locally.
- The `NPM_TOKEN` secret is configured in the GitHub repo settings (already set up).

## Versioning

Semantic Versioning. While the package is pre-1.0:

| Change | Bump | Example |
|---|---|---|
| New tool / feature (backward compatible) | minor | 0.5.0 → 0.6.0 |
| Bug fix / internal refactor only | patch | 0.6.0 → 0.6.1 |
| Breaking change to tool names or inputs | minor (pre-1.0) | 0.6.0 → 0.7.0 |

The version lives in `package.json`. `src/version.mts` is generated from it by
`scripts/generate-version.mjs` (runs automatically on `build` via the `prebuild`
hook); the server reports this string at startup.

## Steps

1. **Sync main**

   ```bash
   git checkout main && git pull
   ```

2. **Update the changelog** — add a new section at the top of `CHANGELOG.md` for
   the version, dated today, with `Added` / `Changed` / `Fixed` / `Removed`
   subsections covering everything merged since the last tag.

3. **Bump the version** in `package.json`, then regenerate `src/version.mts`:

   ```bash
   pnpm run prebuild   # writes src/version.mts from package.json
   ```

4. **Verify locally** — the same gate CI runs:

   ```bash
   pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build
   ```

5. **Commit** the bump + changelog:

   ```bash
   git commit -am "chore: release X.Y.Z"
   git push origin main
   ```

6. **Tag and push the tag** — this is what triggers publishing. The tag must be
   `v`-prefixed and match the `package.json` version exactly:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

7. **Watch the release** — open the repo's **Actions** tab and follow the
   *Publish* run. When it goes green, confirm on npm:

   ```bash
   npm view mcp-wethod version
   ```

## Notes & gotchas

- **Only a tag push publishes.** Pushing to `main` alone runs CI but does not
  release.
- **The tag must match the version.** `v0.6.0` requires `"version": "0.6.0"` in
  `package.json`, otherwise the published package and the tag disagree.
- **A version can't be republished.** npm forbids overwriting an existing
  version, and unpublishing is restricted. If a release is broken, fix forward
  with the next patch — never try to re-tag the same version.
- **Published contents** are only `dist/` and `bin.mjs` (the `files` field in
  `package.json`). Source, tests, and config are not shipped.
- **Provenance** is enabled (`--provenance`), so releases are linked to the
  GitHub Actions run that built them.
