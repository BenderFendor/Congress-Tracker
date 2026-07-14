# Agent Tools

This document lists repository scripts that support diagnosis, verification,
and repeatable operations. Every tool must provide `--help` or a clear header
comment. Tools should default to read-only behavior when they can change data.

## `scripts/agent-summary`

Prints the stack, key paths, package commands, backend crates, environment-key
presence, and recent commits for quick repository orientation.

## `scripts/self-test`

Runs the plan consistency lint, backend formatting, clippy, check, and tests,
followed by the complete frontend `pnpm verify` gate.

## `scripts/plan-lint`

Deterministic consistency check for `docs/IMPLEMENTATION_PLAN.md`, run first by
`scripts/self-test`. Fails when the finding-ledger table disagrees with the
closure checkpoint, a Closed finding cites a missing trace file or git tag, a
cited repository path does not exist, a hardcoded migration-head claim appears,
an unchecked milestone implementation item lacks a `Proof:` clause, or a
recorded milestone tag has no fresh-eyes audit trace dated within the prior
seven days.

```bash
scripts/plan-lint
scripts/plan-lint path/to/copy.md --repo "$PWD"
```

Read-only. Exit 0 when clean, 1 on findings, 2 on usage errors.

## `scripts/source-run-audit`

Audits running `source_runs`, worker heartbeats, and ingest-job counts.

```bash
scripts/source-run-audit
scripts/source-run-audit --stale-hours 24 --apply
```

The default mode is read-only. `--apply` marks only running source rows older
than the configured threshold as failed and records an explicit reconciliation
message. The minimum threshold is three hours so normal two-hour worker
subprocess limits are not classified as stale. `DATABASE_URL` must already be
present in the command environment.

## `scripts/verify-rendered-critical-pages`

`scripts/verify-rendered-critical-pages` starts Next on an isolated port with an
intentionally unreachable backend, then verifies deterministic server-rendered
guidance, loading, and failure states for ten critical research routes. Override
the port with `RENDERED_TEST_PORT`. This tool does not replace Chrome screenshots
or loaded-data API flows.

## `scripts/verify-live-api-flows`

Builds the current canonical backend, starts that exact executable on an isolated
non-4020 port, and runs populated read-only frontend API flows. It requires an
explicit `DATABASE_URL` naming a representative populated database, refuses to
reuse the normal development port, records the executable hash, and cleans up
only its own process.

## `frontend/scripts/prepare-county-geography.mjs`

Operator-only acquisition command for the prepared county geography read
plane. It downloads normalized Census TIGERweb geometry and atomically replaces
one or all of the checked-in per-jurisdiction artifacts.

```bash
cd frontend
node scripts/prepare-county-geography.mjs --help
node scripts/prepare-county-geography.mjs --state 06 --prepared-at 2026-07-12T00:00:00.000Z
```

Normal public requests never invoke this command or contact TIGERweb.
