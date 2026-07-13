# Influence Graph Revamp Worksheet

**Goal:** Replace misleading influence-network decoration with a responsive,
source-backed explanation of verified network identities, distinct FEC activity
channels, and loaded recipient records.

**Files changed:**

- `frontend/app/influence/page.tsx`
- `frontend/app/influence/[slug]/page.tsx`
- `frontend/app/globals.css`
- `frontend/components/influence-flow-map.tsx`
- `frontend/lib/influence-financials.mjs`
- `frontend/lib/influence-financials.mjs.d.ts`
- `frontend/lib/services/influence.ts`
- `frontend/scripts/influence-financials.test.mjs`
- `docs/UI_UX_AUDIT.md`
- `docs/Log.md`
- `docs/agent/test-catalog.md`
- `reports/verification/influence-network-revamp-desktop.png`
- `reports/verification/influence-network-revamp-mobile.png`
- `reports/verification/influence-network-detail-mobile.png`

**Commands run:**

- `curl -s http://127.0.0.1:4020/api/influence/networks | jq ...`: confirmed
  13 loaded networks and 17 verified committee identities.
- `curl -s 'http://127.0.0.1:4020/api/influence/networks/aipac/financials?cycle=2026' | jq .`:
  confirmed separate network totals and three loaded recipient records.
- `pnpm test`: 44 tests passed, including four new influence graph tests.
- `pnpm typecheck`: passed after adding explicit graph model types.
- `pnpm lint`: passed with no warnings or errors.
- `pnpm lint:ox`: passed with warnings denied.
- Chrome MCP at `/influence`: desktop and mobile content, graph, data labels,
  links, layout, and console verified.
- Chrome MCP screenshot inspection: all three PNGs reviewed visually. The
  initial inspection exposed a dark-theme graph contrast defect; dark-mode
  color tokens were corrected before the final pass.

**Tests added:** `frontend/scripts/influence-financials.test.mjs` covers channel
separation, total reconciliation, recipient coverage, and invalid amount input.

**Assumptions:** The financial endpoint network aggregate and loaded recipient
list are the canonical display boundary. Per-committee financial values are not
displayed because they do not currently reconcile with that boundary. The
frontend does not infer committee-to-recipient allocations.

**Risk tier:** medium

**Rollback:** Revert the files listed above. No schema, API, ingestion, or stored
record changes are part of this revamp.

**Status:** done
