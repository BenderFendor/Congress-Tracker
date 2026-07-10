# Worker Pipeline Architecture

## Overview

The `intel_worker` binary replaces the old manual-ingest + seed-sync architecture with an automated, durable pipeline that discovers, downloads, parses, and versions House Clerk financial disclosures continuously.

**Process**: `./run_all.sh` starts three processes:
- `intel_backend` — Axum API server (port 4020)
- `next dev` — Next.js frontend (port 3000)
- `intel_worker` — background ingest worker

## Data flow

```
House Clerk {year}FD.zip
    ↓ run_discovery()
source_index_entries
    ↓ (new entries → ingest_jobs)
download_document jobs
    ↓ run_downloads()
disclosure_documents + document_versions
    ↓ (new versions → ingest_jobs)
parse_document jobs
    ↓ run_parses()
disclosure_transactions
    ↓ run_resolve()
stock_trades (materialized view)
    ↓ GET /api/stocks/transactions
frontend Portfolio page
```

## Key tables

| Table | Purpose |
|-------|---------|
| `source_index_entries` | One row per Clerk tab-separated index entry |
| `ingest_jobs` | Durable work queue (FOR UPDATE SKIP LOCKED) |
| `worker_heartbeats` | Health monitoring |
| `document_versions` | Versioned PDF storage (never overwrite) |
| `parse_attempts` | Parse history per attempt |
| `parse_issues` | Unparseable content for review |
| `disclosure_filings` | Filing metadata + amendment links |
| `disclosure_assets` | Asset holdings from annual reports |
| `disclosure_income/liabilities/gifts/positions` | Phase 3 tables |
| `stock_trades` | **Materialized view** — computed from disclosure_transactions |

## Migration order

| Migration | Purpose |
|-----------|---------|
| 0001 | Core schema (members, committees, stock_trades table, source_runs, data_sources) |
| 0002 | Enrichment columns on stock_trades |
| 0003 | Committee referrals on bills |
| 0004 | Evidence entities (organizations, disclosure_documents/transactions/holdings, relationship_evidence) |
| 0005 | Relationship derivation source |
| 0006 | Worker pipeline tables (source_index_entries, ingest_jobs, document_versions, parse_attempts, parse_issues, disclosure_filings, disclosure_assets) |
| 0007 | Replace stock_trades table with materialized view |
| 0008 | Annual report tables + member_financial_snapshots view |
| 0009 | Enrichment functions (resolve_ticker_sector, committee_overlap) + overlap columns |
| 0010 | Updated stock_trades view with enrichment function calls |
| 0011 | Repairs upgraded installs, queue version linkage, and non-inflating financial snapshots |
| 0012 | Grants worker roles access to identity sequences used during document and relationship inserts |
| 0013 | Grants worker roles permission to write resolved relationship evidence |
| 0014 | Adds the persistent member funding cache used by the OpenFEC totals fallback |
| 0015 | Keeps source transaction dates but nulls impossible negative filing intervals |

## PL/pgSQL enrichment functions

### `resolve_ticker_sector(ticker TEXT) → (sector TEXT, industry TEXT)`
Looks up ticker in `ticker_lookup` table. Returns empty strings if not found.

### `committee_overlap(bioguide_id, ticker, sector, industry) → (severity, committee_names, committee_conflicts, flag_count)`
Computes committee jurisdiction overlap using the same rules as the Rust `committee_detector` crate:
- Armed Services ↔ Aerospace & Defense → DIRECT OVERLAP
- Energy ↔ Energy → DIRECT OVERLAP
- Financial Services/Banking ↔ Financial Services → DIRECT OVERLAP
- Health/Ways & Means ↔ Healthcare → DIRECT OVERLAP
- Commerce/Judiciary/Intelligence ↔ Technology → DIRECT OVERLAP
- Appropriations → DIRECT OVERLAP (broad jurisdiction)
- Armed Services ↔ Technology → ADJACENT
- Health ↔ Technology → ADJACENT
- Commerce ↔ Industrials → ADJACENT
- Oversight/Homeland Security → ADJACENT

## Worker poll loop

All intervals are configurable via constants in main.rs:

| Step | Interval | What it does |
|------|----------|-------------|
| Discovery | 30 min | Downloads {year}FD.zip, parses TSV, records every row, and enqueues supported `P` filings |
| Download | 10 sec | Processes 5 pending download jobs per tick |
| Parse | 10 sec | Processes 5 pending parse jobs per tick |
| Resolve | 60 sec | Matches identities, derives relationships, refreshes view |
| Heartbeat | 30 sec | Writes worker health row |

## Operational notes

- **Storage**: PDFs saved to `$WORKER_STORAGE_DIR` (default `./worker_storage`).
- **Current parser scope**: periodic transaction reports (`FilingType=P`). Other Clerk forms stay indexed for coverage and are not presented as successful zero-row parses.
- **PTR URLs**: periodic reports use `/public_disc/ptr-pdfs/{year}/{DocID}.pdf`; other financial forms use a different directory and are not queued until their parsers are production-ready.
- **Rate limiting**: Exponential backoff `2^attempts + rand(0..30)` seconds on 429/503.
- **Idempotency**: All steps use ON CONFLICT DO NOTHING or advisory locks. Re-running the worker with the same data is safe.
- **Source chronology**: Official filings can contain dates that are internally out of order. The API preserves both source dates and reports `disclosure_lag_days: null` for those rows instead of exposing a negative interval.
- **Backfill**: `cargo run -p intel_worker --bin intel_worker -- --backfill` iterates years 2012→current.
- **Systemd**: `intel_worker.service` handles auto-restart and security hardening.
- **Health**: `GET /api/system/worker-health` and `GET /api/system/disclosure-coverage`.
