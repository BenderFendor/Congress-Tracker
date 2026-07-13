# FA-10 Worker Lease And Resource Bounds

Purpose: record the worker ownership and parser resource-bound implementation
and its focused verification evidence.

## Goal

Prevent long document jobs from losing their leases or publishing after lease
loss, and keep native PDF/OCR work bounded on Pi-class, interactive workstation,
and explicitly opted-in burst profiles.

## Files changed

- `backend/Cargo.lock`
- `backend/crates/intel_worker/Cargo.toml`
- `backend/crates/intel_worker/src/main.rs`
- `backend/crates/intel_worker/src/parsers.rs`
- `docs/Log.md`
- `docs/agent/test-catalog.md`
- `docs/agent/workflows.md`
- `docs/agent/traces/fa10-worker-bounds.md`
- `papercuts.md`

## Commands run

- `cargo check -p intel_worker`: passed.
- `cargo test -p intel_worker --bin intel_worker`: passed, 26 tests.
- `cargo clippy -p intel_worker --all-targets -- -D warnings`: passed.
- `cargo build -p intel_worker --bin intel_worker`: passed; rebuilt the exact
  current-checkout binary before the live exercise.
- Live PostgreSQL reclaim exercise against orphaned job `31878`: passed. The
  job began `running` under owner
  `8e098c40-f261-45e9-b0aa-9edce9089e59`, was reclaimed by worker
  `05726add-a19f-4ecc-8241-ee19a116370f`, advanced from attempt `0` to `1`,
  and renewed its lease while native parsing ran.
- Stale-owner terminal-update injection: passed with zero affected rows; the
  replacement owner and `running` state remained unchanged.
- Controlled worker shutdown and cleanup: passed; the proof job was returned
  to `pending` with no owner so the exercise did not strand a live lease.
- `git diff --check`: passed.

## Tests added

- A real sleeping native child and its process group are killed at the wall
  deadline.
- Native output above the byte limit is rejected rather than silently accepted.
- Render page file caps multiply to no more than the total scratch budget.
- Interactive pressure thresholds reserve CPU and memory headroom before OCR.
- Terminal job transitions reject missing or ambiguous ownership.

Existing `job_policy` tests continue to prove interrupted-job retry exhaustion
and bounded retry delays. The populated PostgreSQL exercise additionally proves
real orphan reclaim, lease renewal, and rejection of the former owner's
terminal transition.

## Assumptions

- Production worker hosts are Linux/Unix and provide `setrlimit`, process groups,
  `/proc/loadavg`, and `/proc/meminfo`; missing pressure files fail open while
  subprocess hard limits still apply.
- Native Poppler and Tesseract executables are installed and version-managed by
  deployment.
- One child process per parser stage is sufficient; descendants join the child
  process group and are killed together.

## Risk tier

Medium. Ownership checks and native resource enforcement are deterministic and
the live PostgreSQL reclaim path has been exercised against a genuine orphaned
job. Deployment-specific pressure behavior remains observable through worker
logs and health endpoints.

## Rollback

Revert the worker, dependency, documentation, and trace changes together. This
restores the former one-shot lease and unbounded native-process behavior.

## Status

Done. Implemented in commit `c5612c4`; the integrated `scripts/self-test`
passed, and the live orphan-reclaim/old-owner rejection exercise passed on
2026-07-12. The proof worker was stopped and its claimed job was safely returned
to `pending` after verification.
