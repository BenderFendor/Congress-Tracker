# M0 Migration And Source-Run Audit Worksheet

**Goal:** Prove the current migration chain and reconcile abandoned source-run ledger rows without disturbing active backfills.

**Files changed:**
- `scripts/source-run-audit`
- `docs/agent/tools.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/Log.md`
- `reports/verification/M0-BASELINE.md`
- `.agent/traces/m0-migration-source-run-audit.md`

**Commands run:**
- `scripts/source-run-audit --help` - passed.
- `bash -n scripts/source-run-audit` - passed.
- `scripts/source-run-audit --stale-hours 24` - found 34 stale rows.
- `scripts/source-run-audit --stale-hours 24 --apply` - reconciled 34 rows.
- `scripts/source-run-audit --stale-hours 3 --apply` - reconciled four additional rows beyond worker subprocess limits.
- Final `scripts/source-run-audit --stale-hours 3` - found zero stale source runs and preserved two recent active runs.
- Empty-schema backend startup - applied migrations 1 through 28 and reached the listening state.
- Live upgrade audit - confirmed migrations 16 through 28 succeeded and earlier data remained present.

**Tests added:** The script provides help, validates its numeric threshold, defaults to read-only output, and was exercised in both audit and apply modes against the live local database.

**Assumptions:** Three hours is safe because scheduled profile and FEC subprocesses have two-hour timeouts. Database counts are time-sensitive and remain evidence snapshots, not constants.

**Risk tier:** medium

**Rollback:** Revert the focused commit to remove the script and docs. The 38 reconciled source-run rows should remain failed because they represented abandoned processes; restoring them to running would make the freshness ledger false.

**Status:** done
