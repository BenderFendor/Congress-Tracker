# M2 supported-form queue recovery

**Goal:** Repair index-to-download and version-to-parse handoff gaps through the
normal worker lifecycle, idempotently and with current-year priority.

**Files changed:**

- `backend/crates/intel_worker/src/main.rs`
- `docs/Log.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/agent/test-catalog.md`
- `reports/verification/M2-HOUSE-DISCLOSURES.md`
- `docs/agent/traces/m2-supported-queue-recovery.md`

**Commands run:**

- `cargo check -p intel_worker`: passed.
- `cargo test -p intel_worker -- --nocapture`: passed, 19 tests.
- `cargo build -p intel_worker`: passed before lifecycle deployment.
- An initial direct execution of `target/debug/intel_worker` failed before any
  queue mutation with `VersionMissing(35)` because `cargo check/test` had not
  refreshed the standalone executable's embedded migrations. After the explicit
  build, normal startup passed; the papercut is logged.
- First normal `intel_worker --backfill` startup: recovered 32 download jobs and
  zero parse jobs; 31 current-year jobs received priority `-100`, one historical
  PTR received priority `0`; all 32 downloads completed.
- Second normal startup with worker-owned stale recovery: recovered zero download
  and zero parse jobs, then cleanly completed its claimed parse batches.
- Post-run read-only SQL: zero supported index records lack download jobs; zero
  downloaded supported versions lack parse jobs; no verifier-owned jobs remain
  running. The existing worker remains active.
- Scoped `git diff --check`: passed.
- `cargo clippy -p intel_worker --all-targets --all-features -- -D warnings`:
  passed. Final worker test rerun: 19 passed.

**Tests added:** Structural production-SQL test for supported forms, immutable
version parse identity, `NOT EXISTS`, and conflict-safe idempotency; priority
test proving current-year download and parse recovery precede historical work.

**Assumptions:** Lower numeric queue priority runs first. Historical terminal
download failures count as an existing handoff and must not be silently reopened.
Unsupported forms retain index coverage without entering PDF parsing.

**Risk tier:** medium.

**Rollback:** Revert the worker function and lifecycle calls. The 32 jobs were
normal queue records and have completed; do not delete their immutable documents
or parse jobs during rollback.

**Status:** done. The supported index-to-queue gap is zero. M2 remains open for
the independently measured parse backlog, official 404s, layout/OCR gaps, and
identity resolution.
