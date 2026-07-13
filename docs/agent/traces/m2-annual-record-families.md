# M2 Annual Record Families Worksheet

**Goal:** Extract and persist annual-report income, gifts, and outside positions alongside existing range-safe assets and liabilities.

**Files changed:**
- `backend/crates/intel_backend/src/annual_disclosures.rs`
- `backend/crates/intel_worker/src/main.rs`
- `docs/Log.md`
- `docs/agent/test-catalog.md`
- `reports/verification/M2-HOUSE-DISCLOSURES.md`
- `docs/agent/traces/m2-annual-record-families.md`

**Commands run:**
- `cargo test -p intel_backend annual_disclosures` - 5 passed.
- `cargo clippy -p intel_backend -p intel_worker --all-targets --all-features -- -D warnings` - passed.
- Three controlled live reparses of official House annual filings - income, gifts, and positions persisted with parser version 1.1; two live-found column/header defects were repaired and reverified.
- Direct SQL coverage audit - recorded source-year/form status, queue counts, normalized-family counts, snapshots, and pending reviews.

**Tests added:** Representative income, position, and gift fixed-layout fixture; existing electronic, wrapped-range, unbounded-range, asset/liability, and conservative cross-bound tests remain green.

**Assumptions:** Runs of two or more spaces are the stable column delimiter for the simple House income, gift, and position tables. Wrapped complex records that do not satisfy that contract must remain partial/manual-review work rather than being guessed.

**Risk tier:** high

**Rollback:** Revert the focused commit and reparse affected document versions with the prior parser. Persisted rows are version-attributed and replaced idempotently on reparse.

**Status:** in progress; parser families proved, backlog and browser exit criteria remain open
