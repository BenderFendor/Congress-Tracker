# Fresh-Eyes Audit Worksheet

This worksheet records the 2026-07-12 release audit of the current worktree,
live runtime, database, frontend, CI, tests, plan, and documentation. The audit
is findings-first and does not implement production fixes.

## Goal

Find factual, functional, reliability, test-confidence, deployment, plan, and
documentation defects that would block a trustworthy public release.

## Files changed

- `docs/audits/FRESH_EYES_AUDIT_2026-07-12.md`
- `docs/agent/traces/fresh-eyes-audit-2026-07-12.md`
- `papercuts.md` only to remove the final blank line after audit notes logged by the review agents

## Commands run

- `scripts/agent-summary`: repository orientation completed.
- `git status --short`, `git diff --stat`, `git tag --list`, and `git log`: worktree and release state inspected.
- Live `curl` checks against port 4020: health, worker, source, disclosure, Senate, election, bill, influence, Member, lobbying, search, and review-queue contracts inspected.
- Isolated current backend on port 4021: started successfully and stopped after diagnostics.
- `BACKEND_URL=http://127.0.0.1:4021 node --test scripts/e2e-api-flows.test.mjs`: 17 passed, 1 failed on the stale Senate assertion.
- Live suite against an unreachable backend: all 18 live tests failed, reproducing the frontend CI topology.
- Chrome: Elections DOM, accessibility, geometry, console, overflow, and screenshot checks completed.
- `git diff --check`: initially failed on `papercuts.md`; final check required after this worksheet.

## Tests added

None. This task audits the current evidence and identifies missing or weak tests.

## Assumptions

- Port 4020 represented the currently used local integration runtime.
- Live database counts are point-in-time evidence because the House worker remained active.
- Concurrent frontend build activity caused the later missing Next.js chunk errors; the audit does not attribute those chunk errors to a source regression.

## Risk tier

High. The audit found public factual errors, cross-entity state leakage risk,
unsafe public work triggers, incorrect financial attribution, non-runnable CI,
stale verification, non-idempotent persistence, and incomplete release gates.

## Rollback

Revert the audit documentation commit and delete its matching tag. No production
schema, source, runtime, or public behavior changed.

## Status

Done. The release remains blocked by the findings in the audit report.
