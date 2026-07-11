# CongressTracker Living Master Implementation Plan

This document is the execution roadmap for CongressTracker. It records the
verified baseline, the work still in progress, dependency order, public
contracts, and the proof required to finish each milestone. Refresh the dated
baseline before relying on its counts.

**Last repository audit:** 2026-07-11

## How To Use This Plan

Every item has one of four states:

- **Verified:** Code, live data, and the required checks have passed.
- **Implemented but not proved:** Code exists, but runtime coverage or the full verification gate is incomplete.
- **Not implemented:** The required production path does not exist.
- **Deferred:** The work is excluded from the active delivery path until its promotion criteria are met.

A milestone is complete only when its implementation, data coverage, tests,
runtime checks, browser checks, documentation, worksheet, focused commit, and
matching git tag are complete. Compiler success alone is not proof that a data
pipeline or user flow works.

## Product Rules

- `backend/crates/intel_backend` is the canonical Postgres-backed API.
- `backend/crates/backend_server` is compatibility code. New page contracts do not belong there.
- `intel_worker` owns scheduled public-source ingestion and recovery.
- `source_runs` is the freshness ledger. A build cannot replace a terminal source-run record.
- `bioguide_id` is the canonical member key.
- Public ingestion is deterministic, idempotent, advisory-locked, restartable, and bounded.
- Normal member-page completeness cannot depend on one-off operator commands.
- Missing, failed, stale, or partial coverage is never presented as a factual zero.
- No mock, fixture, fabricated, or CSV fallback data may appear as live evidence.
- Direct campaign receipts, committee transfers, refunds, memos, leadership-PAC data, and independent expenditures remain separate.
- Financial disclosure ranges remain ranges. An unbounded source value never receives an invented ceiling.
- Evidence tiers are `direct`, `derived`, and `contextual`. Inference is never presented as observation.
- User-facing language describes records and timing. It does not accuse people or organizations.

## Audited Baseline

The following is a dated snapshot, not a permanent invariant. Refresh it with
the commands in the verification section before starting a milestone.

### Verified

- The local database has migrations through `0028` applied successfully.
- `intel_backend` exposes the canonical member, bill, committee, funding, influence, trade, portfolio, lobbying, FEC, search, relationship, financial snapshot, and system routes.
- `intel_worker` runs House discovery, download, parse, resolution, heartbeat, profile evidence, scheduled FEC bulk refresh, optional Senate eFD discovery, and SEC asset crosswalk loops.
- House Clerk documents use a durable Postgres queue, immutable document versions, parse attempts, parse issues, and official source URLs.
- FEC bulk ingestion supports candidate, committee, candidate-committee linkage, individual receipt, committee transaction, leadership-PAC, and independent-expenditure sources.
- Canonical FEC classification tests keep memos, refunds, transfers, and outside spending out of direct-receipt totals.
- `/portfolio` uses official disclosure rows and explicit coverage states.
- AIPAC and other influence networks use verified FEC committee identifiers with separate direct and outside-spending totals.
- `scripts/self-test` passed on 2026-07-11 and now includes backend formatting, clippy, check, tests, frontend helper tests, TypeScript, ESLint, Oxlint, and the production build.

### Implemented But Not Proved

- Current uncommitted work adds restartable FEC staging, identity repair, supplemental sources, receipt browsing, Senate eFD discovery, annual disclosure parsing, OCR, financial snapshots, SEC asset resolution, and related frontend services and pages.
- Canonical FEC receipt rows exist for 2022 and 2026. The default three-cycle window is incomplete because 2024 is not loaded.
- The latest local FEC runs include `partial`, `running`, and `failed` states. Code presence does not establish complete rankings.
- The local disclosure database contains 635 financial snapshots, 53,185 asset rows, and 2,303 liability rows.
- The disclosure queue contains 19,607 pending jobs. This is an active backfill, not complete source coverage.
- House annual parsing persists assets and liabilities. Income, gifts, and positions are not yet part of the production parser result.
- OCR is wired through blocking work, but scanned-document accuracy and failure recovery need live proof.
- Senate eFD discovery is scheduled when terms are accepted, but the local `senate_disclosure_reports` table has no rows. Download, versioning, parsing, and normalization are not complete.
- `/api/fec/receipts`, `/api/financial-snapshots`, `/api/senate-disclosures`, `/fec/receipts`, and `/networth` exist in the current worktree but still require full runtime and browser proof.
- Bill actions and heuristic lobbying overlays already exist. Amendments and source-backed bill-to-lobbying links do not.
- Frontend helper tests exist, but they cover only a small part of the critical page state space.

