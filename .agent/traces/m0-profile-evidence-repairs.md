# M0 Profile Evidence Runtime Repairs Worksheet

**Goal:** Repair the OpenFEC candidate and relationship-derivation failures observed in the live profile-evidence subprocess.

**Files changed:**
- `backend/crates/openfec_api/src/query.rs`
- `backend/crates/intel_backend/src/bin/ingest.rs`
- `backend/crates/intel_backend/src/repository/organizations.rs`
- `docs/Log.md`
- `docs/agent/test-catalog.md`
- `reports/verification/M0-BASELINE.md`
- `.agent/traces/m0-profile-evidence-repairs.md`

**Commands run:**
- Live duplicate-key SQL - confirmed repeated `(name, derived_type)` rows in `fec_committees`.
- `cargo fmt --check` - passed.
- `cargo clippy -p openfec_api -p intel_backend --bin ingest --all-features -- -D warnings` - passed.
- `cargo test -p openfec_api` - passed.
- `cargo run -p intel_backend --bin ingest -- fec-candidates --cycle 2026 --limit 101` - passed, 101 seen and 199 writes including queued resolutions.
- `cargo run -p intel_backend --bin ingest -- refresh-relationships` - passed, 60,147 seen and 132,232 writes.

**Tests added:** Candidate query URL regression test proving `cycle`, provider-bounded `per_page`, and `page` are serialized together. Live commands prove pagination across page 1 and page 2 and the database conflict repair.

**Assumptions:** OpenFEC continues to enforce a maximum `per_page` of 100. Organization identity remains keyed by canonical name plus derived organization type until a stronger source-backed identity model replaces it.

**Risk tier:** medium

**Rollback:** Revert the focused commit. This would restore the observed OpenFEC 422 and duplicate-conflict failures.

**Status:** done
