# FA-18 Senate Discovery Window

Purpose: record the implementation and proof for exhaustive Senate eFD
discovery without making an uncontrolled provider request.

**Goal:** Replace the capped 2021-2026 Senate discovery path with a truthful,
open-ended January 1, 2012 through current-date contract; reject truncated
success; expose terminal PTR and annual counts by year.

**Files changed:** `backend/crates/intel_backend/src/bin/ingest.rs`,
`backend/crates/intel_backend/src/senate_efd.rs`,
`backend/crates/intel_backend/src/routes/financial.rs`,
`backend/crates/intel_worker/src/main.rs`, `docs/Log.md`,
`docs/agent/workflows.md`, `docs/agent/test-catalog.md`, and this worksheet.

**Commands run:**

- `rustfmt --edition 2021` on the three owned Rust files: passed.
- `cargo test -p intel_backend senate_efd::tests -- --nocapture`: 12 passed.
- `cargo check -p intel_backend --bin ingest`: passed.
- `cargo clippy -p intel_backend --all-targets --all-features -- -D warnings`:
  passed.
- `cargo test -p intel_worker bounded_async_process_kills_descendants_before_returning -- --nocapture`:
  passed and proved the timed-out descendant could not write its delayed marker.
- `cargo clippy -p intel_backend -p intel_worker --all-targets --all-features -- -D warnings`:
  passed after reviewer fixes.
- `SENATE_EFD_ACCEPT_TERMS=1 cargo run -p intel_backend --bin ingest -- senate-efd --page-size 0`:
  exited before any provider request with the expected bounded-input error.
- Rebuilt backend on isolated port 4027 and requested
  `/api/senate-disclosures?limit=1`: HTTP 200 in 13 ms, 30 year/form rows from
  2012 PTR through 2026 annual, explicit non-terminal zero counts, and
  `missing_consent`; this read Postgres only and made no Senate request.
- `git diff --check` for owned files: passed.

**Tests added:** A deterministic 1,205-row pagination contract; rejection of
short pre-terminal pages, missing advertised totals, a mixed valid/malformed
page, and a report identity repeated on a later page; complete historical-year
and current-to-date terminal-window checks; and an asynchronous process-group
cleanup test. These tests prove traversal, run-wide identity completeness,
failure semantics, and timeout cleanup without contacting the provider.

**Assumptions:** DataTables `recordsFiltered` is the authoritative total for the
submitted filter and each returned `data` entry is one provider row. The two
queried report types remain PTR and annual. A successful exhaustive source run
is terminal discovery evidence only for years fully enclosed by its date window.

**Risk tier:** Medium. Provider response drift now fails loudly rather than
silently truncating; this may surface as a failed source run that needs adapter
maintenance. Live 2012-present acquisition is still required for populated
coverage and is not claimed here.

**Rollback:** Revert the owned files. Existing staged reports and raw search
pages require no database rollback because this change adds no migration and
the local proof made no provider request.

**Status:** done
