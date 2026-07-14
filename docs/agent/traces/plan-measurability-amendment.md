# Worksheet: Plan Measurability Amendment And Plan Lint

**Date:** 2026-07-14

**Goal:** Critique the living master plan, reconcile its internal drift, make
every open item provable or measurable per operator direction, add the missing
operations milestone, and enforce all of it with a deterministic lint so the
drift cannot recur. Also steer lower-capability executing agents with explicit
guardrails.

## Files changed

- `docs/IMPLEMENTATION_PLAN.md`: ledger reconciliation (nine rows to Closed,
  FA-01 split, FA-29 added), two hardcoded migration-head claims replaced with
  the refresh command, measurability convention, Agent Execution Guardrails,
  `Proof:` clauses on all 81 open M0-M6 items, new M7 Operate In Public,
  Verification Tooling backlog, six deferred features with promotion criteria,
  delivery order and completion definition extended to M7/FA-29.
- `scripts/plan-lint` (new): six-check consistency linter.
- `scripts/self-test`: runs `scripts/plan-lint` as its first stage.
- `docs/agent/tools.md`: documented `scripts/plan-lint` and the new self-test
  stage.
- `docs/Log.md`: dated entry for the change.

## Commands run

- `scripts/plan-lint` on the pre-amendment working tree: 92 findings
  (9 ledger-state, 2 migration-claim, 81 proof-clause), matching the counts
  predicted in the approved plan.
- `scripts/plan-lint` on the amended plan: 0 findings, exit 0.
- Seeded regressions (scratch copies, `--repo "$PWD"`): flipping FA-02 back to
  High, deleting one M7 Proof clause, and recording a milestone tag dated
  2026-08-01 with no matching audit trace each produced exactly the expected
  finding and exit 1.
- `bash -n scripts/self-test`: syntax OK.

## Tests added

No test files. `scripts/plan-lint` is itself a deterministic gate wired into
`scripts/self-test`; its behavior was proved by the baseline count match and
the three seeded-failure runs above.

## Assumptions

- The nine reclassified findings are genuinely closed; this worksheet relies on
  the existing checkpoint paragraphs, trace files, and git tags (all verified
  to exist) rather than re-running their closure evidence.
- Vague-item detection is structural (missing `Proof:` clause), so a weak Proof
  clause can still pass the lint; quality of clauses was reviewed manually in
  this session.
- Full `scripts/self-test` (cargo and pnpm gates) was not rerun because no
  product source changed; the new first stage and shell syntax were verified
  directly.
- The commit intentionally carries the previous session's pending, uncommitted
  additions to `docs/Log.md` and `docs/IMPLEMENTATION_PLAN.md` (FA-14/18/19
  ledger closures and log entries) because they share the ledger/documentation
  concern and would otherwise remain unpreserved.

## Risk tier

Low. Documentation and verification tooling only; no product code, schema, or
data path changed. The main risk is plan-lint false positives blocking
self-test; mitigated by scoping path checks to the ledger and baseline
sections and testing against the current document.

## Rollback

Revert the tagged commit. `scripts/self-test` skips the lint stage when
`docs/IMPLEMENTATION_PLAN.md` is absent, so reverting the plan changes alone
also requires reverting the self-test stage or the linter reports the old
inconsistencies again (which is the intended behavior).

## Status

done
