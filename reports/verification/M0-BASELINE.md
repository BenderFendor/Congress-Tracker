# M0 Baseline Verification

This report records the 2026-07-11 M0 migration and pipeline-state audit. The
database and queue counts are a point-in-time snapshot. Refresh them before
using them to make completion claims.

## Frontend And Repository Gate

- `pnpm verify`: passed, including eight helper tests, TypeScript, ESLint, Oxlint, and the Next.js production build.
- `scripts/self-test`: passed after it was changed to invoke the complete frontend gate.
- Chrome MCP: unavailable because Chrome had no `DevToolsActivePort`; desktop and mobile browser proof remains open.

## Fresh Migration Proof

The current backend binary ran against an empty isolated schema through
`PGOPTIONS=-c search_path=ct_m0_fresh_20260711`.

- Applied migrations: 28
- First version: 1
- Last version: 28
- All migration rows successful: true
- Canonical tables created: 69
- Backend reached its listening state on the isolated schema.
- The temporary schema was removed after verification.

The database role cannot create databases, so the test used an empty schema in
the same Postgres instance. This proves the migration chain against an empty
namespace without modifying the live `public` tables.

## Upgrade Migration Proof

The live database had migration `0016` installed before migrations `0017`
through `0028`. Every later migration has a successful SQLx record.

- Members preserved: 537
- Current-member rows preserved: 537
- Source runs predating migration `0017`: 115
- Canonical 2022 individual receipts preserved: 12,663,348

## Source-Run Reconciliation

The first read-only audit found 34 running rows older than 24 hours. A second
three-hour audit found four more rows older than the worker subprocess ceiling:
two Voteview rows, one House index row, and one earlier 2022 FEC row.

`scripts/source-run-audit --apply` marked all 38 rows failed with:

```text
reconciled stale running source run after process interruption
```

The follow-up audit found zero rows older than three hours. It preserved two
recent rows tied to active work:

- OpenFEC 2024 bulk ingestion
- Congress.gov all-current-member legislation ingestion

## Queue Snapshot

At the final audit:

- Download jobs: 7,943 pending, 14,496 completed, 2 failed
- Parse jobs: 11,347 pending, 1 running, 3,148 completed

These counts prove that the disclosure backfill is active. They do not prove
House disclosure completeness.

## Coverage Snapshot

The final M0 SQL audit found no `source_runs` left in `running` state.

- FEC 2022: canonicalized; 63,885,805 individual rows seen and 12,684,888
  written, plus 5,364,539 committee rows seen and 1,031,864 written.
- FEC 2024: retryable `staging` batch with no canonical rows yet. M1 remains
  responsible for resuming and completing it.
- FEC 2026: canonicalized; the latest batch recorded 26,116,746 individual
  rows seen and 6,319,498 written, plus 8,268,847 committee rows seen and
  1,612,178 written.
- House disclosures: 3,037 parsed, 273 partial, 13,033 pending, and 348
  rejected. These are explicit coverage states, not factual zeroes.

## Worker Heartbeat Finding

The worker heartbeat exceeded the API's five-minute health window while the
main select loop awaited a slow parse batch. The worker process and its locked
parse job were still active. The fix moves heartbeat writes into an independent
Tokio task with a 30-second delayed missed-tick policy. Targeted formatting,
clippy, and worker tests passed.

A patched backfill worker processed the live queue, including a 65.761-second
parse batch. Heartbeat samples taken during that work were 3, 28, and 20
seconds old. This proves the heartbeat task continued to update while the main
worker loop awaited parsing. The controlled shutdown's two claimed jobs were
returned to `pending` with an explicit reconciliation reason.

## Runtime Failure Repairs

- OpenFEC candidate refresh now splits requests into provider-supported pages
  of at most 100 rows. A live 2026 request with limit 101 completed with 101
  rows seen, proving the second page was fetched.
- Relationship derivation now collapses duplicate organization conflict keys
  and maps FEC identifiers to the exact derived organization type. A live
  refresh completed with 60,147 rows seen and 132,232 writes.
- The FEC subprocess reached its two-hour ceiling while staging 2024. Its
  orphaned source run was marked failed with an explicit timeout-reconciliation
  reason. The 2024 batch remains `staging` and is a truthful retryable M1 item,
  not a completeness claim.