### Resolved Verification Gate

The 2026-07-11 M0 frontend-gate work removed the Oxlint accessibility warnings
from the command palette and election visuals. `pnpm verify` and the updated
`scripts/self-test` now pass through the production build. Chrome MCP was not
running, so live desktop and mobile browser proof remains open.

## Delivery Order

The dependency order is:

```text
M0 -> M1 and M2 in parallel -> M3
M1 -> M4
M1 + M3 + M4 -> M5
M6 gates every milestone and the final release
```

## M0 - Stabilize And Prove The Current Worktree

**State:** In progress

**Goal:** Turn the current FEC and disclosure work into a clean, reproducible,
verified baseline before adding another product surface.

### Implementation

1. Inventory the existing dirty worktree by concern. Preserve all user work and stage only files owned by each workstream.
2. Keep runtime PDFs, FEC archives, Rust crash reports, and package-manager artifacts out of product commits. Do not delete diagnostic artifacts until their owner has confirmed they are no longer needed.
3. [x] Fix every current Oxlint accessibility warning with semantic elements and keyboard-safe interaction.
4. [x] Make `scripts/self-test` run the strongest frontend gate: helper tests, TypeScript, ESLint, Oxlint, and production build.
5. [x] Prove migrations `0001` through `0028` against a fresh database and an existing upgraded database.
6. Reconcile interrupted `source_runs`, retryable FEC batches, and stuck disclosure jobs. Partial work stays partial until it reaches a truthful terminal state.
7. Update `README.md`, `docs/BACKEND_REQUIREMENTS.md`, worker/disclosure docs, `docs/Log.md`, and `docs/agent/test-catalog.md` to match current behavior.
8. Record baseline SQL, API responses, and verification output under `reports/verification/`.

### Exit Criteria

- `scripts/self-test`, `pnpm verify`, and `git diff --check` pass.
- Fresh and upgrade migration checks pass without manual schema repair.
- No unexplained stale `running` source run or job remains.
- The verification report states which FEC cycles and disclosure sources are loaded, partial, or missing.
- Documentation no longer says that implemented FEC, OCR, annual-report, financial-snapshot, or Senate discovery code is absent.

## M1 - Complete Canonical Campaign Finance

**State:** Implemented but not proved

**Goal:** Provide complete, restartable, source-backed campaign-finance records
for the configured election cycles with honest coverage semantics.

### Implementation

1. Complete the default current-plus-two-prior-cycle refresh, including the missing 2024 cycle. Keep `FEC_CYCLES` as the explicit broader-backfill override.
2. Prove content-addressed downloads, resumable partial files, bounded streaming, restartable staging, canonicalization, amendment precedence, rankings, and staging cleanup.
3. Resolve candidate and committee identities from official master files. Keep ambiguous or missing links in `fec_linkage_issues` and report partial coverage.
4. Finalize leadership-PAC and independent-expenditure supplemental ingestion under the same source-run and retry rules.
5. Finalize `GET /api/fec/receipts` and `/fec/receipts` with stable pagination, filters, record classification, coverage metadata, source timestamps, warnings, and filing links.
6. Add canonical operating-disbursement ingestion, `GET /api/fec/disbursements`, and a matching browse page. Do not mix disbursements into receipt totals.
7. Populate member donor, committee, and influence-network rankings only from canonical cycle-complete records.
8. Keep `Totals only` and `Rankings unavailable` when a member has official totals but lacks complete canonical rankings.

### Data Integrity Rules

- Latest valid amendments supersede earlier versions without removing audit provenance.
- Memo records remain visible and non-totalable.
- Refunds and returns never become positive donor contributions.
- Committee transfers remain separate from individual receipts.
- Independent expenditures never enter direct campaign receipts.
- A missing candidate-committee link creates a coverage issue, not a fake entity.

### Exit Criteria

- Every configured cycle has terminal, attributable source runs for required bulk and supplemental files.
- Deterministic reruns produce no duplicate canonical records or ranking drift.
- 2022, 2024, and 2026 have measured canonical counts or an explicit source-backed failure state.
- Member funding, candidate, receipt, disbursement, and influence pages pass live API and browser verification.
- Representative unfiltered and filtered list queries complete within two seconds on the documented local dataset, or the verification report records and justifies a narrower measured exception.

