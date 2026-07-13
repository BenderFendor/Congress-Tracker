# M0 Worker Heartbeat Worksheet

**Goal:** Keep worker health current while slow download, OCR, or parse batches are running.

**Files changed:**
- `backend/crates/intel_worker/src/main.rs`
- `docs/Log.md`
- `reports/verification/M0-BASELINE.md`
- `reports/verification/M0-WORKTREE-INVENTORY.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/agent/traces/m0-worker-heartbeat.md`

**Commands run:**
- Worker process, heartbeat, and running-job SQL audit - confirmed a live process could exceed the five-minute health cutoff during a current parse batch.
- `cargo fmt --check` - passed.
- `cargo clippy -p intel_worker --all-targets --all-features` - passed.
- `cargo test -p intel_worker` - 10 passed.
- `cargo run -p intel_worker --bin intel_worker -- --backfill` - started patched worker instance `e40f7566-3c26-4d63-b93c-46aa67017406` against the live queue.
- Heartbeat SQL samples during a 65.761-second parse batch - heartbeat ages were 3, 28, and 20 seconds, proving the independent task updated while the main loop awaited parsing.
- Controlled worker shutdown and job reconciliation - returned its two claimed parse jobs to `pending` with an explicit reason.

**Tests added:** No new unit test. The change isolates an existing database heartbeat in its own Tokio task; targeted compile/lint/tests and live interval sampling provide the required proof.

**Assumptions:** A dedicated heartbeat task sharing the SQLx pool remains schedulable while blocking parser work stays in `spawn_blocking`. The live proof used a second backfill worker so the original stack did not need to restart.

**Risk tier:** medium

**Rollback:** Revert the focused commit to return heartbeat writes to the main worker select loop.

**Status:** done
