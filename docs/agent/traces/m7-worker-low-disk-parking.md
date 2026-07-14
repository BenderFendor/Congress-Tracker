# M7 item 2 — worker parks disk-consuming jobs on low disk

Covers: intel_worker's response to low free space on the storage volume
during download/OCR job dispatch. Read this before touching
`run_downloads`/`run_parses`/`storage_dir` or the disk-space gate.

## Goal

The worker must never fail a download or parse job because the storage
volume is low on space. It must instead park the job (leave it
pending/rescheduled) and log one clear structured warning per check, not per
job. Non-disk job types (resolve, LDA/FEC/Senate refreshes, heartbeats) keep
running unaffected.

## Files changed

- `backend/crates/intel_worker/src/job_policy.rs` — pure, DB-free decision
  logic: `DiskSpaceDisposition` enum, `disk_space_disposition(free_bytes,
  min_free_gib)`, `min_free_gib_from_env(value)` (default
  `DEFAULT_MIN_FREE_GIB = 50`, reads `INTEL_WORKER_MIN_FREE_GIB`, rejects
  zero/negative/unparseable input by falling back to the default). Added two
  unit tests: threshold boundary math, and env-parsing edge cases.
- `backend/crates/intel_worker/src/main.rs`:
  - `statvfs_free_bytes(path: &Path) -> Result<u64, io::Error>` — real probe
    using `libc::statvfs` (already a dependency; no new crate added).
  - `disk_space_gate(storage_path, min_free_gib, probe)` — wraps a probe
    (injectable, so tests never touch a real filesystem) and fails open
    (`Proceed`) with a warning if the probe errors, since a stat failure is
    not evidence the volume is full.
  - `run_disk_gated(job_kind, storage_path, min_free_gib, probe,
    claim_and_run)` — the actual parking control flow. On `Parked`, logs one
    structured `warn!` (job_kind, storage_path, min_free_gib) and returns
    `Ok(())` **without invoking `claim_and_run`** — so the SQL claim query
    that flips jobs from `pending` to `running` never executes. On
    `Proceed`, awaits `claim_and_run`.
  - `run_downloads` and `run_parses` were split: each is now a thin gate
    wrapper (reads `WORKER_STORAGE_DIR`/default storage path and
    `INTEL_WORKER_MIN_FREE_GIB`, calls `run_disk_gated` with
    `statvfs_free_bytes`) around the original claim/dispatch bodies, renamed
    to `download_batch` and `parse_batch`. Nothing else in either body
    changed — same concurrency logic, same SQL, same retry-on-error path.
  - Added 5 tests in the existing `mod tests` block covering the gate
    directly and the parking control flow end to end (see below).

## Why gate here specifically

`run_downloads`/`run_parses` are the only two job dispatch paths in
`intel_worker` driven by the `ingest_jobs` claim-SQL that flips
`pending -> running`, for `job_type IN ('download_document',
'parse_document')`. `parse_document` always calls
`parsers::extract_text_with_ocr`, which falls back to `pdftoppm` PNG
rendering (OCR) for image-only PDFs — genuinely disk-consuming, matching the
task's "downloads, OCR/PDF processing" scope. Other scheduled work (FEC
bulk, Senate eFD, LDA, SEC crosswalk, profile-evidence refresh, resolve) runs
through separate advisory-locked subprocess invocations of the `ingest`
binary on their own tick — outside the `ingest_jobs` claim flow this task
targeted, and untouched by this change.

## Default threshold behavior

`INTEL_WORKER_MIN_FREE_GIB` (default `50`). Free space is measured via
`statvfs(2)` on `storage_dir()` (`f_bavail * f_frsize`, i.e. space available
to unprivileged writers). Below the floor: `run_downloads`/`run_parses`
return `Ok(())` immediately, no jobs claimed, one `warn!` logged per tick per
job kind (not per job). At or above the floor: claim/dispatch proceeds
exactly as before this change. On a `statvfs` error (rare — usually a
missing/unmounted path): fails open (proceeds) with a `warn!`, since an
unreadable stat is not proof the disk is full and permanently parking on a
transient stat error would be its own outage.

## Commands run