## M2 - Complete The House Financial Disclosure Warehouse

**State:** Implemented but not proved

**Goal:** Finish House PTR and annual-statement ingestion with measured
coverage, range-safe calculations, and reviewable parser failures.

### Supported Forms

- `P`: periodic transaction reports.
- `A`, `O`, `N`, and `T`: annual, new-member, and termination-style financial reports handled by the annual parser family.
- Other Clerk filing codes remain indexed as unsupported coverage unless a parser contract is added. They must not repeatedly fail or appear as successful zero-row parses.

### Implementation

1. Drain the existing backlog with bounded download and parse concurrency while recording throughput, retries, and terminal failures.
2. Finish annual extraction for assets, liabilities, income, gifts, and positions.
3. Retain the raw source row, parser name, parser version, confidence, document version, official URL, and range text for every normalized record.
4. Keep `pdftotext`, page rendering, OCR, and parser CPU work off the async runtime.
5. Store OCR and layout failures as partial or failed parse attempts with UTF-8-safe diagnostics and manual-review records.
6. Resolve documents and filings to members before deriving member snapshots. Ambiguous identity stays unresolved.
7. Resolve public assets through official SEC/company identifiers. Do not infer identifiers from weak name similarity.
8. Build financial snapshots from reported asset and liability bounds with versioned calculation rules and component provenance.
9. Correct financial API provenance so it names only the sources that contributed to each row.

### Range Rules

- Preserve `NULL` maxima for unbounded categories.
- Calculate the conservative net-worth range from cross-bounds.
- Keep the personal-residence limitation visible.
- Do not calculate a snapshot when the required source components are absent.
- Do not interpret a missing annual filing as zero assets or liabilities.

### Exit Criteria

- Supported-form discovery, download, parse, identity, and snapshot counts are reported by source year and status.
- Pending and failed jobs are either completed or explained in the coverage report.
- Parser fixtures cover representative electronic, wrapped, scanned, malformed, and unsupported documents.
- `/api/financial-snapshots`, `/api/members/:id/disclosures`, `/api/stocks/transactions`, `/portfolio`, and `/networth` pass live verification.
- Desktop and 390px mobile checks have no application errors or horizontal overflow.

## M3 - Complete Senate eFD End To End

**State:** Not implemented beyond discovery staging

**Dependency:** M2

**Goal:** Normalize Senate PTR and annual reports into the same evidence model
used for House disclosures.

### Implementation

1. Keep operator consent explicit through `SENATE_EFD_ACCEPT_TERMS=1`. When consent is absent, expose a disabled coverage state instead of recording an ingestion failure.
2. Paginate the configured date range, preserve raw search responses and hashes, extract submitted dates, and deduplicate official report IDs.
3. Add Senate download jobs, immutable document versions, hashes, retry policy, and source-run attribution.
4. Add adapters for Senate PTRs, electronic annual reports, and scanned annual reports.
5. Normalize Senate records into the shared filing, transaction, asset, liability, income, gift, and position tables.
6. Resolve Senators through official identifiers before applying conservative name/state matching. Queue ambiguous matches for review.
7. Feed Senate rows into the existing member disclosure, trade, portfolio, financial snapshot, relationship, worker-health, and coverage contracts.
8. Keep `/api/senate-disclosures` as an audit and coverage listing rather than a separate product data model.

### Exit Criteria

- Live discovery proves pagination, raw-response preservation, and idempotency.
- Download and parse retries survive interruption without duplicate versions or rows.
- Current-Senator coverage is reported as parsed, partial, failed, or missing with an official source URL where available.
- Senate transactions and annual statements appear through the same member-facing contracts as House records.
- Missing consent, missing filings, ambiguous identity, and parser failure each have distinct tested states.

## M4 - Separate AIPAC Campaign Finance And Lobbying Evidence

**State:** FEC rail implemented; LDA organization rail incomplete

**Dependency:** M1

**Goal:** Make AIPAC and other influence networks researchable without
combining campaign-finance and lobbying claims.

### Evidence Contract

