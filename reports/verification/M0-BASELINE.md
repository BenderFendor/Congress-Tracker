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
