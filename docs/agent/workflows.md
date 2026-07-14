# Developer Workflows

## Postgres Setup

Create the database user and database:

```bash
# Run as postgres user:
createuser congress_tracker -P  # password: congress_tracker
createdb congress_tracker -O congress_tracker

# Set the environment variable:
export DATABASE_URL=postgres://congress_tracker:congress_tracker@localhost:5432/congress_tracker
```

To make `DATABASE_URL` persistent, add it to `.env`:

```
DATABASE_URL=postgres://congress_tracker:congress_tracker@localhost:5432/congress_tracker
```

## Smoke Ingestion

Run the full smoke ingestion to verify the database setup:

```bash
cd backend
cargo run -p intel_backend --bin ingest -- all-smoke
```

This runs, in order: `members --current-only --limit 25`, `influence-seeds`, `fec-committees --q "AMERICAN ISRAEL" --limit 10`, `congress-bills --congress 119 --limit 10`, and `refresh-materialized-views`.

## Automatic profile evidence ingestion

`intel_worker` owns normal profile freshness. On startup and every six hours by default it runs the idempotent `profile-evidence-all` pipeline under a PostgreSQL advisory lock. The pipeline refreshes all current members, Congress.gov member and bill coverage, Voteview ideology and roll calls, FEC candidates, materialized views, and derived relationships. Voteview is the canonical vote source because the current Congress.gov v3 API does not expose the legacy `/vote` resource.

Set `PROFILE_EVIDENCE_REFRESH_SECONDS` to change the interval. The scheduled
child uses `INTEL_INGEST_BIN` directly, derives the current Congress and election
cycle from the calendar, and reaps its complete process group before releasing
the advisory lock. Member legislation uses one request/write stream for
`gaming`, `pi`, or `low`, two for the default balanced profile, and four only
for `burst`/`fast`. Manual ingest subcommands are diagnostics only and are not
required for normal server operation.

The worker schedules canonical FEC bulk refreshes for the current cycle and two
prior even cycles by default. `FEC_CYCLES` overrides that window. Until every
required file for a member and cycle is canonicalized and ranked, candidate
totals remain labeled `Totals only`; the UI must not promote partial receipts
into a complete donor ranking.

## Start Backend

Start the new intelligence backend:

```bash
cd backend
DATABASE_URL=postgres://congress_tracker:congress_tracker@localhost:5432/congress_tracker cargo run -p intel_backend
```

The server listens on port `4020` by default (configurable via `PORT` in `.env`). Additional env vars:

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `DATABASE_URL` | — | Yes | Postgres connection string |
| `CONGRESS_GOV_API_KEY` | — | No (for API calls) | Congress.gov API key |
| `OPENFEC_API_KEY` | — | No (for API calls) | OpenFEC API key |
| `INTEL_CACHE_TTL_SECONDS` | `300` | No | Moka cache TTL for GET responses |
| `SENATE_LDA_API_KEY` | — | No | Senate LDA API key; raises rate limits |
| `PORT` | `4020` | No | Server listen port |
| `RUST_LOG` | — | No | Tracing/log level (e.g. `info`, `debug`) |
| `WORKER_RESOURCE_PROFILE` | `interactive` | No | Worker bounds: `pi`, `interactive`, or explicit opt-in `burst` |
| `JOB_LEASE_RENEW_SECONDS` | `30` | No | Refresh interval for owned running-job leases (clamped 5–300s) |
| `PARSER_DOCUMENT_TIMEOUT_SECONDS` | `600` | No | Hard document extraction/OCR wall budget (clamped 30–3600s) |
| `PARSER_MAX_PAGES` | `100` | No | Maximum pages rendered for OCR (clamped 1–500) |
| `PARSER_MAX_PDF_BYTES` | `104857600` | No | Maximum parser input size |
| `PARSER_MAX_SCRATCH_BYTES` | `536870912` | No | Maximum checked OCR scratch footprint |

The default `interactive` worker profile runs one parser and three downloads,
renices native PDF/OCR children, reserves two logical CPUs and 2 GiB of
available memory before starting OCR, and never uses the GPU. `pi` lowers the
memory ceiling and keeps one parser/two downloads. `burst` raises bounded
parallelism and memory only when an operator opts in. All profiles produce the
same normalized records and retain the same evidence gates.

## Start Frontend

```bash
cd frontend
NEXT_PUBLIC_BACKEND_URL=http://localhost:4020 pnpm dev
```

The frontend connects to the `intel_backend` server on port 4020 for all data.

## Verify Funding Attribution

Check that funding attribution separates direct receipts from independent expenditures:

```bash
curl http://127.0.0.1:4020/api/members/{id}/funding?cycle=2026
```

Expected response shape:

```json
{
  "member": { "bioguide_id": "...", "name": "..." },
  "cycle": 2026,
  "direct_receipts": { "total": 0, "pac": 0, "individual": 0 },
  "independent_expenditures_supporting": { "total": 0, "committees": [] },
  "independent_expenditures_opposing": { "total": 0, "committees": [] },
  "provenance": { "sources": [], "warnings": [] }
}
```

