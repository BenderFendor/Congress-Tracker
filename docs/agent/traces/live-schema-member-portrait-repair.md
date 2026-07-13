# Live Schema And Member Portrait Repair Worksheet

**Goal:** Restore the missing derived stock-trades contract and stop member ingestion and UI rendering from treating Congress.gov JSON metadata endpoints as portraits.

**Files changed:**
- `backend/crates/intel_backend/migrations/0035_restore_stock_trades_view.sql`
- `backend/crates/intel_backend/migrations/0036_canonical_member_portraits.sql`
- `backend/crates/intel_backend/src/bin/ingest.rs`
- `frontend/app/data-sources/page.tsx`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/Log.md`
- `docs/agent/traces/live-schema-member-portrait-repair.md`

**Commands run:**
- Populated `full_api_contract_test` - first failed because `/api/home/summary` referenced missing `stock_trades`; passed after migration `0035` restored the view.
- Live SQL - confirmed `stock_trades` contains 25,200 derived normalized disclosure rows and migration `0035` succeeded.
- Live member API checks - confirmed A000371 and A000370 now return official Bioguide portrait URLs after migration `0036`.
- `cargo fmt --all`, focused ingest portrait test, and full Intel backend Clippy with warnings denied - passed.
- Frontend portrait resolver tests and Chrome screenshots - covered by `docs/agent/traces/reference-editorial-revamp.md`.

**Tests added:** The ingest binary test proves valid Bioguide IDs produce the official portrait URL and malformed IDs do not. Frontend helper tests reject Congress.gov metadata URLs and verify the ordered supplied-image, Bioguide, and initials chain.

**Assumptions:** Bioguide portrait URLs are the stable official image contract for valid seven-character Bioguide IDs. Individual portraits may still be unavailable, so the UI retains an initials fallback.

**Risk tier:** medium

**Rollback:** Revert the ingest and frontend contract changes. Migrations `0035` and `0036` are non-destructive repairs over derived view data and member presentation metadata; leave their applied ledger entries intact.

**Status:** done pending final cross-milestone self-test, commit, and tag integration.
