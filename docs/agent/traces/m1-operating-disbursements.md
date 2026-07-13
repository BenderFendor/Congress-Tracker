# M1 Operating Disbursements Worksheet

**Goal:** Ingest, canonicalize, browse, and present official FEC Schedule B operating disbursements without mixing them into receipt or donor totals.

**Files changed:**
- `backend/crates/intel_backend/migrations/0029_fec_operating_disbursements.sql`
- `backend/crates/intel_backend/src/fec_bulk/disbursements.rs`
- `backend/crates/intel_backend/src/fec_bulk/mod.rs`
- `backend/crates/intel_backend/src/fec_bulk/pipeline.rs`
- `backend/crates/intel_backend/src/bin/ingest.rs`
- `backend/crates/intel_backend/src/routes/fec.rs`
- `backend/crates/intel_backend/src/routes/mod.rs`
- `backend/crates/intel_backend/tests/full_api_contract_test.rs`
- `frontend/lib/services/fec.ts`
- `frontend/app/fec/receipts/page.tsx`
- `frontend/app/fec/disbursements/page.tsx`
- `docs/BACKEND_REQUIREMENTS.md`
- `docs/Log.md`
- `docs/agent/test-catalog.md`
- `reports/verification/M1-CAMPAIGN-FINANCE.md`
- `docs/agent/traces/m1-operating-disbursements.md`

**Commands run:**
- Official FEC Schedule B header and file-description inspection - confirmed the 25-column operating-expenditure shape.
- `cargo clippy -p intel_backend --all-targets --all-features -- -D warnings` - passed during implementation.
- `cargo test -p intel_backend fec_bulk::disbursements` - 2 parser tests passed.
- `pnpm typecheck && pnpm lint && pnpm lint:ox` - passed during implementation.
- Live backend on port 4021 plus `GET /api/fec/disbursements?cycle=2026&page=1&per_page=5` - returned HTTP 200 with a truthful `not_ingested` coverage envelope in 286 ms.
- Live 2022, 2024, and 2026 backfill, populated API proof, full self-test, and browser proof - in progress.

**Tests added:** Official 25-column parser shape, malformed-amount rejection, full API contract endpoint, and frontend compile/lint coverage. Populated live API and browser verification remain required.

**Assumptions:** Schedule B `SUB_ID` is stable for raw idempotency. Canonical amendment identity uses committee plus transaction ID, falling back to `SUB_ID` when the source omits a transaction ID.

**Risk tier:** high

**Rollback:** Revert the focused commit. Migration `0029` is additive; leave its tables in place if already applied and stop routing or scheduling the feature.

**Status:** in progress pending live backfills and browser proof
