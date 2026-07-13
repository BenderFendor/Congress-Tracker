# Close M3 Senate Consent-Independent Pipeline

**Goal:** Complete and verify every Senate eFD behavior that does not require accepting site terms or making live requests.

**Files changed:** `backend/crates/intel_backend/src/senate_efd.rs`, `backend/crates/intel_backend/src/routes/financial.rs`, `docs/IMPLEMENTATION_PLAN.md`, `docs/agent/test-catalog.md`, and this trace.

**Commands run:** `cargo test -p intel_backend senate_coverage_states -- --nocapture` passed; `cargo check -p intel_backend` passed; `cargo fmt` completed.

**Tests added:** A mutually exclusive coverage-state matrix for missing consent, missing filing, ambiguous identity, parser failure, and loaded evidence. Existing fixtures prove paginated discovery, duplicate report deduplication, checked PTR/annual HTML and text parsing, and malformed-report rejection.

**Assumptions:** Existing content-addressed `document_versions`, source-report upsert, transactional normalized persistence, and conservative single-match member resolution are the canonical persistence/versioning/idempotency contracts. Retry integration is owned by the worker's bounded refresh subprocess and source-run failure handling.

**Risk tier:** medium

**Rollback:** Revert the listed files; no schema, data, consent, or external state changed.

**Status:** done; live acquisition proof requires explicit operator consent.
