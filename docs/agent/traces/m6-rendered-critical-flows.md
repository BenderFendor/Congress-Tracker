# M6 Rendered Critical Flows

**Goal:** Add repeatable rendered/user-flow coverage for critical research pages without fabricating records or duplicating the root Chrome screenshot pass.

**Files changed:** `scripts/verify-rendered-critical-pages`, `frontend/scripts/rendered-route-smoke.mjs`, `frontend/scripts/e2e-api-flows.test.mjs`, `frontend/package.json`, `docs/IMPLEMENTATION_PLAN.md`, `docs/agent/test-catalog.md`, `docs/agent/tools.md`, `docs/Log.md`, `docs/agent/traces/m6-rendered-critical-flows.md`.

**Commands run:** `scripts/verify-rendered-critical-pages` (10/10 routes passed); `node --check frontend/scripts/e2e-api-flows.test.mjs` (passed); focused frontend state tests (11/11 passed); `pnpm typecheck` (passed); `pnpm lint` (passed); `pnpm lint:ox` (passed); `git diff --check` (recorded after final docs update).

**Tests added:** isolated SSR route proof for search guidance, member loading, receipts/disbursements failures, portfolio loading, net-worth failure, lobbying loading, influence loading, bills loading, and organization loading. Live API tests add disbursements, member disclosures, bill detail evidence, organization relationship tiers, and separated influence financial channels.

**Assumptions:** Client pages intentionally SSR their initial loading state. Loaded-data API tests require the populated backend on port 4020 and are not replaced with mocks.

**Risk tier:** low

**Rollback:** Revert the files listed above. The smoke command creates only a temporary Next process and log.

**Status:** done

**Remaining gaps:** Hydrated click/focus/back-stack behavior, responsive screenshots, and loaded/error transitions after client requests remain Chrome/component-test work. The repo still has no browser-test dependency, so this gate does not claim those behaviors.
