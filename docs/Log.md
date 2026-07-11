# Project Change Log

This log records changes to public behavior, developer workflows, data
contracts, and verification requirements. It does not replace Git history or
the detailed worksheets under `.agent/traces/`.

## 2026-07-11 - Stronger Frontend Verification Gate

- Replaced non-semantic command-palette and election-map interaction roles with native dialog, button, figure, output, and live-region behavior.
- Fixed every existing Oxlint accessibility warning without changing the visible navigation or election data flow.
- Changed `scripts/self-test` to run `pnpm verify`, which includes frontend helper tests, TypeScript, ESLint, Oxlint, and the production build.
- Verified the full backend and frontend self-test successfully.
- Browser proof remains pending because Chrome MCP could not find a running Chrome `DevToolsActivePort`.

## 2026-07-11 - Migration And Source-Run Audit

- Proved migrations `0001` through `0028` in an empty isolated schema and confirmed all 28 SQLx migration records succeeded.
- Confirmed the live database upgraded from migration `0016` through `0028` while preserving members, earlier source runs, and canonical FEC rows.
- Added `scripts/source-run-audit`, a read-only-by-default ledger, heartbeat, and queue report with an explicit stale-run repair mode.
- Reconciled 38 abandoned source runs while preserving the active 2024 FEC and Congress.gov processes.

## 2026-07-11 - Current Pipeline Documentation

- Updated the README and backend contract document for canonical FEC receipt browsing, House annual parsing, OCR, financial snapshots, and staged Senate discovery.
- Updated testing and workflow docs for the strict frontend gate and scheduled FEC bulk cycle window.
- Updated worker and disclosure docs for bounded concurrency, supported annual forms, OCR, current migrations, financial snapshots, and independent heartbeat behavior.
- Kept incomplete income, gift, position, Senate parsing, disbursement, and browser-proof work explicit.
