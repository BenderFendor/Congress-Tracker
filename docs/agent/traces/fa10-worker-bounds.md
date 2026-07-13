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
- `git diff --check`: passed.

## Tests added

- A real sleeping native child and its process group are killed at the wall
  deadline.
- Native output above the byte limit is rejected rather than silently accepted.
- Render page file caps multiply to no more than the total scratch budget.
- Interactive pressure thresholds reserve CPU and memory headroom before OCR.
- Terminal job transitions reject missing or ambiguous ownership.

Existing `job_policy` tests continue to prove interrupted-job retry exhaustion
and bounded retry delays. A populated PostgreSQL multi-worker fault-injection
run remains release evidence rather than a deterministic unit test.

## Assumptions

- Production worker hosts are Linux/Unix and provide `setrlimit`, process groups,
  `/proc/loadavg`, and `/proc/meminfo`; missing pressure files fail open while
  subprocess hard limits still apply.
- Native Poppler and Tesseract executables are installed and version-managed by
  deployment.
- One child process per parser stage is sufficient; descendants join the child
  process group and are killed together.

## Risk tier

Medium. Ownership checks and native resource enforcement are deterministic, but
a live two-worker PostgreSQL kill/reclaim exercise is still required for full
operational proof.

## Rollback

Revert the worker, dependency, documentation, and trace changes together. This
restores the former one-shot lease and unbounded native-process behavior.

## Status

Implemented in commit `c5612c4`. The integrated `scripts/self-test` passed.
Live multi-worker fault injection remains a release-level proof item, so FA-10
and its final tag remain open.
