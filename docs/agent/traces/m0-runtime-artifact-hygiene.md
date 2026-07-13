# M0 Runtime Artifact Hygiene Worksheet

**Goal:** Keep generated worker, compiler, and package-manager files out of focused product commits while preserving the required papercut ledger.

**Files changed:**
- `.gitignore`
- `papercuts.md`
- `docs/Log.md`
- `docs/agent/traces/m0-runtime-artifact-hygiene.md`

**Commands run:**
- `git check-ignore` on worker storage, Rust ICE reports, npm lockfile, and papercut ledger before editing.
- `git status --short` after editing - generated worker storage, ICE reports, and npm lockfile no longer appear; `papercuts.md` remains trackable.
- `git diff --check` - passed.

**Tests added:** None. This is repository artifact policy and friction-log maintenance.

**Assumptions:** pnpm remains the only supported frontend package manager. Worker documents and Rust ICE reports are local runtime or diagnostic artifacts, not source files.

**Risk tier:** low

**Rollback:** Revert the focused commit. Ignored local files remain on disk and are not deleted.

**Status:** done
