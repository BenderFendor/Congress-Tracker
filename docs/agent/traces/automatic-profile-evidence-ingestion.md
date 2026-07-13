# Agent Trace

## Task
- Task ID: automatic-profile-evidence-ingestion
- Risk: high

## Changed files
- `AGENTS.md`
- `backend/crates/intel_backend/Cargo.toml`
- `backend/crates/intel_backend/src/main.rs`
- `backend/crates/intel_backend/src/bin/ingest.rs`
- `backend/crates/intel_backend/src/repository/members.rs`
- `backend/crates/intel_worker/Cargo.toml`
- `backend/crates/intel_worker/src/main.rs`
- `frontend/app/legislators/[id]/page.tsx`
- `docs/agent/workflows.md`

## Commands run
| Command | Result |
|---|---|
| `cargo check -p intel_backend -p intel_worker` | passed |
| `cargo test -p intel_backend -p intel_worker` | passed, 48 passed and 2 live tests ignored |
| `cargo clippy -p intel_backend -p intel_worker --all-targets --all-features -- -D warnings` | passed before final scheduler refinements; must rerun |
| `pnpm typecheck && pnpm lint && pnpm test && pnpm build` | passed |
| `cargo run -p intel_backend --bin ingest -- profile-evidence-all` | partial; populated 537 members and exposed Congress member schema drift |
| `cargo run -p intel_backend --bin ingest -- voteview --members --votes --rollcalls` | running current-Congress validation at trace creation |

## Tests added
- No new test file. Existing backend ingest idempotency and API-contract suites cover command and route compilation.
- Runtime validation uses `source_runs` plus live `O000172` profile, funding, legislation, relationships, and disclosure endpoints.

## Assumptions
- `run_all.sh` starts `intel_worker` from the backend workspace.
- Current profile views target the 119th Congress and 2026 FEC cycle.
- One provider failure must not prevent later independent source refreshes.

## Failures encountered
- Congress member existence query decoded `SELECT 1` as `String`; corrected to `i32`.
- Congress member update referenced removed `source_run_id`; corrected to `last_source_run_id`.
- Voteview importer used incorrect CSV indexes and all-history files; corrected to official Congress-specific files and schemas.
- Voteview per-vote ICPSR resolution caused an N+1 query; replaced with one in-memory crosswalk.
- Member NOMINATE `NUMERIC` columns failed `f64` decoding; member queries now cast to double precision.

## Unverified
- Complete OpenFEC donor/committee rankings still need a fully paginated all-authorized-committee scheduler.
- Full scheduled cycle duration and final live member-tab row counts remain to be measured after the corrected Voteview run completes.

## Rollback
- Remove the worker profile-refresh tick and `profile-evidence-all` command; retain source-specific ingest commands and existing House disclosure worker.