```
cargo test -p intel_worker      # 38 passed; 0 failed
cargo fmt --check -p intel_worker   # clean (after `cargo fmt -p intel_worker`)
cargo clippy -p intel_worker --tests -- -D warnings   # clean
```

Ran from `backend/`. No cargo-lock contention hit; other agents' locks
cleared between attempts.

## Tests added

In `job_policy.rs`:
- `low_disk_parks_jobs_at_the_configured_gib_floor` — boundary math at
  exactly the floor, one GiB under, one GiB over, and the `(0, 0)` edge case.
- `disk_floor_env_parsing_defaults_and_rejects_nonsense` — `None`, empty
  string, non-numeric, `0`, negative, valid, and whitespace-padded input.

In `main.rs`:
- `disk_gate_parks_below_the_floor_and_proceeds_above_it` — `disk_space_gate`
  with injected low/healthy probes.
- `disk_gate_fails_open_when_free_space_cannot_be_determined` — injected
  probe returns `io::Error`; asserts `Proceed`.
- `low_disk_parks_disk_consuming_jobs_without_claiming_or_failing_any` — the
  plan's proof test. Simulates 3 pending jobs as an `AtomicUsize`. Injects a
  probe reporting 1 GiB free against a 50 GiB floor. The `claim_and_run`
  closure (which would move pending jobs to "claimed" and, in this
  worst-case simulation, straight to "failed") is passed to `run_disk_gated`
  and asserted to have **never run**: `claimed == 0`, `failed == 0`,
  `pending == 3` after the call. This is the direct evidence that parking
  never fails a job.
- `healthy_disk_lets_disk_consuming_jobs_proceed` — same shape with a
  healthy probe; asserts the closure *does* run.

These are unit/`tokio::test` level, not integration tests against a live
Postgres — `intel_worker` has no existing DB test harness (verified: no
`tests/` directory, no `#[sqlx::test]` usage anywhere in the crate; all
prior coverage is pure-function unit tests inside `main.rs`/`job_policy.rs`).
The injectable-probe design was chosen specifically so the parking/no-fail
guarantee could be proven deterministically without a real volume or
database, per the task's own guidance ("make the probe a small trait/fn
pointer so the test can simulate low disk").

## Assumptions

- A `statvfs` failure fails open (proceeds) rather than parking. Not
  explicitly specified by the task; chosen because parking on every
  transient stat error (e.g. a momentarily unmounted network volume) risks a
  silent full outage of ingestion, which seems worse than occasionally
  racing a real low-disk condition for one tick (jobs stay retried every
  ~10s regardless).
- Both `download_document` and `parse_document` job types are gated
  identically. `parse_document` is not purely "cheap parsing" in this
  codebase — every parse attempt runs `pdftotext` and, for image-only PDFs,
  `pdftoppm` OCR rendering to a scratch directory, so it counts as
  disk-consuming per the task's own framing ("OCR/PDF processing").
- The gate checks `storage_dir()` only (the House Clerk PDF + FEC archive
  volume), per the task's explicit instruction to check "the storage
  volume." Senate eFD's `storage_dir()` (`intel_backend::senate_efd`)
  defaults to `./worker_storage/senate_efd` rather than the external `/mnt/Big
  storage` path unless `WORKER_STORAGE_DIR` is set explicitly — a
  pre-existing inconsistency, out of scope here since Senate eFD runs
  through a separate subprocess tick, not `run_downloads`/`run_parses`.

## Risk tier

Low. Pure-function core logic is fully unit tested; the runtime wiring is a
guard clause in front of two existing functions with no changes to their
internals, SQL, or retry/lease semantics.

## Rollback

Revert the two changed files
(`backend/crates/intel_worker/src/job_policy.rs`,
`backend/crates/intel_worker/src/main.rs`) to `HEAD`. No migrations, no
schema changes, no config defaults that persist outside process env.

## Status

Done.

---

## Drafted per-source disk budget table (for orchestrator review)

Not inserted into `docs/IMPLEMENTATION_PLAN.md` — per task scope, that edit
belongs to the orchestrator. Sizes below are measured read-only via `du` on
`/mnt/Big storage/congress-tracker/` on 2026-07-14; everything else is a
reasoned estimate flagged as such.

