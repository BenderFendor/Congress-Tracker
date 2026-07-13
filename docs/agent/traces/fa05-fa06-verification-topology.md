# FA-05 / FA-06 Verification Topology

**Goal:** Make default and CI verification deterministic, move populated API
flows behind an explicit isolated-current-backend gate, and prevent a stale
development process on port 4020 from satisfying current-source assertions.

**Files changed:**

- `.github/workflows/ci.yml`
- `frontend/package.json`
- `frontend/scripts/e2e-api-flows.test.mjs` (moved)
- `frontend/scripts/e2e-api-flows.live.mjs`
- `frontend/scripts/verification-topology.test.mjs`
- `scripts/self-test`
- `scripts/verify-live-api-flows`
- `docs/Log.md`
- `docs/agent/known-errors.md`
- `docs/agent/test-catalog.md`
- `docs/agent/testing.md`
- `docs/agent/tools.md`
- `docs/agent/traces/fa05-fa06-verification-topology.md`

**Commands run:**

| Command | Result |
|---|---|
| `pnpm test:unit` | Passed 57/57 with no backend dependency |
| direct `node --test scripts/e2e-api-flows.live.mjs` without `BACKEND_URL` | Failed closed as required |
| direct live suite with `BACKEND_URL=http://127.0.0.1:4020` | Refused the normal development port as required |
| `DATABASE_URL=... pnpm test:live-api` | Built current backend, recorded commit/worktree state and binary hash, started isolated PID, passed 18/18 populated flows, and cleaned up |
| occupied-port invocation | Refused port 4899 before starting or reusing its current process |
| `cargo test --workspace --exclude civiq_client --lib --bins` | Passed deterministic Rust library and binary tests without provider calls |
| `cargo test -p civiq_client test_query_builder` | Passed the deterministic Civiq helper while excluding its five live-provider tests |
| `cargo test --workspace --tests --no-run` | Compiled every Rust integration target |
| `DATABASE_URL=... cargo test -p intel_backend --test fec_bulk_pipeline_test` | Passed 3/3 migrated-database contracts |
| `DATABASE_URL=... cargo test -p intel_backend --test influence_financials_test` | Passed the committee/channel reconciliation contract |
| `pnpm typecheck && pnpm lint && pnpm lint:ox` | Passed |
| `bash -n scripts/self-test scripts/verify-live-api-flows` and Node syntax checks | Passed |
| `scripts/self-test` | Passed Rust format/clippy/check, deterministic tests, integration compilation, 56 frontend tests, typecheck, both lint gates, and production build |

**Tests added:**

- `verification-topology.test.mjs` locks the deterministic filename glob and
  documented isolated live-wrapper entry point.
- The Senate live assertion now accepts only the current explicit coverage-state
  contract and validates reports/provenance instead of pinning an obsolete
  no-consent string.
- CI now runs deterministic Rust tests, compiles non-hermetic integration tests,
  and executes migration-backed FEC and influence contracts separately.

**Assumptions:**

- Populated API proof is read-only but intentionally requires the existing local
  representative database; it is not a fresh-database CI test.
- Port 4020 is reserved for ordinary development and can never be accepted by the
  populated verification suite.
- Provider-backed ingestion tests remain outside the default deterministic gate;
  compilation still prevents them from silently rotting.

**Risk tier:** medium

**Rollback:** Restore the live file to the `*.test.mjs` glob, revert the package,
CI, and self-test commands, remove `scripts/verify-live-api-flows` and the
topology test, and revert the listed documentation. This would restore the known
stale-backend and no-backend CI failure modes.

**Status:** FA-06 done in commit `e75ca39`, tag
`fa05-fa06-verification-topology`. FA-05 code and local gates are done; hosted
clean-checkout CI proof remains a release closure requirement.
