# FA-09 Disclosure Atomicity

## Goal

Prevent nullable disclosure keys from creating semantic duplicates and make a
House document's normalized rows and published parse status one atomic write.

## Files changed

- `backend/crates/intel_backend/migrations/0041_disclosure_document_atomicity.sql`
- `backend/crates/intel_backend/src/repository/organizations.rs`
- `backend/crates/intel_backend/src/senate_efd.rs`
- `backend/crates/intel_backend/tests/migration_test.rs`
- `backend/crates/intel_worker/src/main.rs`
- `docs/agent/test-catalog.md`
- `docs/agent/traces/fa09-disclosure-atomicity.md`

## Commands run

| Command | Result |
|---|---|
| `cargo fmt --all -- --check` | Initially reported formatting-only changes in `migration_test.rs`; fixed with `cargo fmt --all`. |
| `cargo check -p intel_worker -p intel_backend` | Passed. |
| `cargo test -p intel_worker parsed_status_requires_the_layouts_primary_record_family` | Passed, 1 test. |
| `cargo test -p intel_backend --test migration_test --no-run` | Passed; database-backed migration tests compile. |
| `cargo clippy -p intel_worker -p intel_backend --all-targets --all-features -- -D warnings` | Passed. |
| `scripts/verify-migrations` with the documented local URL | Blocked by the local database role lacking `CREATEDB`; disposable databases were not created. |
| `migration_fresh_database` against disposable schema `fa09_migration_fresh` | Passed; schema was dropped afterward. |
| `migration_upgrade_from_prior_committed_schema` against disposable schema `fa09_migration_upgrade` | Passed; populated duplicate cleanup and retry assertions passed, then schema was dropped. |
| `cargo test -p intel_worker` | Passed, 21 tests. |
| `cargo test -p intel_backend --lib` | Passed, 80 tests; 2 provider-backed tests ignored by their existing declarations. |
| `git diff --check -- <FA-09 files>` | Passed. |

## Tests added

- The worker completion-policy unit test requires PTR layouts to contain
  complete PTR rows. Annual layouts require complete rows, filing and reporting
  metadata, and all A/C/D/E/G normalized sections; a lone row from one section
  cannot publish `parsed`.
- Fresh and upgrade migration fixtures populate null ticker/date transaction
  identities, verify legacy duplicates collapse, and verify retry remains one
  semantic row.

## Assumptions

- Empty and null ticker values represent the same missing identity within one
  document; a missing transaction date uses the same null-safe identity rule.
- For exact semantic duplicates, the row with the most populated monetary and
  provenance fields, then the newest transaction ID, is the safest survivor.
- Page-level recall and OCR confidence calibration remain the separate FA-24
  gold-corpus gate. FA-09 conservatively keeps annual documents partial until
  every normalized section and required metadata is present and every emitted
  row passes deterministic completeness checks.

## Risk tier

High. This migration removes duplicate rows and replaces the prior unique
constraint with an expression unique index.

## Rollback

Revert the migration and persistence changes before deployment. After migration
0041 has run, recreating rows removed as semantic duplicates requires restoring
them from a pre-migration database backup; rolling back the index alone cannot
recover deleted rows.

## Status

Done in commit `cdf9b75`, tag `fa09-disclosure-atomicity`. Fresh and upgrade
migrations were executed in isolated disposable schemas because the local role
cannot create disposable databases; both schemas were removed after the passing
tests. The integrated `scripts/self-test` and isolated 18-flow live API suite
also passed.