Volume context: `/dev/sdc2` (mounted at `/mnt/Big storage`) is 3.7T total,
**97% used, 146G available** at measurement time — comfortably above the
50 GiB default floor today, but with little headroom before a historical
backfill or a widened `FEC_CYCLES`/`DISCLOSURE_BACKFILL_START_YEAR` window
would trip it.

| Source | Current on disk (measured) | What's stored | Backfill exposure | Drafted budget |
|---|---|---|---|---|
| FEC bulk archives | 4.6G (`fec/raw`) + 0.4G (`fec/tmp` scratch) = 5.1G | Per-cycle ZIP archives (candidate master, committee linkage, contributions); default window is current cycle + 2 prior even cycles (`FEC_CYCLES`, `run_fec_bulk_refresh`) | FEC data exists back to 1980 (~23 cycles); operators can set `FEC_CYCLES` arbitrarily wide | **40 GiB** steady-state (default 3-cycle window with margin); **150 GiB** ceiling if an operator runs a full historical `FEC_CYCLES` backfill |
| House Clerk disclosure PDFs (PTR + annual/candidate/termination) | ~2.4G across `2018/`..`2026/` (measured; ~265M/year average, newest years still filling in) | One PDF per filing, stored at `<year>/<doc_id>/<sha256>.pdf`; PTR (P) and annual/other (A/O/N/T) share the same tree — `download_one` does not separate them on disk despite using different upstream URL paths | `DISCLOSURE_BACKFILL_START_YEAR` clamps to 2008 (18 years); per-year volume has been declining (2018: 337M -> 2024: 228M) as filings shift electronic, so this is not a linear multiply | **10 GiB** for the default 5-year rolling window (`DISCLOSURE_START_YEAR`); **20 GiB** ceiling for a full 2008-present backfill |
| Senate eFD PTR PDFs | 0 (not present under `worker_storage/`; refresh is disabled by default — gated on `SENATE_EFD_ACCEPT_TERMS=1`) | Would land under `intel_backend::senate_efd::storage_dir()`, which currently defaults to `./worker_storage/senate_efd` (relative), not the `/mnt/Big storage` path, unless `WORKER_STORAGE_DIR` is set | Unmeasured — Senate PTR disclosures date to ~2012; filing volume is smaller than House (100 senators vs 435 reps) | **5 GiB** estimate once enabled, scaled down from the House PDF budget by senator:representative ratio; needs a real measurement once `SENATE_EFD_ACCEPT_TERMS` is turned on in an environment |
| LDA (lobbying) filings | 0 | `cmd_lobbying_filings` (`intel_backend/src/bin/ingest.rs`) fetches paginated JSON from the LDA API and writes rows directly to Postgres via `repo` — confirmed no local file/PDF write in that path | None — this source has no PDF/file footprint by design | **0 GiB** (DB-only; excluded from the disk gate's storage-volume budget) |
| Congress.gov (amendments, bill links, Voteview, etc.) | 0 | Same pattern as LDA: API JSON ingested straight to Postgres (`cmd_congress_amendments` etc.); no evidence of local file writes in `ingest.rs` for these commands | None | **0 GiB** (DB-only) |
| Other / scratch (temp unzip files, OCR page renders) | Included above in `fec/tmp` (0.4G); House Clerk discovery ZIPs and OCR PNG pages use `std::env::temp_dir()` (typically `/tmp`, a **different filesystem** from `storage_dir()`) and are cleaned up via `CleanupDir`/`remove_file` after each run | Transient only | N/A | Not counted against the storage-volume budget since it lives on `/tmp`; flagging that a `/tmp`-full condition is a distinct failure mode this task does not cover |

**Recommended total budget for `storage_dir()`:** ~55 GiB steady-state
(40 FEC + 10 House Clerk + 5 Senate headroom), ~170 GiB ceiling under a full
historical backfill of all PDF-bearing sources. At 146G currently available
on the volume, a full backfill would need either raising `INTEL_WORKER_MIN_FREE_GIB`'s
counterpart (freeing disk) or accepting that the new low-disk gate will park
jobs mid-backfill exactly as designed — which is the desired behavior, not a
bug.
