# Known Errors

## A Concurrent Backend Applied An In-Progress Migration

Symptom:

```text
migration N was previously applied but has been modified
```

Cause:

- Another agent or development backend started while a new migration file was
  still being refined in the shared worktree.
- Later edits changed the file checksum recorded in `_sqlx_migrations`.

Fix:

1. Query the installed checksum and inspect the applied schema.
2. Restore the applied migration byte-for-byte, including trailing newlines.
3. Put every refinement in the next forward migration. Never rewrite the
   `_sqlx_migrations` ledger to hide drift.
4. Compare file SHA-384 with installed checksums before restarting any migrator.
5. Coordinate migration ownership in `docs/agent/hey.md`; do not launch a
   backend against the shared database until the new migration bytes are final.

---

## Next Dev Loses Webpack Chunks During A Concurrent Production Build

Symptom:

```text
Error: Cannot find module './983.js'
Caching failed ... .next/server/vendor-chunks
```

Cause:

- `next dev` and `next build` share `.next` by default. Running the production
  build while a development server is active can replace files the server is
  still using.

Fix:

1. Stop the development server before `pnpm build` or `scripts/self-test`.
2. Restart `next dev` after the build completes.
3. Verification scripts that need both processes should configure isolated
   Next output directories rather than sharing `.next`.

---

## Chrome MCP Has No DevToolsActivePort

Symptom:
```text
Could not connect to Chrome. Could not find DevToolsActivePort for chrome at
/home/bender/.config/google-chrome/DevToolsActivePort
```

Cause:
- Chrome is not running with the DevTools endpoint expected by Chrome MCP.

Fix:
1. Confirm Chrome is running before starting frontend visual verification.
2. Reconnect Chrome MCP and call its page-list command before opening a route.
3. If Chrome remains unavailable, record the exact blocker and run build, type, lint, and test gates. Do not claim browser verification.

---

## Congress.gov API key not found

Symptom:
```
Congress.gov API key not found. Returning empty bills.
```

Cause:
- `CONGRESS_GOV_API_KEY` not set in `.env` or `frontend/.env.local`
- Wrong key value (e.g., OpenFEC key used instead of Congress.gov key)

Fix:
1. Check `echo $CONGRESS_GOV_API_KEY`
2. Set in `.env`: `CONGRESS_GOV_API_KEY=your_key`
3. Set in `frontend/.env.local`: `NEXT_PUBLIC_CONGRESS_GOV_API_KEY=same_key`

---

## Proxy returns Congress.gov data but frontend shows "Data Unavailable"

Symptom:
```
GET /api/congress-proxy?url=... 200  (proxy works)
Error fetching legislator from proxy: TypeError: Cannot read properties of undefined (reading 'includes')
```

Cause:
- `mergeProxyMember` expects `member.name` but Congress.gov API returns `firstName`/`lastName`/`directOrderName` instead
- `terms` field is a direct array, not `{ item: [...] }`
- `partyName` is nested under `partyHistory[]`, not a flat field

Fix:
See `frontend/lib/services/legislators.ts` `mergeProxyMember` for the fallback chain that handles these API shape mismatches.

---

## Backend connection refused on port 4020

Symptom:
```
TypeError: Failed to fetch
ERR_CONNECTION_REFUSED
```

Cause:
- Backend not running

Fix:
```bash
cd backend && cargo run -p intel_backend --bin intel_backend
```

---

## Frontend API tests pass against a stale backend

Symptom:

- `pnpm test` passes while current Rust source and the response on port 4020
  expose different API states.
- CI frontend tests fail because no backend exists, even though the same command
  passed on a developer workstation.

Cause:

- Populated API flows were included in the deterministic `*.test.mjs` glob and
  defaulted to a manually managed backend on port 4020.
- A prior backend binary could therefore satisfy assertions after source changed.

Fix:

1. Use `pnpm test:unit` or `pnpm verify` for deterministic frontend checks.
2. Use `DATABASE_URL=... pnpm test:live-api` for populated API proof.
3. Do not call `e2e-api-flows.live.mjs` directly. The wrapper builds the current
   backend, starts it on an isolated port, and terminates that exact process.

---

## Trade data shows 0 buy/sell orders

Symptom:
- Buy Orders: 0, Sell Orders: 0 on portfolio page

Cause:
- `Trade` interface field names don't match backend response shape
- Backend returns `txType` not `type`, `asset.assetTicker` not `ticker`, etc.

Fix:
The `mapBackendTrade` adapter in `frontend/lib/api.ts` handles this. Ensure `fetchTrades` uses it.

---

## Cargo build: unresolved import / private module

Symptom:
```
error[E0432]: unresolved import `capitoltrades_api::client::CapitolTradesClient`
error[E0603]: module `client` is private
```

Cause:
- Importing private module paths instead of public re-exports

Fix:
Use the public re-exports:
```rust
use capitoltrades_api::Client as CapitolTradesClient;
use capitoltrades_api::TradeQuery;
```
Not:
```rust
use capitoltrades_api::client::CapitolTradesClient;
use capitoltrades_api::query::TradeQuery;
```

---

## Postgres unavailable

Symptom:
```
DATABASE_URL is required for intel_backend
```

Cause:
- `DATABASE_URL` environment variable not set
- PostgreSQL service not running
- Database or user does not exist

