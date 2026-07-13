# M4 Lobbying Entity Flows

**Goal:** Normalize stable LDA lobbyist identities and provide source-backed
client, registrant, and lobbyist list/detail workflows without combining LDA
and FEC amounts.

**Files changed:**
- `backend/crates/intel_backend/migrations/0034_lobbying_lobbyists.sql`
- `backend/crates/intel_backend/src/bin/ingest.rs`
- `backend/crates/intel_backend/src/repository/lobbying.rs`
- `backend/crates/intel_backend/src/routes/lobbying.rs`
- `backend/crates/intel_backend/src/routes/mod.rs`
- `backend/crates/intel_backend/tests/full_api_contract_test.rs`
- `frontend/lib/services/lobbying.ts`
- `frontend/components/lobbying-entity-pages.tsx`
- `frontend/app/lobbying/clients/`
- `frontend/app/lobbying/registrants/`
- `frontend/app/lobbying/lobbyists/`
- `frontend/app/globals.css`
- `frontend/scripts/e2e-api-flows.test.mjs`
- `docs/UI_UX_AUDIT.md`
- `docs/Log.md`
- `docs/agent/test-catalog.md`
- `reports/verification/M4-LOBBYING-ENTITY-FLOWS.md`

**Commands run:**
- Live 2026 LDA ingest: 125 filings seen, 1,832 rows written.
- Live list and detail curls: HTTP 200 with official source URLs.
- `cargo check -p intel_backend -p intel_worker`: passed.
- `cargo test -p intel_backend senate_efd`: 3 passed.
- `pnpm test`: 30 passed.
- `pnpm typecheck && pnpm lint && pnpm lint:ox && pnpm build`: passed.
- Chrome MCP desktop and 390px route, console, overflow, search, and source-link checks: passed.

**Tests added:** Lobbying list contracts for clients, registrants, and lobbyists;
frontend live API checks for stable identities and source-backed entity detail.

**Assumptions:** Senate LDA lobbyist IDs are stable official identifiers. The
current five-page refresh is representative runtime proof, not complete source
history.

**Risk tier:** high

**Rollback:** Revert the M4 files and leave additive migration 0034 dormant.
Do not destroy normalized public records.

**Status:** in progress. Entity rail is proved; alias and cross-network exit
criteria remain open.
