# FA-19 LDA Refresh And Idempotency Trace

## Goal

Make LDA activity ingestion semantically idempotent and make normal LDA
freshness a bounded, restartable `intel_worker` responsibility with honest
`source_runs` and `ingest_jobs` state.

## Files changed

- `backend/crates/intel_backend/migrations/0043_lobbying_activity_idempotency.sql`
- `backend/crates/intel_backend/migrations/0044_lobbying_activity_canonical_entities.sql`
- `backend/crates/intel_backend/migrations/0045_lobbying_activity_source_identity.sql`
- `backend/crates/intel_backend/migrations/0046_lobbying_activity_lobbyist_roles.sql`
- `backend/crates/intel_backend/migrations/0047_lobbying_government_entity_identity.sql`
- `backend/crates/intel_backend/src/bin/ingest.rs`
- `backend/crates/intel_backend/src/repository/lobbying.rs`
- `backend/crates/intel_backend/tests/migration_test.rs`
- `backend/crates/intel_worker/src/job_policy.rs`
- `backend/crates/intel_worker/src/main.rs`
- `backend/crates/lobbying_client/src/lib.rs`
- `docs/Log.md`
- `docs/agent/test-catalog.md`
- `docs/agent/workflows.md`

## Commands run

| Command | Result |
|---|---|
| `cargo fmt --check` | Passed |
| `cargo check -p intel_backend -p intel_worker -p lobbying_client` | Passed |
| `cargo test -p intel_worker job_policy::tests::lda_refresh_scope_is_recent_deduplicated_and_bounded -- --exact` | Passed, 1 test |
| `cargo test -p lobbying_client --lib` | Passed, 10 tests |
| `cargo test -p intel_backend --bin ingest lobbying_ingest_tests -- --nocapture` | Passed, 3 tests |
| `cargo test -p intel_worker tests::lda_source_run_validation_retries_missing_and_unexpected_outcomes -- --exact` | Passed, 1 test |
| `cargo test -p intel_backend --test migration_test --no-run` | Passed |
| `cargo clippy -p intel_backend -p intel_worker -p lobbying_client --all-targets --all-features -- -D warnings` | Passed |
| PostgreSQL transaction with duplicate/reordered activity entities, cleanup, unique index, and retry | Passed; stable count was 1 and transaction rolled back |
| `PORT=4099 DATABASE_URL=... timeout --foreground 20s cargo run -p intel_backend --bin intel_backend` | Passed current-database upgrade; backend served on 4099 before bounded timeout |
| Query `_sqlx_migrations` versions 43 and 44 | Both applied successfully |
| Compare migration 43 file SHA-384 with installed checksum | Exact match: `48166d9c2972698c56bf543fe7c42a674c510d8fed7df06fce2d3ea70bc135940ec1bbb54dc36fadd025e1a3b57216eb` |
| Compare file and installed SHA-384 for migrations 43-47 | Exact parity: 43 `48166d9c...`, 44 `e1826230...`, 45 `03515f80...`, 46 `b59c596e...`, 47 `0c53246f...` |
| `curl` LDA base without and with `/v1` | `https://lda.gov/api/filings/` returned 404; `https://lda.gov/api/v1/filings/` returned 200 |
| `DATABASE_URL=... scripts/verify-migrations` | Blocked: local `congress_tracker` role cannot create disposable databases |
| fresh migration test in isolated `fa19_migration_fresh,public` search path | Passed |
| prior-schema upgrade test in isolated `fa19_migration_upgrade,public` search path | Passed |

## Tests added

- Migration tests collapse legacy semantic activity duplicates, reject rerun
  multiplication, preserve foreign-entity/lobbyist identity and activity-level
  associations, preserve distinct continuation pages, and prove an owned
  page completion plus continuation enqueue can commit atomically.
- Migration 46 preserves multiple distinct roles for the same lobbyist within
  one activity rather than overwriting the association.
- Migration 47 canonicalizes repeated government entities by stable ID and
  normalized fallback name; upgrade proof verifies a renamed/repeated ID leaves
  one activity on rerun.
- Worker policy tests cover default/configured year scope and page bounds.
- Worker policy tests require continuation identities to retain page size.
- Ingest tests prove prior-page failure counters survive and stable lobbyist IDs
  ignore spelling corrections while role, newness, and different IDs remain distinct.
- Lobbying client tests pin the live-proved `/api/v1` endpoint shape.
- The shared bounded process-group test covers awaited descendant termination
  before LDA releases its advisory lock because LDA uses the same helper.

## Assumptions

- LDA activity government entities are semantically a set; sorting by stable ID
  and name is preferable to treating provider array order as identity.
- Null and empty optional activity text represent the same absent identity.
- Current and prior years are the default freshness window. Operators may select
  up to four valid years from 2012 through the current year.
- Four page chunks per cadence is an acceptable resource ceiling; page-keyed
  continuation jobs preserve eventual full traversal across cadences.

## Risk tier

High. This changes migrations, ingestion identity, provider pagination, and a
scheduled worker path.

## Failures encountered

- The first disposable migration run lacked `DATABASE_URL`; the documented
  local URL then proved the database role cannot create databases.
- Migration 43 was applied by a concurrent local backend while it was still
  being refined. It was restored byte-for-byte to the installed checksum, and
  all later cleanup was moved into forward-only migration 44. Current upgrade
  then succeeded.
- The same shared-worktree race applied migration 45 before its role-key
  refinement. Migration 45 was restored byte-for-byte to installed checksum
  `03515f80aeae804cdbd09f1446ce2efb4ce37b125edfcba23b4aae357dbb01c3fe13263a4c1872ca6056266caa70d296`;
  the refinement moved to forward migration 46. The reusable repair is recorded
  in `docs/agent/known-errors.md`.
- A live endpoint review showed `/api` returns 404 while `/api/v1` returns 200;
  the default and deterministic URL test now require `/v1`.
- Review found completion and continuation enqueue were separate writes. They
  now share one transaction and completion rejects missing/failed source runs.
- Review found mutable page-size geometry and latest-row source-run lookup. Job
  identity now pins page size and each subprocess uses an exact UUID correlation.
- Review found activity identity omitted foreign-entity issues and activity
  lobbyists. Migration 45 and ingestion retain both, including scoped links.
- Final review found government display names still participated in identity
  even when a stable ID existed. Migration 47 and runtime normalization now
  ignore ID-backed renames and deduplicate repeated projected entities.
- Final review found correlated-run lookup/validation errors could return early
  after child success. Missing, database-error, and unexpected-status paths now
  use the same owner-checked retry/terminal transition as process failures.

## Rollback

Revert the Rust/client/docs changes only before deploying migrations 43–47. If
any of those migrations has been applied, do not rewrite or delete it: add a
new forward migration that restores the desired activity schema and index.
Every applied migration is checksum-pinned.

## Status

Done. Focused compile, unit, lint, live endpoint, transactional SQL, checksum,
current-database upgrade, isolated fresh migration, and isolated prior-schema
upgrade proof passed. The schema-isolated proof avoided the local role's lack of
`CREATE DATABASE` without touching the shared application schema.
