# M6 Deterministic Reliability

**Goal:** Close feasible M6 reliability gaps with production-linked deterministic tests for frontend truth states, worker recovery decisions, source freshness, consent, and duplicate delivery.

**Files changed:** `backend/crates/intel_worker/src/job_policy.rs`, `backend/crates/intel_worker/src/main.rs`, `backend/crates/intel_backend/src/routes/home.rs`, `backend/crates/intel_backend/tests/migration_test.rs`, `frontend/lib/truth-states.mjs`, `frontend/app/fec/disbursements/page.tsx`, `frontend/scripts/truth-states.test.mjs`, `docs/IMPLEMENTATION_PLAN.md`, `docs/agent/test-catalog.md`, `docs/Log.md`, `docs/agent/traces/m6-deterministic-reliability.md`.

**Commands run:** `cargo fmt --all`; `cargo test -p intel_worker` (15 passed); `cargo test -p intel_backend freshness_tests --lib` (1 passed); `cd frontend && node --test scripts/truth-states.test.mjs` (5 passed); `cd frontend && pnpm typecheck` (passed); `cd frontend && pnpm lint:ox` (passed); `scripts/verify-migrations` (blocked: documented local role lacks `CREATEDB`); `git diff --check` (recorded after final run).

**Tests added:** retryable versus terminal interruption transitions; bounded exponential and fixed parser cooldown; 429/503 rate-limit classification; exact missing-consent behavior; fresh/stale/failed/missing/missing-key source runs; duplicate active delivery uniqueness; frontend loading/error/unavailable/empty/partial/loaded precedence.

**Assumptions:** Missing API keys continue to be recorded as `auth_missing`; parser jobs continue to pass the existing fixed 3,600-second delay; TIGER/FEC/Senate provider behavior is not represented by deterministic unit fixtures.

**Risk tier:** medium

**Rollback:** Revert the files listed above. The migration assertion is test-only and adds no schema.

**Status:** done, with the disposable migration test execution blocked locally by database permissions

**Remaining gaps:** No test kills a live worker process mid-transaction, induces a real upstream 429, or renders every critical page in every state. Senate live ingestion remains consent-gated by design.
