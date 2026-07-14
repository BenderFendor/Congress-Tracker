# FA-20 Exhaustive Member Legislation

Purpose: prove that Congress.gov Member legislation is exhaustively ingested,
reconciled, restartable, scheduled, and honestly rendered in the dossier.
Scope: FA-20 only; other open M5 findings remain open.
Evidence date: 2026-07-13 through 2026-07-14.
Finding status: closed.

## Goal

Exhaust sponsored and cosponsored Congress.gov history for every current Member,
preserve mixed bill/amendment evidence, expose terminal coverage through the API
and UI, and keep the worker safe on gaming/Pi through burst hardware profiles.

## Files changed

- `backend/crates/congress_api/src/client.rs`
- `backend/crates/congress_api/src/lib.rs`
- `backend/crates/congress_api/src/pagination.rs`
- `backend/crates/congress_api/src/types.rs`
- `backend/crates/intel_backend/migrations/0048_member_legislation_coverage.sql`
- `backend/crates/intel_backend/migrations/0049_member_legislation_write_reconciliation.sql`
- `backend/crates/intel_backend/migrations/0050_member_legislation_items.sql`
- `backend/crates/intel_backend/migrations/0051_member_legislation_duplicate_coverage.sql`
- `backend/crates/intel_backend/src/bin/ingest.rs`
- `backend/crates/intel_backend/src/repository/member_legislation.rs`
- `backend/crates/intel_backend/src/repository/mod.rs`
- `backend/crates/intel_backend/src/routes/member_intel.rs`
- `backend/crates/intel_backend/tests/legislator_tabs_test.rs`
- `backend/crates/intel_backend/tests/migration_test.rs`
- `backend/crates/intel_worker/intel_worker.service`
- `backend/crates/intel_worker/src/main.rs`
- `frontend/app/legislators/[id]/page.tsx`
- `frontend/lib/services/legislators.ts`
- `frontend/scripts/member-dossier-isolation.test.mjs`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/Log.md`
- `docs/agent/known-errors.md`
- `docs/agent/learnings.md`
- `docs/agent/test-catalog.md`
- `docs/agent/workflows.md`
- `docs/agent/traces/fa20-*`

## Commands run

- `cargo test -p congress_api -p intel_backend -p intel_worker`: passed; focused
  artifact `fa20-focused-backend-watchdog.json`, 7.987 seconds.
- Fresh and prior-0016 migration verification: passed; artifact
  `fa20-migrations-watchdog.json`, 30.898 seconds.
- Frontend tests, typecheck, lint, and build: passed; artifact
  `fa20-frontend-verify-watchdog.json`, 26.262 seconds.
- `scripts/self-test`: passed after the final resume implementation; artifact
  `fa20-self-test-watchdog.json`, return code 0, 54.289 seconds.
- Initial Congress 119 live backfill: intentionally bounded by a four-hour
  watchdog; it timed out near completion at 82,028 KiB maximum RSS. Artifact:
  `fa20-live-backfill-watchdog.json`.
- Resume command for source run `15a69481-0e6f-4380-9d26-9e01c571a295`:
  passed in 250.105 seconds at 49,432 KiB maximum RSS. Artifact:
  `fa20-live-resume-watchdog.json`.
- Live API probes: known Member A000370 returned HTTP 200 with loaded all-history
  coverage; an unknown Member returned canonical HTTP 404.
- Chrome MCP at 1440x1000 and 390x844: selected Bills tab, portrait loaded,
  independent pagination worked, tab selection remained visible, no horizontal
  overflow, and console/development logs were empty. Screenshots:
  `fa20-legislation-desktop.png`, `fa20-legislation-mobile.png`, and
  `fa20-legislation-mobile-bills.png`.

## Live reconciliation

- Source run: `15a69481-0e6f-4380-9d26-9e01c571a295`, terminal `success`.
- Current-Member snapshot: 537 Members, SHA-256
  `7ceaff08bc57aa8e9cb08f5eaa50a767c7da839d9543c343d373f59b41089eab`.
- Coverage: 1,074 loaded roles and 537 distinct Members.
- Counts: 1,219,881 advertised, 1,219,881 seen, 1,219,187 persisted,
  694 duplicates, and 5,544 pages.
- Reconciliation: zero non-loaded roles, zero advertised-count mismatches, and
  zero roles where `seen != persisted + duplicates`.
- Largest observed role: N000147 cosponsor at 17,397 rows across 70 pages.
- Boundary regression: D000563 cosponsor retained 10,492 seen rows as 10,490
  persisted rows plus two duplicates, proving a 10,000 ceiling was invalid.

## Tests added

- Pagination invariants, mixed nullable rows, canonical URL identity, totals
  above 10,000, and the 50,000 safety ceiling.
- HTTP send/body retry, truncated bodies, typed key-safe authentication errors,
  and permanent-error rejection without page reduction.
- Page-atomic persistence, duplicate reconciliation, retryable PostgreSQL
  transaction codes, resumable run validation, and loaded-role preservation.
- API coverage and independent pagination contracts.
- Dossier request isolation, coverage/source-link rendering, truthful zero and
  stale ranges, accessible busy states, and responsive pagination.

## Assumptions

- Congress.gov advertised totals are authoritative only while stable across the
  complete role; a changed or missing count is terminal failure.
- The 50,000-row role ceiling is a safety bound, not an estimate of completeness.
- Existing applied migrations 0048 through 0051 are immutable; corrections must
  use a new forward migration.
- The shared development database and current Congress roster are representative
  of the live operator path used for this closure proof.

## Risk tier

High. This changes provider pagination, durable evidence, scheduled ingestion,
public API contracts, and a primary Member dossier tab.

## Rollback

Revert the focused `fa20-member-legislation` commit. Do not delete or rewrite
applied migrations 0048 through 0051; if schema rollback is required, add a
forward migration that preserves existing evidence and ledger history.

## Status

Done. Three independent review agents found no remaining ingestion, API, or UI
blockers. The full self-test passed after the final code, and the live ledger,
API, and Chrome evidence reconcile.
