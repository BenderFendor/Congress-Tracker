# Close M5 Evidence Contracts

**Goal:** Close feasible M5 amendment, LDA bill-link, source-hygiene, and visualization parity criteria.

**Files changed:** `backend/crates/intel_backend/src/models.rs`, `backend/crates/intel_backend/src/repository/bills.rs`, `backend/crates/intel_backend/src/repository/relationships.rs`, `backend/crates/intel_backend/src/routes/bills.rs`, `backend/crates/intel_backend/tests/full_api_contract_test.rs`, `frontend/lib/services/bills.ts`, `frontend/app/bills/[id]/page.tsx`, `docs/IMPLEMENTATION_PLAN.md`, `docs/Log.md`, `docs/agent/test-catalog.md`, `reports/verification/M5-EVIDENCE-CONTRACTS.md`, this trace, and `papercuts.md`.

**Commands run:** Focused Rust relationship test passed; `cargo check -p intel_backend` passed; frontend typecheck, ESLint, and Oxlint passed; critical-page provenance `rg` audit passed. Populated full API test passed all new M5 assertions and later failed on an unrelated FEC disbursement request timeout.

**Tests added:** Direct LDA evidence rejection unit test; populated API assertions for normalized amendment shape, H.R. 6489 direct-link separation, and visualization-summary parity.

**Assumptions:** `fec_campaign_finance_cycle_summaries` is the canonical bounded aggregate contract produced from canonical FEC fact tables. An empty amendment array is truthful coverage, not proof of no amendments upstream.

**Risk tier:** medium

**Rollback:** Revert the listed code and documentation changes; no schema or data mutation was introduced.

**Status:** done