- Member-facing AIPAC amounts come only from verified FEC direct receipts and independent expenditures.
- AIPAC LDA records describe registrants, clients, issues, government entities, filing periods, and reported income or expenses.
- FEC and LDA amounts are never added together.
- Lobbying is never described as money given to a member unless an official source establishes that relationship.
- Explicit bill identifiers or source-backed issue relationships may be direct or derived evidence. Text similarity remains contextual and heuristic.

### Implementation

1. Keep AIPAC and other network committee membership tied to verified FEC identifiers, citations, and review dates.
2. Add canonical lobbying client, registrant, and lobbyist list/detail endpoints.
3. Add frontend routes for lobbying clients, registrants, and lobbyists with source-backed filing histories.
4. Support AIPAC aliases during search while retaining exact source identities in stored and displayed records.
5. Present AIPAC LDA filings on an organization or influence surface separate from member campaign-finance totals.
6. Replace unlabeled keyword correlations with typed evidence and visible confidence.
7. Apply the same general contracts to AIPAC and every other influence network. Do not create an AIPAC-only API.

### Exit Criteria

- Tests prove that FEC and LDA amounts cannot be combined accidentally.
- AIPAC and one non-AIPAC network pass the same API and page-flow tests.
- Every displayed relationship includes source, evidence tier, confidence, and source URL where available.
- Alias search returns official records without rewriting the source identity.

## M5 - Complete Legislative And Organization Evidence Flows

**State:** Partially implemented

**Dependencies:** M1, M3, and M4

**Goal:** Connect legislative, financial, disclosure, and lobbying evidence
through explicit contracts and provenance.

### Implementation

1. Preserve existing bill actions, sponsors, cosponsors, subjects, text versions, votes, funding overlays, and provenance.
2. Add amendment ingestion and normalized amendment records to the existing bill-intelligence response.
3. Add durable explicit LDA-to-bill and LDA-to-issue relationships. Keep heuristic matches in a separate contextual collection.
4. Build the organization detail frontend on the existing organization and relationship backend.
5. Support organization filtering across FEC, LDA, disclosures, committees, bills, and verified identifiers.
6. Add aggregation endpoints for charts only after their canonical row contracts are stable.
7. Enable `/visualizations` one chart at a time. Each chart requires coverage metadata, provenance, empty/error states, and a contract test.

### Exit Criteria

- Bill amendments and explicit lobbying links are normalized, source-backed, and tested.
- Heuristic lobbying suggestions cannot appear as direct evidence.
- Organization pages expose cross-source records without treating identifier overlap as relationship proof.
- No critical evidence page reads a legacy server route, static fixture, or archived CSV.
- Every enabled visualization matches its underlying API totals on the verified dataset.

## M6 - Verification, CI, And Operations

**State:** Partial

**Goal:** Make the strongest proof path routine and enforce it for every
milestone.

### Implementation

1. Add CI for backend format, clippy, check, tests, frontend tests, typecheck, ESLint, Oxlint, build, fresh migrations, and upgrade migrations.
2. Expand frontend tests for loading, error, empty, partial, and loaded states on every critical page.
3. Add end-to-end flows for search, member funding, FEC browsing, disclosures, net worth, lobbying, influence, bills, and organizations.
4. Test worker interruption, restart, duplicate delivery, rate limiting, parser failure, missing consent, missing keys, and stale source runs.
5. Capture real desktop and 390px mobile navigation with screenshots, console checks, request failures, and overflow measurements.
6. Maintain `docs/agent/test-catalog.md` with every test file, its claim, and its deliberate exclusions.
7. Require a worksheet under `.agent/traces/`, a focused commit, relevant documentation, and a matching tag for each milestone.

### Rollback Policy

- Prefer additive migrations and additive APIs.
- Roll back application behavior by reverting the milestone commit while leaving additive evidence schema dormant.
- Do not use destructive down migrations on ingested public records.
- Keep legacy compatibility code until a call-site and contract audit proves it can be removed safely.

## Public API And Type Changes

### Finalize Existing Worktree Contracts

- `GET /api/fec/receipts` returns `{ data, meta, provenance }` with bounded pagination and `loaded | partial | not_ingested` coverage.
- `GET /api/financial-snapshots` includes per-row source, official URL, reporting period, calculation version, methodology warnings, and source-specific coverage.
- `GET /api/senate-disclosures` remains a source audit endpoint. Normalized Senate evidence flows through shared member, trade, and financial endpoints.

