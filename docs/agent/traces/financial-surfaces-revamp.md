# Financial Surfaces Revamp Worksheet

**Goal:** Improve Portfolio Overview, Candidate Directory, and Net Worth
Snapshots as coherent public-record research surfaces without weakening
coverage, failure, range, or provenance semantics.

**Files changed:**

- `frontend/app/candidates/page.tsx`
- `frontend/app/networth/page.tsx`
- `frontend/app/networth/_components/net-worth-directory.tsx`
- `frontend/app/portfolio/page.tsx`
- `frontend/app/globals.css`
- `frontend/app/mockup.css`
- `frontend/lib/financial-ui.mjs`
- `frontend/lib/financial-ui.mjs.d.ts`
- `frontend/scripts/financial-ui.test.mjs`
- `docs/UI_UX_AUDIT.md`
- `docs/Log.md`
- `docs/agent/test-catalog.md`
- `docs/agent/traces/financial-surfaces-revamp.md`
- `reports/verification/financial-candidates-desktop.png`
- `reports/verification/financial-candidates-mobile.png`
- `reports/verification/financial-networth-desktop.png`
- `reports/verification/financial-networth-mobile.png`
- `reports/verification/financial-portfolio-desktop.png`
- `reports/verification/financial-portfolio-mobile.png`

**Commands run:**

- `cd frontend && pnpm test`: passed, 51 tests.
- `cd frontend && pnpm typecheck`: passed.
- `cd frontend && pnpm lint`: passed with zero warnings.
- `cd frontend && pnpm lint:ox`: passed with zero warnings after replacing an
  invalid navigation tablist role and documenting the React 18 search-role
  compatibility boundary.
- `cd frontend && pnpm build`: passed, 25 routes generated.
- Live API probes: candidates returned HTTP 200 in 16 ms and financial
  snapshots returned HTTP 200 in 35 ms.
- Chrome MCP at 1440 by 1000 and 390 by 844: candidates loaded 24 progressive
  records from 200, net worth loaded 24 from 318, and Portfolio Overview loaded
  10 member ranking rows. All measured routes had zero horizontal overflow.
- Inspected all six saved PNGs directly after capture.

**Tests added:**

- Candidate filters match names and official FEC identifiers while respecting
  state and office scope.
- Committee search includes official identifier and source context fields.
- Unbounded net-worth maxima render as `No finite upper bound`, never zero.
- Snapshot filters preserve year and chamber scope without changing values.

**Assumptions:**

- Official FEC candidate and committee detail URLs are stable under their
  documented identifier routes.
- Candidate API rows currently do not expose source-backed portraits, so the UI
  uses neutral initials rather than inventing or scraping imagery.
- Portfolio sector weights remain committee-jurisdiction context and must not
  be labeled as reported investment exposure.

**Risk tier:** Medium. Three high-traffic financial surfaces changed, but API
contracts and backend persistence were not modified.

**Rollback:** Revert the listed frontend modules, shared CSS additions,
financial helper and test, and documentation entries. No data migration or
backend rollback is required.

**Status:** Done. Candidate and net-worth Chrome logs were clean. Portfolio
logged two live request errors during concurrent ingestion and displayed those
requests as unavailable rather than zero; this was an existing backend runtime
condition, not suppressed by the UI.
