# M1 Canonical Campaign Finance Worksheet

**Goal:** Finish the three-cycle canonical FEC warehouse, prove deterministic reruns and responsive browse contracts, and keep malformed or unresolved source rows visible as partial coverage.

**Files changed:**
- `backend/crates/intel_backend/src/routes/fec.rs`
- `docs/IMPLEMENTATION_PLAN.md`
- `reports/verification/M1-CAMPAIGN-FINANCE.md`
- `docs/agent/traces/m1-canonical-campaign-finance.md`

**Commands run:**
- `./target/debug/ingest fec-bulk --cycles 2024` - initial run finished `partial` after 79,225,774 rows seen and 17,667,336 written; 128 malformed or unresolved rows retained as the reason.
- `./target/debug/ingest fec-bulk --cycles 2024` - deterministic rerun finished `success` in 40 seconds, recognized unchanged archives, and preserved all cycle counts.
- SQL against `fec_receipt_cycle_counts` and `fec_disbursement_cycle_counts` - measured 2022, 2024, and 2026 receipt and Schedule B counts.
- `cargo fmt --all`, `cargo check -p intel_backend`, and `cargo test -p intel_backend routes::fec -- --nocapture` - passed.
- Live receipt and disbursement timing requests - receipt 39 ms warm, unfiltered disbursement 1.08 seconds, filtered disbursement 578 ms.
- Chrome MCP desktop and 390px candidate, receipt, disbursement, member, and influence flows - captured during the M1 and frontend verification passes with no final page-level overflow.

**Tests added:** Existing parser, classification, full API contract, and frontend truth-state tests cover the data separation and response envelopes. This slice changed the disbursement query plan and verified it with live populated timings; a focused pagination unit test should be added if the route is extracted from SQL assembly later.

**Assumptions:** Content hashes and archive import records are sufficient to skip unchanged bulk canonicalization. The cycle count tables are refreshed only after canonicalization succeeds. Filtered list totals may be inexact when the API explicitly returns `total_is_exact=false` and `has_more` remains truthful.

**Risk tier:** high

**Rollback:** Revert the disbursement route query change. The additive warehouse and already ingested public records remain in place; do not use destructive down migrations.

**Status:** done pending the final cross-milestone self-test, focused commit, and matching tag.
