# Frontend revamp worksheet

**Goal:** Revamp shared frontend archive surfaces and representative LDA and
organization journeys with clearer hierarchy, responsive density, evidence
actions, tasteful motion, and mobile continuity.

**Files changed:**

- `frontend/components/ui/archive-ui.tsx`
- `frontend/components/lobbying-entity-pages.tsx`
- `frontend/app/organizations/[id]/page.tsx`
- `frontend/app/globals.css`
- `docs/UI_UX_AUDIT.md`
- `docs/Log.md`
- `reports/verification/FRONTEND-REVAMP.md`
- `docs/agent/traces/frontend-revamp.md`
- `reports/verification/frontend-revamp-registrants-desktop.png`
- `reports/verification/frontend-revamp-registrants-mobile.png`
- `reports/verification/frontend-revamp-organization-desktop.png`
- `reports/verification/frontend-revamp-organization-mobile.png`
- `reports/verification/frontend-revamp-candidates-desktop.png`
- `reports/verification/frontend-revamp-candidates-mobile.png`
- `reports/verification/frontend-revamp-disbursements-desktop.png`
- `reports/verification/frontend-revamp-disbursements-mobile.png`

**Commands run:**

- `cd frontend && pnpm exec tsc --noEmit`: passed.
- `cd frontend && pnpm lint`: passed with zero warnings.
- `cd frontend && pnpm exec oxlint app components lib`: passed.
- Chrome MCP desktop and mobile snapshots, overflow probes, screenshots, and
  console checks for `/lobbying/registrants`, `/organizations/392017`,
  `/candidates`, and `/fec/disbursements`: passed for page layout and console
  errors. Chrome reported one form-field browser issue on the disbursement route
  from a separately owned shared navigation control; no page field lacks a name.

**Tests added:** None. This pass changed shared presentation and interaction
styling without introducing a new pure logic contract. Existing static and live
browser gates were used.

**Assumptions:** The existing public-record reading-room design direction remains
the product thesis. The animated source ticker is allowed to translate off-canvas
inside its clipped marquee because it does not increase document scroll width.

**Risk tier:** Medium. Shared primitives and global CSS affect many routes, though
the changes preserve existing component props and data behavior.

**Rollback:** Revert the four frontend implementation files and remove this pass's
four screenshots, report section, log entry, and worksheet.

**Status:** Done. Parent work still owns the isolated full build and product-wide
M6 browser matrix.
