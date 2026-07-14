# M7 Item 4 / FA-29 Cache-Control Route Coverage Test

Purpose: record the route-enumeration test that proves 100% of public GET
routes on the intel_backend API emit an explicit, non-empty `Cache-Control`
header, and its verification evidence.

## Goal

M7 item 4's first proof clause (FA-29) requires a route-enumeration test
asserting every public GET route emits `Cache-Control`. The middleware
(`cache_control_middleware` in `src/routes/mod.rs`) was already committed;
what was missing was the test that proves coverage and guards against
regression when new routes are added. The proxy hit-ratio half of the M7
proof (reverse-proxy cache behavior) is explicitly deferred — no reverse
proxy exists yet — and is out of scope here.

## Files changed

- `backend/crates/intel_backend/tests/cache_control_coverage_test.rs` (new)
- `docs/agent/traces/m7-cache-control-test.md` (new, this file)

No source files under `src/` were touched — the middleware already had full
coverage; no fix was needed (see Findings below).

## Approach

`axum::Router` in axum 0.7 (the pinned version, per `Cargo.toml`) does not
expose a public API to enumerate registered routes at runtime. Per the task's
documented fallback, the test keeps a literal `ROUTES: &[&str]` list (53
entries, one per `.route(...)` registration in `src/routes/mod.rs`, each
rendered as a concrete path with a syntactically valid but nonexistent
placeholder for path params) alongside a drift-detection unit test,
`route_count_matches_router_source`, which `include_str!`s
`src/routes/mod.rs` at test time and counts occurrences of the literal
substring `.route(`. If a route is added or removed from the router without
updating `ROUTES`, that count check fails first and loudly, so a new route
cannot silently skip Cache-Control coverage.

The main test, `all_public_get_routes_emit_cache_control`, spawns the real
`intel_backend` binary against a live database (same pattern as
`tests/full_api_contract_test.rs`: `TcpListener`-probed free port, health-poll
via reqwest, `Command::spawn` with `DATABASE_URL`/`PORT` env vars), issues a
GET to every route in `ROUTES`, and asserts the response carries a
`Cache-Control` header that is present and non-blank — regardless of status
code. Several routes 404 (unknown placeholder entities) or even 500
(pre-existing, unrelated data issues in `/api/home/summary` and
`/api/intel/portfolio/pulse`); the test intentionally does not assert on
status, only on header presence, so it also proves the middleware wraps
error responses, not just the happy path.

## Commands run

- `cargo check -p intel_backend --tests`: passed.
- `cargo test -p intel_backend --test cache_control_coverage_test -- --nocapture`
  (DATABASE_URL sourced via `grep -E '^DATABASE_URL=' .env | cut -d= -f2-`,
  same convention as `scripts/db-query`, never `source`d): passed, 2/2 tests
  — `route_count_matches_router_source` and
  `all_public_get_routes_emit_cache_control`. All 53 enumerated routes
  returned a non-empty `Cache-Control` header.
- `cargo fmt -p intel_backend --check`: found one line-wrap violation in the
  new file, fixed, re-ran clean.
- `cargo clippy -p intel_backend --tests -- -D warnings`: passed, 0 warnings
  (ran twice, second time after `touch` to force a real rebuild rather than
  rely on a cached "Finished" result).

## Findings

All 53 public GET routes already emit `Cache-Control` via the existing
`cache_control_middleware` — no middleware fix was required. The middleware
is applied as an outer `.layer(...)` on the whole router (including the
axum default 404 fallback and per-handler `AppError` responses), so it
covers hits, not-founds, and internal errors uniformly. No route was found
lacking the header.

## Tests added

- `backend/crates/intel_backend/tests/cache_control_coverage_test.rs`:
  - `route_count_matches_router_source` — drift guard, no DB required.
  - `all_public_get_routes_emit_cache_control` — full route enumeration
    against a live server; requires `DATABASE_URL` (skips with a message if
    unset, matching `full_api_contract_test.rs`'s convention).

## Assumptions

- All registered routes in `src/routes/mod.rs` use `axum::routing::get(...)`
  exclusively (verified: 53 `.route(` calls, 53 `get(` calls, zero
  post/put/delete/patch) — so "every public GET route" is exactly the router's
  full route set today.
- Placeholder path-param values (e.g. `Z000000`, `999999`, `ZZZZZ99`) are
  syntactically valid for their handlers' extractors but do not correspond to
  real entities; this was checked against each handler's `Path<...>` type
  (all take `String`/parsed-`i32`-from-string, none panic on unknown values —
  confirmed via `Result<Json<T>, AppError>` return types).
- `include_str!("../src/routes/mod.rs")` resolves relative to the test file's
  own directory (`tests/`), consistent with Rust's path-macro resolution.

## Risk tier

Low. Test-only addition; no production code changed. Worst case if the drift
guard is ever wrong is a false test failure demanding a one-line `ROUTES`
update, not a missed regression.

## Rollback

Delete `backend/crates/intel_backend/tests/cache_control_coverage_test.rs`.
No other files depend on it.

## Status

Done.

## Note: unrelated concurrent breakage observed

During this session, `backend/crates/intel_worker/src/main.rs` and
`src/job_policy.rs` were mid-edit by a concurrent process/agent (not this
task — `intel_worker` is outside the `backend/crates/intel_backend/` scope
given for this task). Workspace-wide lint hooks fired twice against that
unrelated crate's transient broken state (unused imports, then a clippy
`this operation has no effect` on `ONE_GIB`) while this task's edits were
scoped correctly to `intel_backend`. Not fixed here per explicit scope
instructions; flagging in case the other agent's work needs a status check.
