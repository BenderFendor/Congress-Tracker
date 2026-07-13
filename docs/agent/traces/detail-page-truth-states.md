# Detail page truth states

**Goal:** Keep invalid identifiers, confirmed absence, and service failures distinct on bill and committee detail routes.

**Files changed:** `frontend/app/bills/[id]/page.tsx`, `frontend/app/committees/[id]/page.tsx`, `frontend/lib/services/bills.ts`, `frontend/lib/services/committees.ts`, `frontend/lib/detail-request-state.mjs`, `frontend/scripts/detail-request-state.test.mjs`, `docs/agent/test-catalog.md`, `docs/agent/traces/detail-page-truth-states.md`.

**Commands run:** `cd frontend && pnpm test` passed 36 tests. `pnpm typecheck` passed. `pnpm lint` passed with no warnings. The repository-wide `pnpm lint:ox` reached an unrelated `jsx-a11y(prefer-tag-over-role)` warning in `app/fec/disbursements/page.tsx:95`, outside this task's scope. A focused Oxlint run over every changed frontend source and test file passed with warnings denied. `git diff --check` passed for the task files.

**Tests added:** Response classification coverage proves that only HTTP 404 becomes not found and that 500, 503, and network failures remain retryable errors.

**Assumptions:** Bill identifiers follow one of the three formats already accepted by the route. Committee identifiers contain letters, numbers, and hyphens.

**Risk tier:** Medium.

**Rollback:** Revert the files listed above.

**Status:** Done. The scoped implementation is verified; the repository-wide Oxlint gate remains blocked by the separately owned disbursement warning recorded above.
