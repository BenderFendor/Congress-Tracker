# Test Catalog

This catalog states what each repository test file proves and what it does not
prove. Update it whenever tests or verification commands change. Passing tests
do not replace live source, runtime, or browser evidence.

## Canonical Verification

| Command | Coverage | Exclusions |
|---|---|---|
| `scripts/self-test` | Backend format, clippy, check, all Rust tests, frontend helper tests, TypeScript, ESLint, Oxlint, and production build | Live external-source freshness and browser interaction |
| `cd frontend && pnpm verify` | Frontend helper tests, type safety, both lint gates, and production build | Backend tests, live APIs, and browser interaction |

## Backend Test Files

| Test file | Coverage | Exclusions |
|---|---|---|
| `backend/crates/backend_server/tests/api_test.rs` | Legacy server environment and Congress API integration boundary | Canonical `intel_backend` page contracts |
| `backend/crates/backend_server/tests/e2e_test.rs` | Legacy-to-canonical server compatibility startup | Full browser flows and live source coverage |
| `backend/crates/capitoltrades_api/src/lib_test.rs` | CapitolTrades adapter parsing helpers | Canonical disclosure ingestion |
| `backend/crates/capitoltrades_api/tests/schema_test.rs` | CapitolTrades schema deserialization | Live upstream responses and canonical persistence |
| `backend/crates/intel_backend/tests/fec_bulk_pipeline_test.rs` | Amendment precedence, ranking partitions, and public donor classification | Multi-million-row live cycle completion |
| `backend/crates/intel_backend/tests/full_api_contract_test.rs` | Canonical endpoint status and JSON contracts when the database is available | Data completeness and browser rendering |
| `backend/crates/intel_backend/tests/ingestion_pipeline_test.rs` | Idempotency, source-run tracking, members, FEC candidates, view refresh, and chronology guards | Full public-source backfills |
| `backend/crates/intel_backend/tests/legislator_tabs_test.rs` | Member profile, votes, legislation, funding, disclosures, and relationship routes | Browser interaction and source freshness |

Rust modules also contain focused unit tests for parsing, normalization,
classification, provenance, entity resolution, Senate discovery helpers,
financial ranges, and worker index handling. These tests prove deterministic
functions, not live provider behavior.

## Frontend Test Files

| Test file | Coverage | Exclusions |
|---|---|---|
| `frontend/scripts/data-quality.test.mjs` | Filing interval and source-anomaly classification | Rendered disclosure pages |
| `frontend/scripts/fec-receipts.test.mjs` | Bounded receipt query serialization and page-size clamping | Live FEC endpoint latency and browser filters |
| `frontend/scripts/funding-coverage.test.mjs` | Totals-only, complete ranking, missing, and failed funding states | Rendered member funding interactions |

## Required Manual Proof

- Run the integrated backend, frontend, and worker stack.
- Check source-run and worker coverage against the local database.
- Exercise critical APIs with real normalized rows.
- Use Chrome MCP for desktop and 390px mobile navigation, screenshots, console checks, request failures, and horizontal overflow.
