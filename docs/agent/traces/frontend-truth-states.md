# Frontend Truth States Worksheet

**Goal:** Stop the influence detail and home page from presenting invented or failed-source values as factual counts.

**Files changed:**
- `frontend/app/influence/[slug]/page.tsx`
- `frontend/app/page.tsx`
- `frontend/app/mockup.css`
- `frontend/lib/services/influence.ts`
- `frontend/lib/truth-states.mjs`
- `frontend/scripts/truth-states.test.mjs`
- `docs/agent/test-catalog.md`
- `docs/agent/traces/frontend-truth-states.md`
- `reports/verification/home-mobile-final.png`
- `reports/verification/influence-truth-states-desktop.png`

**Commands run:**
- `cd frontend && pnpm test` - 33 tests passed.
- `cd frontend && pnpm typecheck` - passed.
- `cd frontend && pnpm lint` - passed with no ESLint warnings or errors.
- `cd frontend && pnpm lint:ox` - passed with warnings denied.
- Targeted `git diff --check` for the product and test files - passed.
- Chrome MCP desktop and 390px checks - explicit unavailable states rendered, no influence-page console errors, and no horizontal overflow after constraining the mobile observatory.
- Direct PNG inspection found mobile scroll-reveal sections disappearing from full-page capture; mobile section animations were disabled and the final screenshot was inspected again.

**Tests added:** `frontend/scripts/truth-states.test.mjs` proves that an empty successful response remains a genuine zero, a failed request becomes `Unavailable`, an empty influence committee list does not invent affiliations, and source cycle metadata is used when present.

**Assumptions:** An absent influence-network cycle means the detail endpoint has not supplied cycle coverage. Independent home-page requests may succeed or fail separately, so each source requires its own availability state.

**Risk tier:** medium

**Rollback:** Revert the product, style, test, documentation, and worksheet files listed above. This restores the prior presentation logic and removes the focused helper tests.

**Status:** done
