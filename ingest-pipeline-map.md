# Ingest Pipeline Map — congress-tracker

> Historical snapshot: the inventory below predates the durable worker. The current canonical architecture is documented in `docs/agent/worker-pipeline.md`. `run_all.sh` now starts `intel_backend`, Next.js, and `intel_worker`; migrations 0006-0011 provide the queue, immutable document versions, parse attempts, retries, source-run freshness, and repaired materialized views.

## Architecture Overview
- **Entrypoint**: `/home/bender/classwork/congress-tracker/backend/crates/intel_backend/src/bin/ingest.rs` (2766 lines)
- **Repository**: `/home/bender/classwork/congress-tracker/backend/crates/intel_backend/src/repository/` (12 modules)
- **Schema**: `/home/bender/classwork/congress-tracker/backend/crates/intel_backend/src/schema.rs`
- **Disclosures (House PTR parser)**: `/home/bender/classwork/congress-tracker/backend/crates/intel_backend/src/disclosures.rs`

## Historical Job Queue / Worker / Scheduler State
The following statements describe the pre-worker snapshot and are retained only as review provenance.
- `entity_resolution_queue` table has insert/query operations but no worker processes entries
- All ingest is synchronous CLI — blocks until done, no retry, no queue
- `run_all.sh` (repo root) starts backend_server + frontend dev server only
- Only Makefile is `backend/Makefile` with single `build` target

## Enrichment Crates — NOT used in ingest
Four workspace crates exist but are only used by the backend server (`backend_server/src/main.rs`), never by ingest:
- `trade_enricher` — ticker resolution + committee conflict detection
- `committee_detector` — committee stock conflict keywords
- `ticker_resolver` — ticker-to-sector/industry resolution
- `anomaly_scorer` — 6-signal weighted anomaly scoring

## Global Behavior
- Every source-connecting subcommand creates a `source_runs` row via `create_source_run(source, endpoint, params)`
- Finishes via `finish_api_run()` or direct `finish_source_run(status, seen, written, error)`
- `source_run_status` enum values: `success`, `failed`, `auth_missing`, `rate_limited`
- Most use PostgreSQL `ON CONFLICT` upsert for idempotence
- HousePtr is the explicitly non-idempotent exception
- Config via env vars: `DATABASE_URL`, `CONGRESS_GOV_API_KEY`, `OPENFEC_API_KEY` (DEMO_KEY fallback), `SENATE_LDA_API_KEY` (optional)

## Source Constants (from schema.rs)
| Constant | Value |
|---|---|
| SOURCE_UNITEDSTATES | `unitedstates_legislators` |
| SOURCE_CONGRESS_GOV | `congress_gov` |
| SOURCE_OPENFEC | `openfec` |
| SOURCE_LDA | `lda` |
| SOURCE_VOTEVIEW | `voteview` |
| SOURCE_CAPITOLTRADES | `capitoltrades` |
| SOURCE_MANUAL | `manual_influence_seed` |
| SOURCE_RELATIONSHIP_DERIVATION | `relationship_derivation` |
| (hardcoded) | `house_disclosures` |

## Full Subcommand Map (19 total)

### 1. InfluenceSeeds — No args
- **Source**: Hardcoded seed data (13 networks, 17 committees)
- **Tables**: `influence_networks`, `influence_network_committees`
- **source_runs**: Yes (`SOURCE_MANUAL`)
- **Idempotent**: Yes (upsert on conflict)

### 2. Members — `--current-only`, `--limit` (default 100)
- **Source**: `unitedstates.github.io/congress-legislators` (legislators-current.json or legislators-historical.json, legislators-social-media.json, committees-current.json, committee-membership-current.json)
- **Tables**: `members`, `member_identifiers`, `member_terms`, `social_accounts`, `committees` (raw SQL), `committee_memberships`
- **source_runs**: Yes (`SOURCE_UNITEDSTATES`)
- **Idempotent**: Yes (all upserts)

