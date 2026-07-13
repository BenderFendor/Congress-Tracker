# Election Filing and Receipt Query Truth Worksheet

This worksheet records closure evidence for the filing-semantics defect FA-01
and the receipt-query defect FA-11 from the implementation-plan audit ledger.

## Goal

Stop presenting FEC candidate filing counts as election ratings or party lean,
classify common FEC party codes correctly, and ensure absent receipt filters
remain absent while candidate receipt links use the canonical search parameter.

## Files changed

- `frontend/components/elections/election-map-helpers.ts`
- `frontend/components/elections/election-map-render.ts`
- `frontend/components/elections/election-map.tsx`
- `frontend/lib/fec-receipts.mjs`
- `frontend/app/fec/receipts/page.tsx`
- `frontend/app/candidates/page.tsx`
- `frontend/scripts/election-filing-semantics.test.mjs`
- `frontend/scripts/fec-receipts.test.mjs`
- `docs/agent/test-catalog.md`
- `docs/Log.md`
- `docs/IMPLEMENTATION_PLAN.md`

## Commands run

- `node --test scripts/election-filing-semantics.test.mjs scripts/fec-receipts.test.mjs`: passed, 6 tests.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with zero warnings.
- `git diff --check -- <scoped frontend files>`: passed.
- Chrome MCP at `http://localhost:3001/elections`: loaded 149 House candidate rows, found no Safe, Lean, Tilt, Toss-up, party-lean, or most-competitive claim, and confirmed the filing-not-forecast disclosure.
- Chrome MCP at 1440 by 1000 and 390 by 844: no document-level horizontal overflow and no console warning or error.
- Chrome MCP at `http://localhost:3001/fec/receipts`: default minimum and maximum inputs were empty rather than zero.
- Chrome MCP at `http://localhost:3001/candidates`: generated receipt links used `q`, `page`, and `per_page`, with no unsupported `search` parameter.

## Browser evidence

- `docs/agent/traces/elections-desktop-1440.png`
- `docs/agent/traces/elections-mobile-loaded.png`
- `docs/agent/traces/fec-receipts-default-mobile.png`
- `docs/agent/traces/elections-desktop.snapshot.txt`
- `docs/agent/traces/elections-mobile.snapshot.txt`

## Tests added

- `election-filing-semantics.test.mjs` prevents forecast-like metrics and copy
  from returning and requires explicit recognition of DEM, REP, and independent
  FEC party codes.
- `fec-receipts.test.mjs` now proves absent numeric bounds do not serialize as
  zero and candidate links use the canonical receipt-search query parameter.

## Assumptions

- FEC candidate records describe filings, not certified results, vote share, or
  forecast probabilities.
- Certified state and county election-result ingestion remains separate open
  roadmap work; removing unsupported ratings closes the misinformation portion
  of FA-01 but does not claim that result ingestion exists.

## Risk tier

Medium. The change removes a misleading interpretation without deleting the
underlying filing directory or geography navigation.

## Rollback

Revert the matching focused commit. Do not restore filing-count-derived race
ratings unless a canonical certified-results or forecast source and its
provenance contract are implemented first.

## Status

Implemented in commit `e75ca39`, tag
`fa01-fa11-election-receipt-truth`. FA-11 still needs a final browser filter
round trip and measured receipt latency for strict ledger closure. FA-01 remains
open for certified result ingestion and state-to-county reconciliation, while
its public misinformation defect is fixed.