Fix:
1. Ensure PostgreSQL is running: `pg_isready`
2. Create user and database (see `docs/agent/workflows.md` Postgres Setup)
3. Set `export DATABASE_URL=postgres://congress_tracker:congress_tracker@localhost:5432/congress_tracker`

---

## Missing DB seed

Symptom:
- Endpoints return `database_not_seeded` or empty results

Cause:
- No data has been ingested yet

Fix:
```bash
cd backend && DATABASE_URL=postgres://congress_tracker:congress_tracker@localhost:5432/congress_tracker cargo run -p intel_backend --bin ingest -- all-smoke
```

---

## LDA URL migration to lda.gov

Symptom:
- Lobbying ingest fails with connection errors to `lda.senate.gov`

Cause:
- The old Senate LDA API at `lda.senate.gov` will no longer be available after `07/31/2026`

Fix:
- `LDA_API_BASE_URL` now defaults to `https://lda.gov/api`
- Set `LDA_API_BASE_URL=https://lda.gov/api` in `.env` if not already set
- If existing code still references `lda.senate.gov`, update it to use the new URL

---

## Missing OpenFEC key

Symptom:
- FEC ingest subcommands exit with source run status `auth_missing` or `rate_limited`

Cause:
- `OPENFEC_API_KEY` not set or set to `DEMO_KEY` (which has strict rate limits)

Fix:
1. Set `OPENFEC_API_KEY=your_real_key` in `.env`
2. Rerun the ingest command

---

## Congress.gov API shape drift

Symptom:
- Congress.gov bill/member/vote endpoints return unexpected JSON, causing deserialization errors

Cause:
- Congress.gov API may change response shapes between releases

Fix:
1. Inspect the exact official response before changing the type. Member
   sponsored/cosponsored pages legitimately mix bill rows with amendment rows;
   amendment rows have a canonical `url` but null `type`, `number`, and `title`.
2. Decode nullable row fields without failing the complete page, then validate
   each row independently and preserve it in `member_legislation_items`.
3. Keep bill/member upserts and the raw official evidence page-atomic. A
   terminal `loaded` coverage row requires `advertised_count = rows_seen =
   rows_written + duplicate_rows`; do not turn a nullable amendment into a
   request failure or silently discard it.
4. If an in-progress migration has already been installed by another process,
   restore its exact SHA-384 bytes and add the correction as a new forward
   migration. Never rewrite an applied migration.
5. Do not impose a 10,000-row Member-role ceiling. Congress 119 live data
   contained a 17,397-row role; the bounded implementation ceiling is 50,000.
6. Retry transient sends, body reads, 429s, and 5xx responses inside the HTTP
   attempt loop. Reduce page size through 250, 125, 62, and 50 only for request,
   body, or decode timeouts; authentication and other permanent 4xx failures
   must remain typed terminal errors.
7. Retry page transactions only for PostgreSQL `40P01` deadlocks and `40001`
   serialization failures. If an external watchdog interrupts a long backfill,
   resume the same source run with `member-legislation-all --congress N
   --resume-run-id UUID`; loaded Member roles must never be reset.

## Congress.gov vote resource returns 404

Symptom:
- `congress-votes` returns `Unknown resource: vote` from Congress.gov v3.

Cause:
- The current Congress.gov v3 API does not expose the legacy generic vote resource used by the old command.

Fix:
- Use the Congress-specific Voteview ingest for roll calls and member positions.
- Do not schedule `congress-votes` in the automatic profile evidence pipeline.

---

## FEC candidate-to-bioguide unresolved

Symptom:
- FEC candidates appear without associated member data
- `GET /api/admin/entity-resolution-queue` shows pending rows with `source_scheme='fec'`

Cause:
- The `member_identifiers` table lacks an FEC-to-bioguide crosswalk for that candidate
- Name/state/chamber fallback matching produced confidence below the `0.85` auto-attachment threshold

Fix:
1. Review `GET /api/admin/entity-resolution-queue` for pending entries
2. Accept matches manually or run a more complete `members` ingest to bring in missing crosswalks
3. Update crosswalk data from the `unitedstates/congress-legislators` dataset

---

## Legacy-only frontend endpoint

The audited pages now use the canonical routes. Keep this check when adding a new page; it remains a regression if a new call is introduced.

Symptom:
- A page returns empty data or `404` while the legacy `backend_server` would have served it.

Cause:
- The page calls `/api/congress/votes`, `/api/enrichment/*`, or legacy lobbying analytics while
  `run_all.sh` starts only `intel_backend`.

Fix:
- Use the canonical member, bill, committee, trade, funding, and filing routes. If a canonical
  source is not available yet, render an explicit unavailable state instead of returning fixture
  data or an empty success response.

## Census Data API redirects to a missing-key HTML page

**Symptom:** A county-name request returns HTTP 200 after redirects but the
body is an HTML `Missing Key` page, so JSON parsing fails and map labels fall
back to raw county codes.

**Cause:** The Census Data API endpoint requires a key in this environment.
HTTP status alone does not prove a JSON contract.

**Fix:** Use the official Census TIGERweb `State_County` query endpoint for
county identities and boundaries, scope each request with a supported two-digit
state FIPS code, request simplified GeoJSON, validate the response shape, and
cache the normalized result. The local route is
`/api/elections/counties?state=06`.
