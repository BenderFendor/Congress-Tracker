# Test Catalog

This catalog states what each repository test file proves and what it does not
prove. Update it whenever tests or verification commands change. Passing tests
do not replace live source, runtime, or browser evidence.

## Election Filing and Receipt Query Semantics

- `frontend/scripts/election-filing-semantics.test.mjs` prevents FEC candidate
  filing counts from being exposed as race ratings, party lean, or
  competitiveness and requires explicit handling for common FEC party codes.
  It does not prove certified election-result ingestion or county totals.
- `frontend/scripts/fec-receipts.test.mjs` verifies canonical receipt query
  serialization, absent-versus-zero numeric bounds, page-size limits, and
  candidate receipt-link parameters. It does not prove provider completeness.

## Legislator Member-Vote Contract

- `backend/crates/intel_backend/src/repository/votes.rs` fixture tests verify
  strict-majority tie exclusion, historical party-switch comparisons, and
  amendment, nomination, procedure, and bill measure classification.
- `backend/crates/intel_backend/tests/full_api_contract_test.rs` verifies that
  populated vote rows expose measure kind/label plus source description and
  result, and that summaries expose the party-alignment denominator and
  first/last coverage dates. It does not assert a fixed percentage because
  live roll-call coverage changes.

## Bill Detail Finance Contract

- `backend/crates/intel_backend/src/repository/bills.rs` fixture tests verify
  Congress-to-FEC-cycle mapping, explicit missing-crosswalk quality, and the
  absence of a combined finance amount in the network serialization contract.
- Live alternate-port probes cover a populated 23-sponsor bill, a bill with
  source-backed independent spending, and H.R. 6489's direct LDA citation.
  They do not fabricate a missing-crosswalk database row; that branch remains a
  deterministic unit fixture.

## `frontend/scripts/influence-financials.test.mjs`

- Verifies that direct contributions, independent support, and independent
  opposition remain separate when transformed for graph display.
- Verifies API total reconciliation and the explicit mismatch state.
- Verifies recipient coverage uses loaded member records without fabricating
  channel allocations, nodes, or amounts.
- Verifies invalid and negative monetary inputs cannot enter the graph.

## `frontend/scripts/influence-alias-parity.test.mjs`

- Verifies alias-only AIPAC discovery without changing canonical FEC committee
  ID or name fields.
- Proves AIPAC and NRA use the same slug-derived dossier route contract.
- Avoids asserting that an alias itself establishes a financial relationship.

## Canonical Verification

| Command | Coverage | Exclusions |
|---|---|---|
| `scripts/self-test` | Backend format, clippy, check, deterministic Rust library/binary tests, integration-test compilation, deterministic frontend tests, TypeScript, ESLint, Oxlint, and production build | Database-backed integration execution, populated APIs, external-source freshness, and browser interaction |
| `cd frontend && pnpm verify` | Deterministic frontend tests, type safety, both lint gates, and production build | Backend tests, populated APIs, and browser interaction |
| `cd frontend && DATABASE_URL=... pnpm test:live-api` | Builds the current backend, starts it on an isolated port, and checks populated read-only API flows | Provider completeness, ingestion mutation, and browser interaction |
| `scripts/verify-rendered-critical-pages` | Isolated Next server rendering for search guidance, member/portfolio/lobbying/influence/bills/organization loading, and FEC/net-worth request failures across ten critical routes | Hydrated interactions, loaded backend data, screenshots, and visual layout |
| `scripts/verify-migrations` | Empty-database migration, upgrade from the last committed schema at `0016`, SQLx ledger completeness, checksum validation, and idempotent reruns | Upgrade from arbitrary production snapshots and ingest idempotency |

## Backend Test Files

| Test file | Coverage | Exclusions |
|---|---|---|
| `backend/crates/backend_server/tests/api_test.rs` [deprecated] | Legacy server environment and Congress API integration boundary | Canonical `intel_backend` page contracts |
| `backend/crates/backend_server/tests/e2e_test.rs` [deprecated] | Legacy-to-canonical server compatibility startup | Full browser flows and live source coverage |
| `backend/crates/capitoltrades_api/src/lib_test.rs` | CapitolTrades adapter parsing helpers | Canonical disclosure ingestion |
| `backend/crates/capitoltrades_api/tests/schema_test.rs` | CapitolTrades schema deserialization | Live upstream responses and canonical persistence |
| `backend/crates/intel_backend/tests/fec_bulk_pipeline_test.rs` | Amendment precedence, ranking partitions, and public donor classification | Multi-million-row live cycle completion |
| `backend/crates/intel_backend/tests/influence_financials_test.rs` | Per-committee direct/support/opposition reconciliation and the direct-only recipient total against migrated PostgreSQL fixtures | Provider completeness and browser graph rendering |
| `backend/crates/intel_backend/tests/full_api_contract_test.rs` | Canonical endpoint status and JSON contracts when the database is available; bounded Member-keyed stock transaction metadata, anomaly counts, and unknown-Member 404; normalized bill amendments; explicit LDA bill-link separation; campaign-finance visualization parity with canonical cycle summaries | Provider completeness and browser rendering |
| `backend/crates/intel_backend/tests/ingestion_pipeline_test.rs` | Idempotency, source-run tracking, members, FEC candidates, view refresh, and chronology guards | Full public-source backfills |
| `backend/crates/intel_backend/tests/legislator_tabs_test.rs` | Member profile, votes, legislation, funding, disclosures, and relationship routes | Browser interaction and source freshness |
| `backend/crates/intel_backend/tests/migration_test.rs` | Fresh and `0016`-baseline PostgreSQL migration paths, migration ledger state, idempotent reruns, LDA activity duplicate cleanup, complete source-level activity identity, and activity-scoped lobbyist associations | Production data-volume migration timing and arbitrary historical snapshots |
| `backend/crates/openfec_api/src/query.rs` | Candidate query cycle, provider-bounded page size, and page-number serialization | Live provider limits and multi-page persistence |