### 3. CongressMembers — `--limit` (default 100)
- **Source**: Congress.gov API `/v3/member` via `congress_api` crate
- **Tables**: `members` (minimal insert if absent, depiction_url update if present)
- **source_runs**: Yes (`SOURCE_CONGRESS_GOV`)
- **Idempotent**: Yes (COALESCE update, does not overwrite higher-confidence data)

### 4. CongressBills — `--congress`, `--limit` (default 50)
- **Source**: Congress.gov API `/v3/bill` via `congress_api` crate
- **Tables**: `bills`, `bill_sponsors`
- **source_runs**: Yes (`SOURCE_CONGRESS_GOV`)
- **Idempotent**: Yes (upsert)

### 5. CongressVotes — `--congress`, `--chamber`, `--limit` (default 50)
- **Source**: Congress.gov API `/v3/vote` via `congress_api` crate
- **Tables**: `roll_call_votes`, `member_votes`
- **source_runs**: Yes (`SOURCE_CONGRESS_GOV`)
- **Idempotent**: Yes (upsert)

### 6. FecCandidates — `--cycle`, `--limit` (default 100)
- **Source**: OpenFEC API `/v1/candidates` via `openfec_api` crate
- **Tables**: `fec_candidates`, `entity_resolution_queue` (unmatched bioguide)
- **source_runs**: Yes (`SOURCE_OPENFEC`)
- **Idempotent**: Yes (upsert)

### 7. FecCommittees — `--q`, `--limit` (default 20)
- **Source**: OpenFEC API `/v1/committees` via `openfec_api` crate
- **Tables**: `fec_committees`
- **source_runs**: Yes (`SOURCE_OPENFEC`)
- **Idempotent**: Yes (upsert)

### 8. FecTransactions — `--cycle`, `--committee-id`, `--limit` (default 100)
- **Source**: OpenFEC API `/v1/schedules/schedule_a` (receipts)
- **Tables**: `fec_transactions`
- **source_runs**: Yes (`SOURCE_OPENFEC`)
- **Idempotent**: Yes (deterministic tx_id: `receipt-{committee}-{date}-{contributor}`)
- **Note**: Per-row errors wrapped in warnings, does not fail

### 9. FecIndependentExpenditures — `--cycle`, `--committee-id`, `--limit` (default 100)
- **Source**: OpenFEC API `/v1/schedules/schedule_e`
- **Tables**: `fec_transactions` (typed `independent_expenditure`)
- **source_runs**: Yes (`SOURCE_OPENFEC`)
- **Idempotent**: Yes (deterministic tx_id: `ie-{committee}-{date}-{candidate}`)

### 10. LobbyingFilings — `--year`, `--page-size` (default 50), `--limit-pages` (default 5)
- **Source**: LDA API via `lobbying_client` crate (optional `SENATE_LDA_API_KEY`)
- **Tables**: `lobbying_registrants`, `lobbying_clients`, `lobbying_filings`, `lobbying_activities`
- **source_runs**: Yes (`SOURCE_LDA`)
- **Idempotent**: Partial (upserts registrants/clients/filings; pure INSERT for activities — no dedup)

### 11. DisclosureManifest — `--path`, `--source`
- **Source**: Local JSONL file (path arg)
- **Tables**: `disclosure_documents`
- **source_runs**: Yes (user-supplied source string)
- **Idempotent**: Yes (upsert on `source` + `source_record_id`)

### 12. OrganizationManifest — `--path`, `--source`
- **Source**: Local JSONL file (path arg)
- **Tables**: `organizations`, `organization_identifiers`
- **source_runs**: Yes (user-supplied source)
- **Idempotent**: Yes (upsert)

### 13. HousePtr — `--pdf-path`, `--bioguide-id`, `--filing-id`, `--source-url`
- **Source**: Local PDF → `pdftotext -layout` → `disclosures::parse_house_ptr_text()`
- **Tables**: `disclosure_documents`, `disclosure_transactions`
- **source_runs**: Yes (hardcoded `"house_disclosures"`)
- **Idempotent**: **NO** — always creates new rows, no dedup key
- **Parser**: `disclosures.rs` — identifies transaction lines by US date, extracts owner_type, asset_name, ticker, tx_type, amount range, dates. Ticker from `(TICKER)`, `NYSE:TICKER`, `NASDAQ:TICKER` patterns in next 2 lines.

