# Close M4 Alias And Parity

Purpose: record the implementation and verification evidence that closes the
remaining influence-network alias, page parity, and provenance criteria in M4.

**Goal:** Support AIPAC alias discovery without rewriting official identities,
prove the same API/page flow for AIPAC and a non-AIPAC network, and expose
relationship provenance.

**Files changed:**

- `backend/crates/intel_backend/migrations/0038_influence_network_aliases.sql`
- `backend/crates/intel_backend/src/models.rs`
- `backend/crates/intel_backend/src/repository/influence.rs`
- `backend/crates/intel_backend/src/bin/ingest.rs`
- `frontend/lib/influence-search.mjs`
- `frontend/lib/services/influence.ts`
- `frontend/app/influence/page.tsx`
- `frontend/components/influence-flow-map.tsx`
- `frontend/scripts/influence-alias-parity.test.mjs`
- `frontend/scripts/e2e-api-flows.test.mjs`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/agent/test-catalog.md`
- `docs/Log.md`
- `reports/verification/m4-aipac-alias-desktop.png`
- `reports/verification/m4-nra-dossier-mobile.png`

**Commands run:**

- `psql ... -f backend/crates/intel_backend/migrations/0038_influence_network_aliases.sql` - passed; 13 existing networks updated.
- `cargo fmt --all` - passed.
- `cargo test -p intel_backend influence -- --nocapture` - passed compilation;
  no name-filtered influence unit tests were present.
- `scripts/verify-migrations` - blocked because this shell had no
  create-database-capable `DATABASE_URL`; the additive migration was applied
  and exercised against the live development database instead.
- `pnpm test` - passed, 62/62 tests including live AIPAC/NRA parity.
- `pnpm typecheck` - passed.
- `pnpm lint` - passed with zero warnings.
- `pnpm lint:ox` - passed with zero warnings.
- Chrome MCP desktop alias search and mobile NRA dossier checks - passed;
  exact identities and citations present, no overflow, no console warnings/errors.

**Tests added:** `influence-alias-parity.test.mjs` verifies alias resolution does
not mutate source identity and both networks use the generic dossier path. The
live API flow now asserts identical AIPAC/NRA shapes and provenance fields.

**Assumptions:** Influence aliases are discovery metadata, not evidence of
affiliation. Committee membership remains the reviewed FEC-ID crosswalk.

**Risk tier:** medium

**Rollback:** Revert migration `0038` and the listed influence contract/UI
changes. The additive alias column does not alter transaction or financial data.

**Status:** done
