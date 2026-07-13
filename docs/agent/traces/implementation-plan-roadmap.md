# Implementation Plan Roadmap Worksheet

**Goal:** Replace the stale mixed audit/backlog in `docs/IMPLEMENTATION_PLAN.md` with a repository-grounded living roadmap, then create the persistent goal to complete its active milestones.

**Files changed:**
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/agent/traces/implementation-plan-roadmap.md`

**Commands run:**
- `scripts/agent-summary` - passed and confirmed the canonical stack and verification commands.
- `scripts/self-test` - passed during the repository audit.
- `cd frontend && pnpm verify` - helper tests, typecheck, and ESLint passed; Oxlint failed on existing accessibility warnings before build.
- Read-only Postgres audit queries - confirmed migrations through 0028, partial FEC cycle coverage, disclosure counts, an empty Senate discovery table, and the current job backlog.
- `git diff --check -- docs/IMPLEMENTATION_PLAN.md` - passed.
- Prose scan for em dashes, emojis, and banned copy terms - passed.

**Tests added:** None. This task changes the master planning document only. The plan records the current failing frontend gate and requires it to be fixed in M0.

**Assumptions:**
- The current dirty worktree belongs to the user and must be preserved.
- Dated database counts are a snapshot and must be refreshed before implementation decisions use them.
- The active execution scope is M0 through M6. USAspending, broader Wikidata ingestion, anomaly scoring, and pre-commit hooks remain deferred.

**Risk tier:** low

**Rollback:** Revert the focused documentation commit and delete the matching local tag. No product code, schema, or runtime data changed.

**Status:** done

**Docs checked, no update needed:** The roadmap rewrite changes no public behavior. It explicitly schedules required behavior-document updates under M0 and later milestones.
