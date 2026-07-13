# M3 Senate Fixture Verification

Purpose: record deterministic, terms-safe verification of the Senate eFD discovery and report parsers.
Scope: parser contracts and fixtures only; this worksheet does not claim live Senate ingestion completion.

## Goal

Strengthen M3 Senate eFD verification without accepting the Senate eFD terms or
making live Senate requests. Prove strict operator-consent interpretation,
distinct empty/disabled/loaded coverage states, paginated discovery parsing and
deduplication, supported PTR and annual HTML and extracted-text adapters, and
explicit malformed-input failures.

## Files changed

- `backend/crates/intel_backend/src/senate_efd.rs`
- `backend/crates/intel_backend/tests/fixtures/senate_efd/discovery_page_1.json`
- `backend/crates/intel_backend/tests/fixtures/senate_efd/discovery_page_2.json`
- `backend/crates/intel_backend/tests/fixtures/senate_efd/ptr_report.html`
- `backend/crates/intel_backend/tests/fixtures/senate_efd/annual_report.html`
- `backend/crates/intel_backend/tests/fixtures/senate_efd/ptr_report.txt`
- `backend/crates/intel_backend/tests/fixtures/senate_efd/annual_report.txt`
- `docs/agent/traces/m3-senate-fixture-verification.md`

## Commands run

- `cd backend && cargo fmt --check`
  - Result: passed.
- `cd backend && cargo test -p intel_backend senate_efd::tests -- --nocapture`
  - Result: passed, 8 tests passed and 0 failed.
- `cd backend && cargo clippy -p intel_backend --all-targets --all-features -- -D warnings`
  - Result: passed with no warnings.
- `git diff --check -- backend/crates/intel_backend/src/senate_efd.rs backend/crates/intel_backend/tests/fixtures/senate_efd`
  - Result: passed.

An intermediate fixture run failed because the discovery parser assigned the
first row's submitted date to every link in the outer DataTables array. The
parser now applies dates only to arrays that directly contain a report link;
the final targeted test and Clippy runs passed after that correction.

## Tests added

- Strict terms acceptance accepts only the exact value `1`; unset and other
  values remain unaccepted.
- Coverage classification distinguishes `disabled_terms_not_accepted`,
  `empty`, and `loaded`.
- Two fixture pages parse deterministically, preserve row-specific submitted
  dates, and deduplicate a report repeated across pages.
- Discovery payloads fail explicitly when the response is not an object, lacks
  the `data` array, has an invalid record count, or contains rows without a
  recognizable report link.
- PTR HTML parses owner, asset, ticker, transaction type, date, and range.
- Annual HTML parses assets, liabilities, income, gifts, and positions.
- Terms-page, table-free, and unsupported HTML fail explicitly.
- Extracted PTR text parses a transaction and extracted annual text parses an
  asset and liability.
- Empty and unrecognized extracted text fail explicitly.

## Assumptions

- The checked parser helpers will be adopted by the ingestion command so
  malformed upstream content becomes a terminal parse failure rather than an
  apparently valid empty result.
- The financial disclosure route will adopt the shared strict consent and
  coverage helpers rather than maintaining duplicated classification logic.
- The sanitized fixtures represent the DataTables nesting and supported report
  layouts closely enough to test parser behavior, but are not substitutes for
  an operator-authorized live response capture.
- Reusing the House extracted-text adapters for Senate PDFs is valid only for
  layouts matching the tested section markers and row formats; other official
  layouts must fail visibly and be added as fixtures before support is claimed.

## Remaining gaps

- No live Senate query was made and `SENATE_EFD_ACCEPT_TERMS` was not set.
- The ingestion command still needs to call the checked discovery and report
  parsers and persist their explicit failures.
- The API route still needs to use the shared consent and coverage-state helper.
- Database-backed persistence, idempotent rerun, document-version, retry, and
  interruption recovery tests remain required.
- Live pagination, immutable raw-response capture, member identity resolution,
  shared member financial API output, and browser verification remain
  consent-gated or integration-level M3 exit criteria.
- This bounded task has not been committed or tagged. The milestone commit and
  matching tag must wait until all M3 exit criteria are proved.

## Risk tier

Medium. The fixture-tested helpers are deterministic, but upstream HTML/PDF
layout drift and the untested persistence path can still cause partial coverage.

## Rollback

Remove the new fixture files and revert the Senate helper/test additions in
`backend/crates/intel_backend/src/senate_efd.rs`. No database or external state
was changed by this task.

## Status

Done for the bounded fixture-verification scope. M3 remains incomplete until
the integration and consent-gated live evidence listed above are satisfied.

