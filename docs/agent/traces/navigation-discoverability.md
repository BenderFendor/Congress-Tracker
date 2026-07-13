# Navigation discoverability worksheet

**Goal:** Make every M1 through M5 research destination discoverable without cluttering the primary header, and complete the command palette's keyboard and modal semantics.

**Files changed:**

- `frontend/lib/navigation.ts`
- `frontend/components/ui/navbar.tsx`
- `frontend/components/ui/command-palette.tsx`
- `frontend/app/mockup.css`
- `frontend/scripts/navigation-registry.test.mjs`
- `docs/Log.md`
- `docs/agent/test-catalog.md`
- `reports/verification/NAVIGATION-DISCOVERABILITY.md`
- `reports/verification/navigation-explore-desktop.png`
- `reports/verification/navigation-command-palette-desktop.png`
- `reports/verification/navigation-mobile.png`
- `docs/agent/traces/navigation-discoverability.md`

**Commands run:**

- `pnpm test`: passed, 40 tests.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with zero warnings.
- `pnpm lint:ox`: passed with zero warnings.
- Chrome MCP desktop and mobile snapshots, screenshots, layout evaluation, focus evaluation, and console inspection: passed.

**Tests added:** `frontend/scripts/navigation-registry.test.mjs` proves required route coverage, shared-registry consumption, and command-palette semantic structure.

**Assumptions:** Stable directory destinations belong in global navigation; individual entity detail routes remain discoverable through search and directory pages rather than receiving global links.

**Risk tier:** medium

**Rollback:** Revert the files listed above. The page routes and backend are unchanged.

**Status:** done
