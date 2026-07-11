# PTR Disclosures — Worker Pipeline

## Overview

The worker automates ingestion of House Clerk financial disclosures. It replaces the old manual `cargo run -p intel_backend --bin ingest -- house-ptr --pdf-path ...` workflow and the `seed.rs` count-comparison sync.

## Architecture

```
intel_worker (Rust tokio process)
├── run_discovery()    - downloads {year}FD.zip, parses TSV, enqueues supported forms
├── run_downloads()    - fetches PDFs with bounded concurrency and versions them
├── run_parses()       - extracts text/OCR, dispatches parsers, and stores results
├── run_resolve()      - matches members, resolves assets, builds snapshots, refreshes views
└── heartbeat_loop()   - writes health independently every 30 seconds
```

## Storage Architecture

### Document storage (`worker_storage/`)

PDFs are downloaded to a persistent directory configured via `WORKER_STORAGE_DIR` env var (default `./worker_storage`). The directory is created on worker startup.

Each document version is tracked in the `document_versions` table with a SHA-256 hash. The same PDF at the same URL can be re-downloaded — if the hash matches an existing version, the new download is skipped.

### Database tables for source tracking

| Table | Key constraint |
|-------|---------------|
| `source_index_entries` | `PRIMARY KEY (source_name, source_year, source_document_id)` |
| `disclosure_documents` | `UNIQUE (source, source_record_id)` |
| `document_versions` | `UNIQUE (document_id, sha256)` |
| `disclosure_transactions` | `UNIQUE (document_id, owner_type, asset_name, ticker, transaction_type, transaction_date)` |

All INSERTs use ON CONFLICT clauses — the pipeline is idempotent.

## Worker Functions

### `run_discovery(pool, backfill)`

1. Acquires advisory lock `pg_try_advisory_lock(hashtext('house_clerk_{year}'))`
2. Downloads `https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.zip`
3. Extracts `{year}FD.txt` (tab-separated text) via `unzip -p`
4. Parses the Clerk columns:
   - `First`, `Last` → filer name
   - `StateDst` → state/district
   - `FilingType` → P, A, C, etc.
   - `FilingDate` → MM/DD/YYYY
   - `DocID` → Clerk document identifier
   - `Year` → filing year
5. INSERTS into `source_index_entries` ON CONFLICT DO NOTHING
6. Enqueues every newly discovered form. Core forms `A`, `O`, `N`, `T`, and `P` receive priority; other codes remain indexed and deferred.
7. Releases advisory lock

**Backfill mode**: `--backfill` flag iterates years from 2012 (STOCK Act) through current year.

### `run_downloads(pool)`

1. Selects a bounded batch of pending `download_document` jobs with `FOR UPDATE SKIP LOCKED`.
2. Uses the PTR directory for `P` forms and the financial-report directory for other forms.
3. Downloads via reqwest with descriptive User-Agent
4. Computes SHA-256 of PDF bytes
5. UPSERTs `disclosure_documents` row (creates if new document, updates SHA if changed)
6. INSERTS into `document_versions` ON CONFLICT DO NOTHING
7. If version is new: enqueues `parse_document` job. If version existed: marks download job `skipped`
8. On HTTP 429 or 503: sets `available_at = now() + 2^attempts + rand(0..30) seconds`

### `run_parses(pool)`

1. SELECTs 5 pending `parse_document` jobs with `FOR UPDATE SKIP LOCKED`
2. Reads the immutable PDF version from its persisted `storage_key`
3. Runs `pdftotext -layout <pdf> -` via `std::process::Command`
4. Calls `parsers::fingerprint()` and uses the authoritative Clerk `P` filing code when embedded fonts collapse the visible title during text extraction
5. Dispatches to a layout-specific parser:
   - `PtrElectronic2022Plus` or `PtrLegacy2015To2021` or `PtrPre2015` → `parsers::parse_ptr_text()`
   - `AnnualElectronic` or `AnnualScanned` -> OCR/text extraction followed by the annual parser
   - `Unknown` → no extraction, stored in `parse_issues`
