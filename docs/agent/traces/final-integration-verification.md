# Final Integration Verification

**Goal:** Reconcile the implemented roadmap with live browser, migration,
build, and worker evidence while enforcing the canonical agent paths.

**Files changed:**

- `docs/IMPLEMENTATION_PLAN.md`
- `docs/Log.md`
- `docs/agent/hey.md`
- `docs/agent/traces/` (moved legacy worksheets into the canonical directory)
- `docs/agent/traces/final-integration-verification.md`
- `backend/crates/intel_backend/migrations/0040_fec_disbursement_browse_order.sql`
- `backend/crates/intel_backend/src/routes/fec.rs`

**Commands run:**

- `DATABASE_URL=... scripts/verify-migrations`: passed fresh and upgrade paths
  through migration `0040`; both idempotent reruns passed. The upgrade fixture
  asserts lowercase Bioguide identifiers receive uppercase canonical paths.
- `pnpm --dir frontend build`: passed production compilation, type/lint stage,
  static generation, and route generation including `/api/elections/counties`.
- `git diff --check`: passed.
- `curl http://127.0.0.1:4020/api/system/worker-health`: worker heartbeat live;
  3,331 pending, 16 active, and 41 failed jobs at the recorded checkpoint.
- `curl http://127.0.0.1:4020/api/sources/status`: returned explicit fresh,
  stale, failed, and missing source states.
- Chrome MCP desktop and mobile checks on `/data-sources`: no document-level
  overflow, blank screen, console warning, console error, or nullable count
  leakage. Screenshots saved as `reports/verification/final-data-sources-desktop.png`
  and `reports/verification/final-data-sources-mobile.png`.
- `scripts/self-test`: passed after migration `0039` and the final election,
  visualization, and M4 alias/provenance fixes (backend format, clippy, check,
  tests; 62 frontend tests, TypeScript, ESLint, Oxlint, and production build).
- `GET /api/visualizations/campaign-finance?cycle=2024`: HTTP 200 in 13 ms on
  the final backend; the dedicated performance proof measured 20.6 ms cold and
  4.4 ms warm after a 130.20-second one-time summary backfill.
- Chrome MCP `/visualizations`: canonical Schedule A/B/E channels loaded at
  desktop and mobile widths with no blank screen, document overflow, console
  warning, or console error. Screenshots: `reports/verification/final-visualizations-canonical-desktop.png`
  and `reports/verification/final-visualizations-canonical-mobile.png`.
- Populated `full_api_contract_test`: passed every canonical endpoint and M5
  evidence assertion in 2.20 seconds after the Schedule B order-index repair.
- `GET /api/fec/disbursements?cycle=2026&page=1&per_page=5`: improved from
  4.7-5.1 seconds to 61 ms cold, 20 ms warm, and 5 ms hot.
- Final `scripts/self-test`: passed after the Senate state-contract correction,
  worker queue-recovery sweep, M6 rendered-flow harness, and migration `0040`.
- `pnpm --dir frontend test`: 67/67 passed, including 18 live API flows.
- `scripts/verify-rendered-critical-pages`: 10/10 critical SSR guidance,
  loading, and failure-state routes passed in an isolated Next process.

**Tests added:** The Schedule B browse-order contract asserts that the route's
`DESC NULLS LAST` ordering matches migration `0040`'s index definition.

**Assumptions:** The long-running House backfill belongs to this roadmap and
must remain visibly in progress. Senate eFD terms acceptance remains an
operator decision and must not be inferred or bypassed.

**Risk tier:** medium

**Rollback:** Revert the documentation reconciliation only. Do not roll back
additive migrations or delete ingested public records.

**Status:** blocked-with-reason. Static, migration, API, and browser gates pass,
but the House supported-form backfill is still active and live Senate eFD proof
is consent-gated.
