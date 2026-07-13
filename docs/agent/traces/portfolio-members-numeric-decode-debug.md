# Agent Trace

## Task
- Task ID: portfolio-members-numeric-decode
- Risk: medium

## Failure
- `GET /api/intel/portfolio/members?limit=5` returned HTTP 500.
- PostgreSQL returned `nominate_dim1` as `NUMERIC`; `MemberRankRow` expected `Option<f64>` / `FLOAT8`.

## First wrong transition
- File: `backend/crates/intel_backend/src/routes/portfolio.rs`
- Boundary: database row to `MemberRankRow`.
- Actual: uncast `members.nominate_dim1` and `members.years_in_office` are PostgreSQL `NUMERIC`.
- Expected: `double precision` values compatible with Rust `Option<f64>`.

## Changed files
- `backend/crates/intel_backend/src/routes/portfolio.rs`
- `docs/agent/traces/portfolio-members-numeric-decode-debug.md`

## Commands run
| Command | Result |
|---|---|
| `curl -sS -i http://127.0.0.1:4021/api/intel/portfolio/members?limit=5` | reproduced 500 with exact SQLx decode error |

## Tests added
- Existing full API contract now reaches and asserts the portfolio members route before the new FEC receipts contract.

## Assumptions
- The API contract remains numeric JSON; casting at the query boundary preserves stored precision needed by this display-only score.

## Unverified
- Full API contract rerun pending after rebuild.

## Rollback
- Remove the two `::double precision` query casts.
