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

## 2026-07-11 - Runtime Artifact Hygiene

- Added narrow ignore rules for worker PDF storage, Rust compiler crash reports, and npm lockfiles in this pnpm-only repository.
- Kept `papercuts.md` trackable as the project friction ledger.

## 2026-07-11 - Independent Worker Heartbeat

- Moved worker heartbeat writes out of the main download/parse select loop.
- Slow OCR, download, and parse batches can no longer make a live worker disappear from the five-minute health window.
- Proved heartbeat ages stayed below 30 seconds during a live 65.761-second parse batch, then requeued the verification worker's interrupted jobs explicitly.

## 2026-07-11 - Profile Evidence Runtime Repairs

- Paginated OpenFEC candidate refreshes into provider-supported pages of at most 100 rows without narrowing the requested total.
- Deduplicated organization derivation inputs and matched FEC identifiers to their exact PAC type before relationship evidence refresh.
- Proved a 101-row candidate refresh and a 60,147-row live relationship derivation successfully.
