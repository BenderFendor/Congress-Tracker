# Legislator completeness revamp

Goal: Make Votes, Bills, Biography, and portrait behavior evidence-honest and understandable on the legislator detail page.

Files changed: `backend/crates/intel_backend/src/models.rs`, `backend/crates/intel_backend/src/repository/votes.rs`, `backend/crates/intel_backend/tests/full_api_contract_test.rs`, `frontend/lib/services/voting.ts`, `frontend/app/legislators/[id]/page.tsx`, `docs/UI_UX_AUDIT.md`, `docs/Log.md`, `docs/agent/test-catalog.md`, and this trace.

Commands run:

- `cargo fmt --all && cargo check -p intel_backend`: passed.
- `pnpm typecheck && pnpm lint && pnpm lint:ox`: passed.
- Live A000370 API: 593 total votes, 0 missed, 586 of 592 party-comparable votes aligned, covering 2025-01-03 through 2026-06-30.
- Live legislation API: zero sponsor and cosponsor rows with an explicit Congress.gov coverage warning.
- Chrome MCP desktop Votes and Bills plus mobile Biography: no horizontal overflow; official portrait natural width 175; no blank DOM state.

Tests added: Extended the full API contract test to require the party-alignment denominator and vote coverage dates when a summary is loaded.

Assumptions: Current party is the comparison cohort for 119th Congress roll calls. Older Congresses require term-aware party attribution. Education and prior employment remain unavailable because loaded maintained and official structured records do not provide those fields.

Risk tier: medium.

Rollback: Revert the files listed above and restart `intel_backend`.

Status: done.