### 14. HousePtrUrl — `--url`, `--output-path`, `--bioguide-id`, `--filing-id`
- **Source**: HTTP download from URL → saves to file → delegates fully to `cmd_house_ptr`
- **Tables**: `disclosure_documents`, `disclosure_transactions` (via cmd_house_ptr)
- **source_runs**: Yes (created inside cmd_house_ptr)
- **Idempotent**: No (same as HousePtr)
- **Note**: Verifies PDF header bytes `%PDF`. No own source_run — inherits from cmd_house_ptr.

### 15. CapitolTrades — `--limit` (default 50)
- **Source**: `capitoltrades.com` API via `capitoltrades_api` crate (cookie-primed, paginated page_size=100)
- **Tables**: `stock_trades`
- **source_runs**: Yes (`SOURCE_CAPITOLTRADES`)
- **Idempotent**: Yes (trade ID: `ct-{tx_id}`, upsert)
- **Note**: Resolves bioguide by name matching against members table

### 16. Voteview — `--members`, `--votes`, `--rollcalls`
- **Source**: `voteview.com/static/data/out/` CSV files (HSall_members.csv, HSall_rollcalls.csv, HSall_votes.csv)
- **Tables**: `members` (nominate_dim1/2 update), `roll_call_votes`, `member_votes`, `entity_resolution_queue` (unmatched ICPSR)
- **source_runs**: Yes (`SOURCE_VOTEVIEW`)
- **Idempotent**: Yes (COALESCE/upsert)
- **Note**: Three optional sub-ingests controlled by flags

### 17. RefreshMaterializedViews — No args
- **Source**: None (internal SQL)
- **Tables**: `member_funding_cycle_mv`, `member_vote_summary_mv`, `influence_network_member_mv` (REFRESH MATERIALIZED VIEW CONCURRENTLY, falls back to non-concurrent)
- **source_runs**: No
- **Idempotent**: Yes

### 18. RefreshRelationships — No args
- **Source**: Derived from existing DB tables
- **Tables**: `organizations` (auto-derived from fec_committees, lobbying_clients/registrants, stock_trades, disclosure_transactions), `organization_identifiers`, `relationship_evidence`
- **source_runs**: Yes (`SOURCE_RELATIONSHIP_DERIVATION`)
- **Idempotent**: Yes (upsert)
- **Entity types created**: FEC committees → PAC/super_PAC, lobbying → lobbying_client/registrant, tickers → company

### 19. AllSmoke — No args
- **5-step smoke test**: Members(limit=25) → InfluenceSeeds → FecCommittees(q=AMERICAN ISRAEL, limit=10) → CongressBills(119, limit=10) → RefreshMaterializedViews
- Individual source_runs per step. Exits 1 on any failure.
- Verifications: >=20 members written, AIPAC network exists with >=3 committees

## Repository Module Table Map (all at `backend/crates/intel_backend/src/repository/`)
| File | Tables Written |
|---|---|
| `members.rs` | `members`, `member_identifiers`, `member_terms`, `social_accounts`, `committee_memberships` |
| `fec.rs` | `fec_candidates`, `fec_committees`, `fec_transactions` |
| `bills.rs` | `bills`, `bill_sponsors`, `bill_actions`, `bill_subjects`, `bill_text_versions` |
| `votes.rs` | `roll_call_votes`, `member_votes` |
| `influence.rs` | `influence_networks`, `influence_network_committees` |
| `lobbying.rs` | `lobbying_registrants`, `lobbying_clients`, `lobbying_filings`, `lobbying_activities` |
| `trades.rs` | `stock_trades` |
| `organizations.rs` | `disclosure_documents`, `disclosure_transactions`, `disclosure_holdings`, `organizations`, `organization_identifiers`, `relationship_evidence` |
| `entity_resolution.rs` | `entity_resolution_queue` |
| `source_runs.rs` | `source_runs` |
| `search.rs` | (read-only search queries) |
