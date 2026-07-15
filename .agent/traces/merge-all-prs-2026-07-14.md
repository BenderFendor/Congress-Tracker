# Merge All Reviewed Pull Requests

**Goal:** Reconcile every open pull request and local branch into one verified integration, fix review findings, merge the resulting branch to `main`, and retire superseded work.

**Files changed:**
- `.github/workflows/ci.yml`
- `.gitignore`
- `README.md`
- `backend/crates/intel_backend/src/routes/candidates.rs`
- `backend/crates/intel_backend/src/routes/mod.rs`
- `backend/crates/intel_backend/tests/cache_control_coverage_test.rs`
- `backend/crates/intel_worker/src/lib.rs`
- `backend/crates/intel_worker/tests/fixtures/house_annual_2024.txt`
- `backend/crates/intel_worker/tests/fixtures/house_ptr_2024.txt`
- `backend/crates/intel_worker/tests/fixtures/unknown_disclosure_layout.txt`
- `docs/Log.md`
- `docs/agent/learnings.md`
- `docs/agent/test-catalog.md`
- `docs/agent/traces/frontend-dossier-refactor-and-bounded-parser-corpus.md`
- `frontend/app/candidates/[id]/page.tsx`
- `frontend/app/candidates/page.tsx`
- `frontend/app/legislators/[id]/page.tsx`
- `frontend/components/dossiers/candidate/candidate-dossier.tsx`
- `frontend/components/dossiers/candidate/use-candidate-dossier.ts`
- `frontend/components/dossiers/member/member-biography.tsx`
- `frontend/components/dossiers/member/member-connections.tsx`
- `frontend/components/dossiers/member/member-dossier-ui.tsx`
- `frontend/components/dossiers/member/member-dossier.tsx`
- `frontend/components/dossiers/member/member-financial.tsx`
- `frontend/components/dossiers/member/member-funding.tsx`
- `frontend/components/dossiers/member/member-legislative.tsx`
- `frontend/components/dossiers/member/member-overview.tsx`
- `frontend/components/dossiers/member/types.ts`
- `frontend/components/dossiers/member/use-member-dossier.ts`
- `frontend/components/elections/election-map-panels.tsx`
- `frontend/components/elections/election-map.tsx`
- `frontend/components/ui/evidence-download-menu.tsx`
- `frontend/lib/download-utils.mjs`
- `frontend/lib/member-dossier-state.mjs`
- `frontend/lib/member-identity.mjs`
- `frontend/lib/member-identity.mjs.d.ts`
- `frontend/lib/services/candidates.ts`
- `frontend/package-lock.json` (removed)
- `frontend/package.json`
- `frontend/pnpm-lock.yaml`
- `frontend/scripts/candidate-dossier.test.mjs`
- `frontend/scripts/component-size-budget.test.mjs`
- `frontend/scripts/county-geography.test.mjs`
- `frontend/scripts/election-filing-semantics.test.mjs`
- `frontend/scripts/election-map-refactor.test.mjs`
- `frontend/scripts/member-dossier-isolation.test.mjs`
- `frontend/scripts/member-dossier-refactor.test.mjs`
- `frontend/scripts/member-dossier-utils.test.mjs`
- `frontend/scripts/run-oxlint-ci.mjs`
- `papercuts.md`
- `reports/verification/dossier-refactor-ci-artifacts.md`
- `.agent/traces/merge-all-prs-dependency-drift.json`
- `.agent/traces/merge-all-prs-pre-edit-context.md`
- `.agent/traces/merge-all-prs-2026-07-14.md`

**Commands run:**
- `scripts/agent-summary` — passed; established repository layout and verification routes.
- `gh pr list`, `gh pr view`, `gh pr diff`, and pairwise merge-tree inspection — reviewed PRs 1 through 9 and their overlap.
- Isolated PR checks and `scripts/self-test` — PR 9 and current `main` passed; dependency PR 4 exposed TypeScript 5.9 inference breakage; PRs 4 through 8 exposed mixed-lockfile drift.
- `pnpm install --lockfile-only`, then `pnpm install --frozen-lockfile` — regenerated and materialized the single supported pnpm dependency graph.
- Dependency drift audit — passed after removal of `frontend/package-lock.json`; no mixed package-manager lockfiles remain.
- `git diff --check` — passed.
- `scripts/self-test` — passed on the consolidated integration: Rust formatting, clippy, checks and tests; 84 frontend contract tests; TypeScript 5.9; ESLint/Oxlint; Next production build.
- `gh pr create` — opened integration PR 10 for remote validation and merge.
- Browser availability probe — blocked because Chrome/Chromium had no active DevTools endpoint.
- PostgreSQL/runtime probe — blocked because no local PostgreSQL service was accepting connections; live `source_runs` and `ingest_jobs` state could not be asserted locally.

**Tests added:**
- Candidate coverage classifier test verifies terminal identity archives and successful source-run evidence are required before coverage is called loaded.
- Candidate dossier structural assertions cover the expanded evidence fields.
- Member dossier utility tests preserve the legacy `donations` and `voting` deep-link aliases.
- PR 9 also adds bounded House disclosure parser fixtures, candidate dossier contracts, component size budgets, election-map refactor contracts, and member-dossier refactor contracts.

**Assumptions:**
- The pnpm lockfile is authoritative because repository commands and CI use pnpm and `.gitignore` already excludes npm's lockfile.
- Dependency PRs 1 through 8 may be closed as superseded once their intended versions are present on the integration branch and GitHub CI passes.
- The unavailable local database and browser are environment limitations, not permission to claim live populated-data proof; deterministic checks and GitHub CI are recorded separately.

**Risk tier:** medium — this combines a broad frontend refactor, candidate API semantics, CI action updates, and dependency upgrades.

**Rollback:** Revert the integration merge commit on `main`. The pre-integration review point remains tagged `review-all-prs-and-branches`; this integration is tagged `merge-all-prs-2026-07-14` after commit.

**Status:** done, contingent on the recorded GitHub CI and `main` merge steps being appended before handoff.
