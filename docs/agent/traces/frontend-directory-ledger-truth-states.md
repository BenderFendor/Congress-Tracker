# Frontend directory and ledger truth states

**Goal:** Keep candidate, committee, and FEC disbursement request failures distinct from genuine loaded empty results, while improving filter accessibility and responsive verification.

**Files changed:**
- `frontend/app/candidates/page.tsx`
- `frontend/app/fec/disbursements/page.tsx`
- `frontend/lib/truth-states.mjs`
- `frontend/scripts/truth-states.test.mjs`
- `frontend/components/ui/command-palette.tsx` (two unsupported concurrent dialog event props removed to restore shared-worktree typechecking)
- `docs/agent/test-catalog.md`
- `docs/Log.md`
- `reports/verification/candidates-truth-states-desktop.png`
- `reports/verification/candidates-truth-states-mobile.png`
- `reports/verification/disbursements-truth-states-desktop.png`
- `reports/verification/disbursements-truth-states-mobile.png`

**Commands run:**
- `cd frontend && pnpm test` passed, 40 tests in the shared worktree.
- `cd frontend && pnpm typecheck` passed after removing unsupported concurrent dialog event props.
- `cd frontend && pnpm lint` passed with zero warnings.
- `cd frontend && pnpm lint:ox` found no warnings in this task's files; two concurrent command-palette role warnings remained and were reported to the parent agent.
- Chrome MCP rendered `/candidates` and `/fec/disbursements?cycle=2026&page=1&per_page=50` at 1440x1000 and 390x844. Both routes had no horizontal overflow or console warnings/errors. All five disbursement filters had accessible names. Blank amount filters rendered blank rather than zero.

**Tests added:** Extended `truth-states.test.mjs` to prove loading, error, unavailable, loaded-empty, and loaded-nonempty request classification. This protects the shared presentation decision but does not replace browser failure injection.

**Assumptions:** The existing service exceptions contain suitable user-facing diagnostic context. A successful empty array is a loaded empty state, not an ingestion-completeness claim; coverage copy remains responsible for that distinction.

**Risk tier:** medium

**Rollback:** Revert the files listed above. The screenshots and worksheet can be removed independently without affecting runtime behavior.

**Status:** done
