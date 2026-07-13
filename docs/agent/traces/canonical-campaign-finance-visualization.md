# Canonical campaign-finance visualization

**Goal:** Make the campaign-finance visualization read canonical FEC Schedule
A, Schedule B, and Schedule E data, keep outside spending separate from direct
campaign activity, and prevent the top-sector display limit from truncating
headline totals.

**Files changed:**

- `backend/crates/intel_backend/src/routes/visualizations.rs`
- `backend/crates/intel_backend/src/fec_bulk/pipeline.rs`
- `backend/crates/intel_backend/src/fec_bulk/disbursements.rs`
- `backend/crates/intel_backend/src/fec_bulk/supplemental_ingest.rs`
- `backend/crates/intel_backend/migrations/0039_fec_campaign_finance_summaries.sql`
- `frontend/app/visualizations/page.tsx`
- `docs/agent/test-catalog.md`
- `docs/agent/traces/canonical-campaign-finance-visualization.md`

**Commands run:**

- `cd backend && cargo fmt -p intel_backend`: passed.
- `cd backend && cargo check -p intel_backend`: passed.
- `cd backend && cargo test -p intel_backend routes::visualizations::tests -- --nocapture`: passed, 2 tests.
- `cd frontend && pnpm exec tsc --noEmit`: passed.
- `cd frontend && pnpm exec eslint app/visualizations/page.tsx --max-warnings=0`: passed.
- `cd frontend && pnpm exec oxlint app/visualizations/page.tsx --deny-warnings`: passed.
- Scoped `git diff --check`: passed.
- PostgreSQL `EXPLAIN` before the fix estimated parallel sequential scans of
  5.1 million 2024 individual-receipt rows per worker for both the total and
  sector queries, with plan costs near 1.2 million.
- Migration 0039 backfilled all three loaded cycles in set-based passes in
  130.20 seconds. This is a one-time deployment/ingestion cost.
- An attempted ignored migration integration test was rejected because
  `MIGRATION_TEST_DATABASE_URL` was not configured with a disposable database;
  the real migration was instead applied successfully through SQLx startup and
  ledger version 39 records `success = true`.
- Live 2024 endpoint on port 4099: cold `200` in 20.6 ms; warm `200` in 4.4 ms.
- Post-fix `EXPLAIN`: primary-key index scan for the cycle total and a bounded
  bitmap index scan plus sort for the small sector summary.
- Final targeted Rust verification: 3 passed, 0 failed. Port 4099 was stopped
  after timing proof.

**Tests added:** Three focused Rust unit tests prove the top-N display cannot be
used as the canonical total and prove the coverage states `loaded`, `partial`,
`loaded_empty`, and `not_loaded` remain distinct. The third test guards the
interactive SQL against canonical fact-table references and retains its top-20
bound.

**Assumptions:** `fec_bulk_imports` is the canonical completion ledger;
`indivYY`, `othYY`, `oppexpYY`, and `independent_expenditure_YYYY` are the
dataset names written by the bulk pipeline. Ingestion owns refreshing exact
cycle and sector summaries after each canonical channel changes.

**Risk tier:** medium.

**Rollback:** Revert the four files listed above. No schema or stored data was
changed.

**Status:** done.
