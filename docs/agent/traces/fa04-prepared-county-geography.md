# FA-04 Prepared County Geography

## Goal

Move Census county-geometry acquisition out of the public request plane while
preserving the existing 56-jurisdiction county drill-down contract.

## Files changed

- `frontend/app/api/elections/counties/route.ts`
- `frontend/components/elections/election-map.tsx`
- `frontend/lib/county-geography-store.mjs`
- `frontend/lib/county-geography-store.d.ts`
- `frontend/scripts/county-geography.test.mjs`
- `frontend/scripts/prepare-county-geography.mjs`
- `frontend/public/data/county-geography/*.json` (56 generated jurisdiction artifacts)
- `docs/Log.md`
- `docs/agent/tools.md`
- `docs/agent/test-catalog.md`
- `docs/agent/learnings.md`
- `papercuts.md`

## Commands run

| Command | Result |
|---|---|
| `node scripts/prepare-county-geography.mjs --prepared-at 2026-07-12T00:00:00.000Z` | Passed; prepared 3,235 county-equivalent rows in 56 state-scoped files |
| `node scripts/prepare-county-geography.mjs --help` | Passed |
| `node --test scripts/county-geography.test.mjs` | Passed, 11/11 |
| `pnpm test:unit` | Passed, 65/65 after parent integration |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed, no warnings or errors |
| `pnpm lint:ox` | Passed, no warnings or errors |
| `pnpm build` | Passed after concurrent Next processes stopped |
| `git diff --check` | Passed |
| `curl http://127.0.0.1:3000/api/elections/counties?state=06` | Passed after development hot reload; 58 rows, canonical provenance and prepared timestamp, public cache header |
| invalid-state county API request | Passed; HTTP 400 with bounded validation error |
| Chrome production county drill-down | California returned 58 prepared rows, Alameda County was visible, result coverage remained not loaded, and document overflow was absent |

## Tests added

- Every supported jurisdiction has a nonempty checked-in artifact whose rows
  remain state-scoped and carry the canonical source plus preparation time.
- The loader rejects oversized files, state mismatches, and missing provenance.
- The public route is structurally forbidden from calling `fetch`, creating a
  request-time timestamp, or invoking filesystem write operations.

## Assumptions

- Next deployments include `frontend/public`, so the server route can read the
  same checked-in static artifacts through `process.cwd()`.
- TIGERweb geometry prepared with the existing precision and simplification is
  sufficient for the current SVG county drill-down, not cadastral analysis.
- Certified county election results remain a separate ingestion gap and are not
  implied by prepared boundary coverage.

## Failures encountered

- One search command used redundant `frontend/` prefixes from the frontend
  working directory. Logged as a papercut and rerun with correct paths.
- The first live request during Next hot reload returned a transient 500. The
  immediate repeat returned the expected 200 contract; deterministic checks and
  the clean lint/type gates confirm the compiled route contract.
- A production build was not run locally because another agent-owned `next dev`
  process was active and the documented shared `.next` collision would corrupt
  its runtime. Parent integration verification must run the production build
  after coordinated shutdown.

## Risk tier

Medium. The public API acquisition boundary and response metadata changed, but
the county row shape, state validation, source identity, and UI drill-down are
preserved.

## Rollback

Revert the county route, prepared loader/script/artifacts, response metadata UI,
tests, and corresponding documentation as one focused change. This restores the
prior request-time TIGERweb proxy behavior.

## Browser evidence

- `docs/agent/traces/fa04-county-prepared-ca.png`

## Status

Done in commit `0df20a5` plus the UTC presentation follow-up, tag
`fa04-public-read-plane`.