### Additive Contracts

- `GET /api/fec/disbursements` with the same paging, coverage, and provenance envelope as receipts.
- `GET /api/lobbying/clients` and `GET /api/lobbying/clients/:id`.
- `GET /api/lobbying/registrants` and `GET /api/lobbying/registrants/:id`.
- `GET /api/lobbying/lobbyists` and `GET /api/lobbying/lobbyists/:id` when the normalized source contains a stable lobbyist identifier.
- Extend the existing bill-intelligence type with normalized amendments and evidence-tiered lobbying relationships.

Rust response structs, SQL nullability, TypeScript service types, and UI guards
must change together. Contract tests cover missing keys, nullable fields, empty
arrays, partial coverage, and error envelopes.

## Verification Matrix

### Static And Build

```bash
scripts/self-test
cd frontend && pnpm verify
git diff --check
```

### Database

- Fresh migration from an empty database.
- Upgrade migration from the prior committed schema.
- Idempotent migration and ingest rerun.
- Amendment precedence and uniqueness.
- FEC linkage-issue preservation.
- Disclosure range and null semantics.
- Source-run terminal-state and freshness checks.

### Required Data Cases

- FEC memo, refund, transfer, amendment, individual receipt, committee receipt, leadership PAC, independent expenditure, and operating disbursement.
- House electronic PTR, legacy PTR, electronic annual report, scanned annual report, malformed document, and unsupported filing type.
- Senate missing consent, paginated discovery, duplicate report, changed report version, unresolved member, parser failure, and valid PTR/annual report.
- Lobbying alias search, client/registrant separation, explicit bill link, heuristic issue match, and absent reported amount.
- Financial unbounded asset, unbounded liability, missing personal residence, incomplete filing, and conservative net-worth range.

### Live API Proof

At minimum, verify:

- `/api/health`
- `/api/system/worker-health`
- `/api/system/disclosure-coverage`
- `/api/sources/status`
- `/api/sources/coverage`
- `/api/fec/receipts`
- `/api/financial-snapshots`
- `/api/senate-disclosures`
- `/api/members/A000370/funding?cycle=2026`
- `/api/members/A000370/disclosures`
- `/api/influence/networks/aipac`
- `/api/search?q=Alma%20Adams`

### Browser Proof

- Use real navigation rather than `history.pushState`.
- Check critical routes at 1440px and 390px.
- Reject application console errors, failed required requests, blank screens, and horizontal overflow.
- Save screenshots, request evidence, coverage counts, and findings under `reports/verification/`.

## Deferred Backlog

Deferred work remains visible but does not block the active roadmap.

### USAspending

Promote only after organization identity resolution and evidence contracts are
stable. Promotion requires a source client, scheduled ingest ownership,
recipient/company resolution rules, contract-specific provenance, and a clear
member-facing user flow.

### Broader Wikidata Ingestion

Promote only when a missing profile field cannot be obtained from a primary
government or maintained legislative source. Wikidata remains contextual and
must not override primary identifiers.

### Anomaly Scoring

Promote only after all required input sources have measured coverage. Before
implementation, specify explainability, false-positive handling, missing-input
behavior, versioned formulas, tests, and non-accusatory copy. Scores never
replace the underlying evidence rows.

### Pre-Commit Hooks And Broad Comment Cleanup

Promote after CI is stable. Local hooks must call the same commands as CI and
must not introduce a second quality policy. Broad code-comment work belongs in
focused maintenance changes rather than product milestones.

## Retired Decisions

- CapitolTrades is not the system of record. Official House and Senate filings are canonical.
- `/stocks` is absorbed into `/portfolio`; the remaining empty directory is cleanup, not a product route.
- Voteview is the canonical roll-call source because the current Congress.gov v3 path used by the old command is unavailable.
- `lda.gov` replaces the legacy `lda.senate.gov` endpoint.
- Worker lifecycle ingestion replaces manual seed-count synchronization.
- House and Senate Stock Watcher datasets are not canonical evidence sources.
- The legacy enrichment crates remain reference and compatibility code until a removal audit proves they have no callers.

## Completion Definition

The master plan is complete when M0 through M6 satisfy every exit criterion,
all required sources have measured terminal coverage, critical user flows pass
live desktop and mobile checks, deferred work remains explicitly deferred, and
the final verification report can reproduce every public claim from source
records, code, or command output.
