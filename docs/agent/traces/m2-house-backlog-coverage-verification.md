# M2 House backlog coverage verification

**Goal:** Produce a source-year/status report for the active House backlog,
classify terminal failures and unresolved identities, close cheap fixture gaps,
and inventory existing API/browser proof without stopping or mutating the worker.

**Files changed:**

- `backend/crates/intel_worker/src/parsers.rs`
- `reports/verification/M2-HOUSE-DISCLOSURES.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/agent/test-catalog.md`
- `docs/agent/traces/m2-house-backlog-coverage-verification.md`

**Commands run:**

- Read-only PostgreSQL aggregates over `source_index_entries`, `ingest_jobs`,
  `disclosure_documents`, `parse_attempts`, `parse_issues`, normalized annual
  tables, `financial_snapshots`, and `manual_reviews`: results recorded in the
  M2 verification report at 2026-07-12 19:22 America/New_York.
- `cargo test -p intel_worker parsers::tests -- --nocapture`: passed, 9 tests.
- Live read-only APIs: financial snapshots HTTP 200 in 214 ms; Alma Adams
  disclosures HTTP 200 in 81 ms; stock transactions HTTP 200 in 24 ms.
- Scoped `git diff --check`: passed.

**Tests added:** Malformed annual text must produce no asset, liability, income,
gift, or position rows. A missing scanned source must return an OCR error rather
than successful empty evidence. Existing fixtures cover electronic/scanned
fingerprints, unknown layouts, unsupported routing, and annual record families.

**Assumptions:** Point-in-time queue counts will change while the worker runs.
House Clerk HTTP 404s are source gaps unless a later official index or URL
corrects them. Identity resolution requires authoritative member and company
crosswalks; unresolved historical records are not guessed.

**Risk tier:** low.

**Rollback:** Revert the parser comment/tests and documentation artifacts. No
database, queue, source run, worker process, or normalized record was mutated.

**Status:** done. Verification is complete; M2 itself remains open for the
measured backlog, index-to-queue gap, unknown/partial layouts, OCR accuracy,
and identity-resolution work listed in the report.
