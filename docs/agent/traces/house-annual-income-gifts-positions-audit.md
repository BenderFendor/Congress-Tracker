# House annual income, gifts, and positions audit

**Goal:** Determine whether supported House annual forms still lacked normalized
income, gift, or outside-position parsing and persistence, and implement only a
genuine missing slice without disturbing the active worker.

**Files changed:**

- `docs/IMPLEMENTATION_PLAN.md`
- `docs/agent/test-catalog.md`
- `docs/agent/traces/house-annual-income-gifts-positions-audit.md`

**Commands run:**

- Source inspection of `annual_disclosures.rs`, `intel_worker/src/parsers.rs`,
  `intel_worker/src/main.rs`, and migration `0008_annual_reports.sql`: confirmed
  parsing structs, supported-form routing, normalized persistence, lineage,
  delete-and-replace idempotency, and partial/error state handling already exist.
- `cargo test -p intel_backend annual_disclosures::tests -- --nocapture`:
  passed, 5 tests.
- `cargo test -p intel_worker parsers::tests -- --nocapture`: passed, 7 tests.
- Read-only live database counts: 1,045 income rows across 512 document versions;
  117 gift rows across 12 versions; 1,367 position rows across 357 versions.
- Read-only annual-form document states: 2,259 parsed, 75 partial, 1,336 pending,
  and 724 rejected. Parse attempts retain success, partial, failed, and running
  states rather than converting missing extraction into factual zeroes.

**Tests added:** None. Representative income, spouse-income-without-fabricated-
amount, gifts, positions, range, wrapped-value, and scanned/electronic layout
tests already pass. Adding duplicate fixtures would not increase confidence.

**Assumptions:** Report types `A`, `O`, `N`, and `T` continue to share the House
annual parser family. Pending live documents may reveal additional layouts, but
their current absence is not authorization to fabricate or guess mappings.

**Risk tier:** low.

**Rollback:** Revert the two documentation corrections and remove this trace.
No parser, database, queue, or worker state was changed.

**Status:** done. The requested normalized families were already implemented
and live; the remaining M2 work is backlog completion and scanned-document
accuracy proof, not missing income/gift/position persistence.