**Critical rule:** Independent expenditures must NOT be summed into direct receipts. They are separate categories.

## Ingest Individual Sources

### Seed Members (unitedstates/congress-legislators)

Downloads current legislators from the unitedstates community dataset (CC0), writes member biographical data, terms, identifiers (bioguide, FEC, ICPSR, etc.), social media accounts, committees, and committee memberships:

```bash
cd backend
cargo run -p intel_backend --bin ingest -- members --current-only --limit 100
```

### Seed Influence Networks

Seeds known influence networks (AIPAC/pro-Israel PACs) from verified FEC committee IDs:

```bash
cd backend
cargo run -p intel_backend --bin ingest -- influence-seeds
```

### Ingest Bills (Congress.gov)

Requires `CONGRESS_GOV_API_KEY` set in environment or `.env`:

```bash
cd backend
CONGRESS_GOV_API_KEY=your_key cargo run -p intel_backend --bin ingest -- congress-bills --congress 119 --limit 50
```

### Refresh All Current-Member Legislation

Normal refresh is worker-owned and runs the native ingest executable. The
manual command is a diagnostic and recovery entry point:

```bash
cd backend
CONGRESS_GOV_API_KEY=your_key cargo run -p intel_backend --bin ingest -- member-legislation-all --congress 119
```

The provider contract exhausts both Member roles with a 50,000-row safety
ceiling. It starts at 250 rows per request and reduces only size-sensitive
failures through 125, 62, and 50. If an external watchdog interrupts a valid
run, resume the same coverage ledger without resetting loaded roles:

```bash
backend/target/release/ingest member-legislation-all --congress 119 --resume-run-id UUID
```

Worker subprocess timeouts are profile-aware: 12 hours for gaming/Pi/low, six
hours for balanced/interactive, and four hours for burst/fast. All profiles
produce the same evidence and terminal reconciliation; only concurrency and
resource ceilings differ.

### Ingest FEC Data

Requires `OPENFEC_API_KEY` set in environment or `.env`:

```bash
cd backend
OPENFEC_API_KEY=your_key cargo run -p intel_backend --bin ingest -- fec-committees --q "AMERICAN ISRAEL" --limit 10
```

### Ingest FEC Candidates

```bash
cd backend
OPENFEC_API_KEY=your_key cargo run -p intel_backend --bin ingest -- fec-candidates --cycle 2024 --limit 100
```

### Ingest FEC Transactions (Direct Contributions)

```bash
cd backend
OPENFEC_API_KEY=your_key cargo run -p intel_backend --bin ingest -- fec-transactions --cycle 2024 --committee-id C00797670 --limit 500
```

### Ingest FEC Independent Expenditures

```bash
cd backend
OPENFEC_API_KEY=your_key cargo run -p intel_backend --bin ingest -- fec-independent-expenditures --cycle 2024 --committee-id C00799031 --limit 500
```

### Ingest Lobbying Filings

```bash
cd backend
SENATE_LDA_API_KEY=your_key cargo run -p intel_backend --bin ingest -- lobbying-filings --year 2025 --page-size 50 --limit-pages 5
```

### Ingest Stock Trades

```bash
cd backend
cargo run -p intel_backend --bin ingest -- capitol-trades --limit 100
```

### Refresh Materialized Views

Refreshes `member_funding_cycle_mv`, `member_vote_summary_mv`, and `influence_network_member_mv`:

```bash
cd backend
cargo run -p intel_backend --bin ingest -- refresh-materialized-views
```

### Run Full Smoke

```bash
cd backend
cargo run -p intel_backend --bin ingest -- all-smoke
```

## Testing Endpoints

After starting the backend, verify the API is responsive:

```bash
# Health check
curl http://127.0.0.1:4020/api/health

# Page dashboard and source freshness
curl http://127.0.0.1:4020/api/home/summary
curl http://127.0.0.1:4020/api/sources/status

# Influence networks (seeded)
curl http://127.0.0.1:4020/api/influence/networks/aipac

# Member profile (after member ingest)
curl http://127.0.0.1:4020/api/members/A000360/profile

# Canonical page endpoints
curl 'http://127.0.0.1:4020/api/bills?limit=10'
curl 'http://127.0.0.1:4020/api/lobbying/filings?limit=10'
curl 'http://127.0.0.1:4020/api/elections/candidates?limit=10'
curl 'http://127.0.0.1:4020/api/stocks/transactions?limit=10'

# Search
curl 'http://127.0.0.1:4020/api/search?q=schumer&type=all'
```

## Entity Resolution

When FEC candidates or Voteview records lack a known Bioguide ID crosswalk, they appear in the entity resolution queue:

```bash
curl http://127.0.0.1:4020/api/admin/entity-resolution-queue
```

Review pending entries and accept/reject matches. Auto-attachment requires confidence >= 0.85.

## Full Verification

```bash
cd backend && cargo test -p intel_backend && \
  cargo fmt --check && \
  cargo clippy --all-targets --all-features
cd frontend && npx tsc --noEmit && pnpm lint
```
