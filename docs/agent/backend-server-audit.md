# backend_server Removal Audit

Purpose: enumerate every repo reference to `backend/crates/backend_server`
found by `rg -l "backend_server"` on 2026-07-14, classify each as historical
record, live guidance, or the crate itself, and record the keep/remove
decision. This is the evidence artifact cited by M7 item 8 in
docs/IMPLEMENTATION_PLAN.md and by the Retired Decisions entry below.

Date: 2026-07-14

## Decision

`backend_server` is KEPT as deprecated compatibility code, not deleted today.
`intel_backend` is the canonical API server; all new routes and page
contracts go there. `backend_server` must not gain new features.

Removal criteria (both must hold before deletion):
1. No file in the "live guidance" category below directs a reader or agent
   to work in `backend_server` or treats it as the routes location.
2. One full release cycle has passed with `WATCHDOG.yml` pointing at
   `intel_backend` (i.e. this is not the release that just repointed it).

## References by disposition

### Historical record — keep as-is

These describe past state, provenance, or attribution and are not
instructions for where to add new code.

| File | Note |
|---|---|
| `docs/Log.md` | Changelog entries recording past milestones (including this one) |
| `CREDITS.md` | Attribution mapping adapted third-party patterns to the file they were applied in at the time |
| `docs/agent/traces/2026-07-14-implement-plan-2.md` | Trace/worksheet for a prior task |
| `docs/agent/traces/fa20-self-test-watchdog.json` | Captured `cargo`/build output artifact |
| `docs/agent/traces/final-self-test-watchdog.json` | Captured `cargo`/build output artifact |
| `ingest-pipeline-map.md` | Explicitly labeled "pre-worker snapshot ... retained only as review provenance" |

### Live guidance — verified correct, no change needed

These direct agents/readers and already correctly name `intel_backend` as
canonical and `backend_server` as deprecated/legacy. No edit required.

| File | Note |
|---|---|
| `README.md` | "backend/crates/backend_server is older code. New page features should use intel_backend." |
| `WATCHDOG.yml` | Rule 4 names `intel_backend/src/routes/` as canonical, `backend_server` as deprecated compatibility code |
| `docs/agent/CONTEXT.md` | Explicitly says "Avoid: backend_server (legacy compatibility crate)" |
| `docs/agent/repo-map.md` | Tree entry and decision table both label `backend_server` DEPRECATED |
| `docs/agent/known-errors.md` | "Legacy-only frontend endpoint" entry warns against calling legacy-only routes, points to canonical routes |
| `docs/agent/testing.md` | Lists `cargo run -p backend_server` under a row explicitly labeled "run legacy backend" |
| `docs/agent/test-catalog.md` | Both `backend_server` test rows tagged `[deprecated]` |
| `docs/IMPLEMENTATION_PLAN.md` | Core Rules and Product Rules sections already state `backend_server` is deprecated compatibility code; never add features there |

### Live guidance — corrected in this pass

| File | Note |
|---|---|
| `AGENTS.md` | Project-structure crate table listed `backend_server` as "Axum router, handlers, portfolio module" with no mention of `intel_backend` and no deprecation marker. Added an `intel_backend/` row marked canonical and relabeled `backend_server/` as DEPRECATED |

### The crate itself — keep as-is

| File | Note |
|---|---|
| `backend/crates/backend_server/Cargo.toml` | The deprecated crate's own manifest |
| `backend/Cargo.lock` | Generated lockfile entry for the workspace member; regenerates automatically |

## Counts

- Historical record: 6
- Live guidance (already correct): 8
- Live guidance (corrected in this pass): 1
- The crate itself: 2

Total files referencing `backend_server` at audit time: 17
(count excludes this audit file, which did not exist when `rg -l` was run).
