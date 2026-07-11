# Agent Tools

This document lists repository scripts that support diagnosis, verification,
and repeatable operations. Every tool must provide `--help` or a clear header
comment. Tools should default to read-only behavior when they can change data.

## `scripts/agent-summary`

Prints the stack, key paths, package commands, backend crates, environment-key
presence, and recent commits for quick repository orientation.

## `scripts/self-test`

Runs backend formatting, clippy, check, and tests, followed by the complete
frontend `pnpm verify` gate.

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
