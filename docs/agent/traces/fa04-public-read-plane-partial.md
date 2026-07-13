# Public Read Plane Partial Repair Worksheet

This worksheet records the completed funding/admin portion and remaining county
and shared-budget portion of FA-04.

## Goal

Prevent public GET requests from triggering ingestion or persistent writes,
remove the public entity-review endpoint, and bound private review reads.

## Files changed

- `backend/crates/intel_backend/src/routes/funding.rs`
- `backend/crates/intel_backend/src/routes/admin.rs` removed
- `backend/crates/intel_backend/src/routes/mod.rs`
- `backend/crates/intel_backend/src/main.rs`
- `backend/crates/intel_backend/src/repository/entity_resolution.rs`
- `backend/crates/intel_backend/tests/full_api_contract_test.rs`

## Commands run

- `cargo fmt --all -- --check`: passed.
- `cargo check -p intel_backend --all-targets`: passed.
- `cargo clippy -p intel_backend --all-targets -- -D warnings`: passed.
- Focused funding no-write and queue-bound tests: passed.
- Fresh backend on port 4899: funding returned 200 in 34 ms; the former public
  admin route returned 404 with an empty body.
- `scripts/self-test`: passed after integration.

## Tests added

- The funding handler is guarded against calls to live ingestion and persistent
  funding-cache writes.
- Entity-resolution queue limits clamp to 1 through 500.
- The production API contract requires the former public admin route to return
  404.

## Assumptions

- Entity-resolution review remains available through private repository and CLI
  paths; removing its public route does not delete operator capability.
- County geography acquisition is a separate unfinished part of FA-04 and must
  move out of public request handling before the finding closes.

## Risk tier

High. A regression could let anonymous traffic trigger provider calls or writes.

## Rollback

Revert commit `e75ca39`. Do not restore a public mutation-capable GET route.

## Status

Partial. Funding and admin boundaries are done. Prepared county serving and
shared rate, concurrency, timeout, and response-size budgets remain open.
