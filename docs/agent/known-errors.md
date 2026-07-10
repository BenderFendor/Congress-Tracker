# Known Errors

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
cd backend && cargo run -p backend_server
```

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
1. Use the `raw_json` field in database tables to inspect the actual API response
2. Update the corresponding types in `backend/crates/congress_api/src/types.rs`
3. Update the ingest parser in `backend/crates/intel_backend/src/ingest/`

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