Rust modules also contain focused unit tests for parsing, normalization,
classification, provenance, entity resolution, Senate discovery helpers,
financial ranges, and worker index handling. These tests prove deterministic
functions, not live provider behavior.

Five `civiq_client` tests call `civdotiq.org` and are excluded from default/CI
execution. `test_query_builder` runs deterministically, while
`cargo test --workspace --tests --no-run` still compiles the full crate target.

`senate_efd.rs` covers paginated discovery/deduplication, a deterministic
1,205-row multi-page contract, rejection of missing totals and truncated pages,
rejection of mixed valid/malformed provider rows and cross-page duplicate
identities, full-year/current-to-date terminal windows, PTR and annual HTML/text
normalization, checked parser failures, exact operator-consent semantics, and
distinct missing-consent, missing-filing, ambiguous-identity, parser-failure,
and loaded coverage states. These tests make no Senate requests. The operator
has accepted the site terms; live acquisition and measured 2012-present coverage
remain separate proof.

`intel_worker/src/main.rs` also runs an asynchronous process-group timeout test.
It starts a descendant that would write a marker after the parent timeout and
proves the bounded helper kills and reaps the group before returning.

`intel_worker/src/job_policy.rs` verifies interrupted-job retry exhaustion,
bounded retry delays, parser-failure cooldowns, 429/503 classification, exact
Senate consent gating, bounded/deduplicated LDA refresh scope, and immutable
page-size continuation identity. The ingest binary tests preserve prior-page
  progress on failure and distinguish activity lobbyist roles while ignoring name
corrections for the same stable lobbyist ID. They apply the same stable-ID rule
to government entities. Worker tests require missing and unexpected correlated
source-run outcomes to enter retry classification. `routes/home.rs` verifies fresh, stale, failed,
missing, and missing-key source-run classification. These are deterministic
policy tests; they do not simulate a killed process or a live provider.

The fresh-database migration test also inserts the same active worker delivery
twice with `ON CONFLICT DO NOTHING` and requires exactly one queued job. Fresh
and upgrade paths populate disclosure transactions with null ticker and date
keys, then require cleanup and retry to leave one semantic row. This proves the
database uniqueness contracts. They also require repeated equivalent LDA
activities to leave one semantic row. These tests do not simulate a killed
worker rollback.

`repository/relationships.rs` rejects heuristic, low-confidence, non-direct,
or non-LDA relationship rows from the explicit bill-citation channel in both
SQL and a defense-in-depth predicate test.

`routes/visualizations.rs` verifies that the top-20 sector presentation limit
cannot define the all-row headline total and that coverage distinguishes a
canonical import with no rows, partial rows without a completed import, and a
channel that was never loaded. Its performance-contract test also prevents the
interactive aggregate queries from regressing to canonical fact-table scans.
It does not prove live FEC cycle completeness.

`annual_disclosures.rs` specifically covers House asset, liability, income,
gift, and position layouts; wrapped and unbounded ranges; separation of asset
value from adjacent income; and conservative net-worth cross-bounds. The
`intel_worker` persistence path writes each family to its normalized table with
document-version lineage and reports recognized zero-row layouts as `partial`
rather than successful factual zeroes. These unit tests do not prove scanned
OCR accuracy or terminal completion of the live House backlog.

`intel_worker/src/parsers.rs` additionally verifies that malformed annual text
produces no fabricated normalized rows and that a missing scanned source returns
an OCR error. It covers scanned-layout fingerprinting and OCR failure propagation,
not successful Tesseract accuracy on a representative image-only filing. Its
resource tests execute native child processes and prove process-group timeout
kills, output-cap rejection, and interactive CPU/memory deferral thresholds.