6. Inserts PTR transactions and annual assets/liabilities with idempotent keys.
7. Records `parse_attempt` with status (`success`/`partial`/`failed`) and row count
8. Stores unparseable rows in `parse_issues` with page number, raw text, issue type
9. Wrapped in `std::panic::catch_unwind` — panics mark attempt failed, job retries on next tick

### `run_resolve(pool)`

1. Matches transactions with NULL bioguide_id against `members` table using name+state from the index entry
2. Resolves tickers to `organization_identifiers` (companies with matching asset names)
3. Derives `relationship_evidence` edges (member → organization via disclosed_trade)
4. Builds range-safe financial snapshots and executes `REFRESH MATERIALIZED VIEW stock_trades`.

## Parser Tiers

Three tiers of parser quality, dispatched by `parsers::fingerprint()`:

| Tier | Layout | Parser | Notes |
|------|--------|--------|-------|
| 1 | `PtrElectronic2022Plus` | `parse_ptr_text()` (existing `disclosures.rs`) | Modern electronic PTRs with structured columns |
| 2 | `PtrLegacy2015To2021` | `parse_ptr_legacy()` — collapses multi-line names, normalizes whitespace, then passes to standard parser | Pre-2022 format with less structure |
| 3 | `PtrPre2015` | `parse_ptr_text()` with relaxed heuristics | Pre-STOCK Act era; fewer fields available |
| 3 | `AnnualElectronic` | `parse_annual_electronic()` extracts current asset and liability sections | Annual reports with table-based layouts |
| 3 | `AnnualScanned` | `extract_text_with_ocr()` then the annual parser | Image-based PDFs using `pdftoppm` and Tesseract |
| - | `Unknown` | No extraction | Stored in `parse_issues` for manual review |

## Migrations

The pipeline adds 5 migrations to the existing 0001-0005 set:

| Migration | Tables/Functions |
|-----------|-----------------|
| 0006 | `source_index_entries`, `ingest_jobs` (with enum), `worker_heartbeats`, `document_versions`, `parse_attempts`, `parse_issues`, `disclosure_filings`, `disclosure_assets` |
| 0007 | Drops `stock_trades` table, creates materialized view over `disclosure_transactions` + `members` |
| 0008 | `disclosure_income`, `disclosure_liabilities`, `disclosure_gifts`, `disclosure_positions`, `member_financial_snapshots` view |
| 0009 | `ticker_lookup` table (20 seed tickers), `resolve_ticker_sector()` function, `committee_overlap()` function (150 lines), overlap columns on `disclosure_transactions` |
| 0010 | Recreates `stock_trades` view with enrichment function calls |
| 0011 | Repairs upgraded installs, links parse jobs to immutable document versions, and rebuilds financial snapshots without one-to-many inflation |
| 0012 | Grants worker roles the sequence privileges required for document and relationship inserts |
| 0013 | Grants worker roles permission to write resolved relationship evidence |

## Rate-Limit Backoff

The worker implements exponential backoff with jitter on Clerk rate limiting:

```rust
let delay_secs = 2u64.pow(attempts as u32) + rand::thread_rng().gen_range(0..30);
// Update job: available_at = now() + delay_secs, attempts += 1
```

Max retries: 5 (configurable in `ingest_jobs.max_attempts`). After max retries, job is marked `failed`.

## Systemd Unit

`intel_worker.service` provides:
- `Type=simple` — long-running foreground process
- `Restart=always` — auto-restart on crash
- `RestartSec=10` — 10-second delay between restarts
- `PrivateTmp=yes` — isolated /tmp
- `ProtectSystem=strict` — read-only filesystem except designated paths
- `ReadWritePaths` — `target/` and `/var/lib/congress-tracker` are writable; disclosure PDFs persist under the service state directory

## Operational Commands

| Command | Purpose |
|---------|---------|
| `./run_all.sh` | Start backend + frontend + worker |
| `curl localhost:4020/api/system/worker-health` | Check worker status |
| `curl localhost:4020/api/system/disclosure-coverage` | Pipeline statistics |
| `cargo run -p intel_worker --bin intel_worker -- --backfill` | Historical backfill |
| `SELECT COUNT(*) FROM ingest_jobs WHERE status='failed'` | Check for failed jobs |
