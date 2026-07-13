# M6 Migration CI Worksheet

**Goal:** Make fresh PostgreSQL migrations and upgrades from the prior committed schema deterministic CI gates, including SQLx ledger and idempotency proof.

**Files changed:**
- `.github/workflows/ci.yml`
- `scripts/verify-migrations`
- `backend/crates/intel_backend/tests/migration_test.rs`
- `docs/agent/testing.md`
- `docs/agent/test-catalog.md`
- `docs/agent/traces/m6-migration-ci.md`

**Commands run:**
- `git ls-tree --name-only HEAD backend/crates/intel_backend/migrations/ | sort | tail -5` - confirmed `0016_fec_bulk.sql` is the last migration in the prior committed schema.
- `cargo test --manifest-path backend/Cargo.toml -p intel_backend --test migration_test --no-run` - passed.
- `cargo clippy --manifest-path backend/Cargo.toml -p intel_backend --test migration_test -- -D warnings` - passed.
- `cargo fmt --manifest-path backend/Cargo.toml --check -p intel_backend` - passed.
- `bash -n scripts/verify-migrations` - passed.
- `git diff --check -- .github/workflows/ci.yml scripts/verify-migrations backend/crates/intel_backend/tests/migration_test.rs docs/agent/testing.md docs/agent/test-catalog.md` - passed.
- `DATABASE_URL=postgres://... scripts/verify-migrations` - reached disposable database creation, then stopped because the local `congress_tracker` role lacks `CREATEDB`; this is an environment permission limitation, not counted as migration proof.
- Both ignored migration tests were run against separate empty local schemas with `search_path=<isolated schema>,public` - fresh migration passed; upgrade from `0016` passed; each path also passed its second idempotent run and SQLx ledger assertions.

**Tests added:** `migration_fresh_database` applies every current migration to an empty PostgreSQL namespace, reruns the migrator, and verifies the SQLx ledger. `migration_upgrade_from_prior_committed_schema` first applies migrations through `0016`, verifies that boundary, upgrades through the full current set, reruns the migrator, and verifies ledger completeness. The CI wrapper runs these tests in separate disposable databases rather than schemas.

**Assumptions:** `0016` remains the prior committed-schema boundary until the migration milestone is committed. The official PostgreSQL GitHub Actions service initialization user can create and drop the two disposable CI databases; unlike the restricted local role, that image initializes `POSTGRES_USER` with database-creation authority. `DATABASE_URL` does not contain a path query string because the wrapper derives sibling database URLs from it.

**Risk tier:** medium

**Rollback:** Revert the CI step, migration test, wrapper script, and matching documentation entries. The verifier only creates disposable databases and removes them through its exit trap; it does not alter the configured application database.

**Status:** done for the M6 migration-CI slice; focused commit and matching tag are intentionally deferred to the root integration pass.