`intel_worker/src/main.rs` verifies that PTR and annual layouts cannot publish
`parsed` without complete rows from their primary record family. Annual success
also requires the normalized A, C, D, E, and G sections plus filing and reporting
period metadata, so a lone row from one section remains partial. It also verifies the supported-form recovery SQL is limited
to `A`, `O`, `N`, `T`, and `P`, uses `NOT EXISTS` plus conflict-safe inserts,
keys parse recovery by immutable document version, and gives current-year jobs
lower numeric priority than historical backlog. It also rejects zero-row and
multi-row terminal transitions so only the current lease owner can complete or
retry a job. Live lifecycle proof is still
required because these structural unit tests do not execute PostgreSQL inserts.

`congress_api/src/pagination.rs` verifies stable advertised counts, exact next
offsets, bounded pages and 50,000-row totals, premature termination, run-wide
duplicate bill and official-URL identities, variable page limits, and nullable
amendment rows that remain available for row-level validation. Client tests
cover retrying truncated response bodies, typed key-safe authentication errors,
and no adaptive fallback for permanent failures. `intel_backend/src/bin/ingest.rs`
verifies official amendment URL classification, rejection of identity-less
rows, profile-derived 1-4 stream concurrency, resumable source-run validation,
and preservation of loaded roles. Repository coverage tests require two
reconciled terminal roles per current Member. Fresh and prior-schema migration
tests reject unexplained count differences, accept explicitly counted provider
duplicates, and prove repeated generic evidence upserts remain one row.

## Frontend Test Files

| Test file | Coverage | Exclusions |
|---|---|---|
| `frontend/scripts/data-quality.test.mjs` | Filing interval and source-anomaly classification | Rendered disclosure pages |
| `frontend/scripts/fec-receipts.test.mjs` | Bounded receipt query serialization and page-size clamping | Live FEC endpoint latency and browser filters |
| `frontend/scripts/financial-ui.test.mjs` | Candidate and committee source-identifier filtering, snapshot filter behavior, and explicit unbounded net-worth labels | Live API completeness and rendered filter interactions |
| `frontend/scripts/funding-coverage.test.mjs` | Totals-only, complete ranking, missing, and failed funding states | Rendered member funding interactions |
| `frontend/scripts/fec-lda-separation.test.mjs` | FEC/LDA structural separation contract: campaign finance and lobbying amounts never combined | Live data integration |
| `frontend/scripts/networth-range.test.mjs` | Conservative net worth range validation: null maxima, missing residence, cross-bounds | Live snapshot computation |
| `frontend/scripts/navigation-registry.test.mjs` | M1 through M5 destination coverage, shared registry use, and command-palette modal/combobox structure | Rendered menu layout and browser focus behavior |
| `frontend/scripts/member-dossier-isolation.test.mjs` | Superseded and mismatched Member responses cannot commit, route changes clear every dossier section, one abort signal reaches every dossier request, stock disclosures use fixed-size replacement pages with honest coverage/conflict states, accessible keyboard tabs, later-page responses cannot cross Member identity, and legislation renders independent sponsor/cosponsor pages with truthful coverage, zero ranges, busy states, and official source links | Browser navigation timing and backend response latency |
| `frontend/scripts/truth-states.test.mjs` | Genuine zero versus failed-count presentation, independent loading/error/unavailable/empty/partial/loaded request classification with precedence rules, empty influence-network affiliation coverage, and source-supplied cycle metadata | Rendered failure states and live request behavior |
| `frontend/scripts/detail-request-state.test.mjs` | Detail response classification keeps confirmed 404 absence separate from server and transport failures | Rendered retry interaction and live backend responses |
| `frontend/scripts/verification-topology.test.mjs` | The default `*.test.mjs` suite excludes populated live flows and the live command can only enter through the isolated-backend wrapper | Whether the populated database satisfies live API assertions |
| `frontend/scripts/e2e-api-flows.live.mjs` | Explicit populated API flows for health, funding, receipts and disbursements, search, member disclosures, bills and bill evidence, LDA entity histories, financial records, organizations, influence identities/channels, and current Senate coverage states | Default deterministic tests, provider completeness, ingestion mutation, and browser interaction |
| `frontend/scripts/county-geography.test.mjs` | Supported FIPS validation, FIPS-to-postal candidate filtering, private Census query construction, geometry/name normalization, checked-in prepared-file coverage and provenance for all 56 jurisdictions, file-size and cross-state rejection, public API no-network/no-write structure, and non-empty county SVG projection paths | Live Census acquisition and county election results |

## Required Manual Proof

- Run the integrated backend, frontend, and worker stack.
- Check source-run and worker coverage against the local database.
- Exercise critical APIs with real normalized rows.
- Use Chrome MCP for desktop and 390px mobile navigation, screenshots, console checks, request failures, and horizontal overflow.
# Member Identity Helper

- `frontend/scripts/member-identity.test.mjs` verifies that Congress API JSON
  endpoints cannot be treated as portraits, valid supplied images precede the
  official Bioguide JPG, identifiers normalize deterministically, and initials
  remain a final display fallback. It does not issue network requests or test
  browser image decoding.
