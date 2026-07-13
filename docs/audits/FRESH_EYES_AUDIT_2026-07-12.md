# Fresh-Eyes Implementation Audit, 2026-07-12

This report reviews the current CongressTracker worktree, runtime, live database,
frontend behavior, CI, tests, and implementation plan. It is a findings-first
release audit. It does not claim that the current worktree is ready to publish.
The current disposition is **release blocked**.

## Release Blockers

### 1. Election ratings are derived from candidate filing counts

`frontend/components/elections/election-map-helpers.ts:114-225` counts FEC
candidate rows by party and converts the difference into labels such as Safe,
Likely, Tilt, and Toss-up. These are displayed as party lean and competitive
race ratings in `frontend/components/elections/election-map.tsx:895-983`.
They are not election results, polling, or vote share.

The party classifier also misses common FEC values such as `DEM` and `REP`.
Chrome displayed public race ratings from this incomplete filing-count data.
This is a factual error and must be removed before publication.

### 2. Influence-network financial attribution is incorrect

`backend/crates/intel_backend/src/repository/influence.rs:232-246` joins each
committee to a network-wide materialized view instead of committee-specific
transactions. Live evidence reported the same $30,824,598.10 total for two
different committees while the entire AIPAC network total was $19,035,301.67.
Individual committee totals exceeded the network total.

`repository/influence.rs:278-318` also includes opposition spending in amounts
described as received. Opposition spending is not money received by a candidate.
The current influence financial API is unsafe to publish.

### 3. Member navigation can mix evidence from different people

`frontend/app/legislators/[id]/page.tsx:83-141` retains funding, votes, bills,
relationships, and disclosures across `params.id` changes. Requests are not
canceled and the prior state is not cleared. A new Member profile can render
with the prior Member's evidence, and late prior requests can overwrite the new
state. Profile request errors are also rendered as not-found records.

### 4. Public GET routes can trigger writes and unbounded work

The public funding handler calls live OpenFEC ingestion on cache miss at
`backend/crates/intel_backend/src/routes/funding.rs:87-124`. That path makes
upstream requests and writes funding cache rows through
`repository/fec.rs:447-571`.

The public router exposes `/api/admin/entity-resolution-queue` at
`routes/mod.rs:271-275`. Its `limit` is not bounded at `routes/admin.rs:8-29`.
A live request for 5,000 rows returned a 1.1 MB internal review payload, and a
negative limit returned raw PostgreSQL error text.

The public county route fetches TIGERweb during requests at
`frontend/app/api/elections/counties/route.ts:20-25`. These paths contradict the
private-ingestion, prepared-data rule in ADR 0003.

### 5. CI cannot pass from a clean checkout

The frontend `pnpm test` glob includes the live backend suite in
`frontend/scripts/e2e-api-flows.test.mjs`, but the frontend CI job at
`.github/workflows/ci.yml:64-102` starts no backend or database. An unreachable
backend produced 18 failures.

The backend CI job supplies no Congress.gov key. It still runs
`test_ingest_all_smoke_exits_success` at
`backend/crates/intel_backend/tests/ingestion_pipeline_test.rs:80-97`.
`all-smoke` treats the missing key as a failure and exits nonzero at
`backend/crates/intel_backend/src/bin/ingest.rs:3135-3194`.

### 6. The reported green integration run used a stale backend process

Current source returns Senate coverage `missing_consent` at
`backend/crates/intel_backend/src/senate_efd.rs:31-47`. Port 4020 returned the
obsolete `disabled_terms_not_accepted` value. The frontend live test still
expects the obsolete value at `frontend/scripts/e2e-api-flows.test.mjs:221-227`.

An isolated server using the current binary passed 17 API tests and failed the
Senate assertion. The prior 18-of-18 result therefore did not test the current
backend source. `scripts/self-test` does not start a fresh backend before the
frontend live suite.

### 7. M5 is marked complete while required work is absent

`docs/IMPLEMENTATION_PLAN.md:630-692` marks M5 complete while M3 remains open
and M5 still requires certified county results, Member background enrichment,
and money-votes evidence. County responses explicitly return
`results_coverage: "not_loaded"`. Candidate dossiers do not exist. Member tabs
are not URL-addressable or independently loaded.

Money-votes is also placed under Deferred Backlog while labeled an active M5
requirement at `docs/IMPLEMENTATION_PLAN.md:834-884`.

### 8. The money-votes model does not contain donor industry data

`docs/features/money-votes.md` describes
`fec_campaign_finance_cycle_summaries` as a committee-to-industry rollup.
Migration 0039 stores one total row per cycle and groups its secondary summary
by recipient committee type, not donor industry. The documented
`influence_networks.network_type` column is not present in the migrations.
The proposed feature cannot produce its stated result from the named schema.

### 9. House disclosure persistence can duplicate or publish partial data

The transaction conflict key includes nullable ticker values at
`backend/crates/intel_worker/src/main.rs:1171-1178`. PostgreSQL treats nulls as
distinct for the current constraint. The live database had 364 duplicate
semantic groups and 430 extra rows.

PTR and annual families are written through separate autocommit statements at
`intel_worker/src/main.rs:1166-1445`. A failure can leave a partly replaced
filing. Any positive extracted row count marks the filing parsed, while OCR can
skip failed pages. There is no expected-section, expected-row, page-completeness,
or confidence gate before the public parsed state.

### 10. Worker lease and OCR limits are unsafe

Jobs are requeued after five minutes without lease renewal at
`intel_worker/src/main.rs:1853-1873`. Valid OCR can exceed that window. The old
worker can race a replacement, and late status updates do not verify ownership.

`intel_worker/src/parsers.rs:14-84` has no subprocess timeout, page limit,
output limit, memory bound, or disk-headroom check for PDF rendering and OCR.
The accepted Raspberry Pi and interactive-PC resource contracts are not yet
implemented.

## High-Severity Functional Findings

### 11. The default receipts page filters to zero-dollar rows

`frontend/app/fec/receipts/page.tsx:16-18` converts an absent numeric parameter
to zero. Both absent amount bounds become zero at lines 64-76. The default page
requested `min_amount=0&max_amount=0`, took about 24 seconds server-side, and
returned only zero-dollar rows. Candidate receipt links also use `search=` while
the destination reads `q=`.

### 12. County results are absent and county geometry is malformed

The county API and UI state that election results are not loaded. Chrome found
Pennsylvania county paths covering the full projection extent rather than their
county shapes. The projection passes TIGER rings directly into D3 at
`frontend/lib/county-map-projection.mjs:9-17` without normalizing winding.
Existing tests assert non-empty path strings, so complement rectangles pass.

### 13. Candidate and Member directories are truncated

The candidate service receives the first 200 alphabetical rows and then applies
all filters in the browser. Later candidates cannot be found. Candidate mapping
also drops principal committee fields. There is no candidate detail route.

The Member directory asks for at most 535 rows while the live current-Member
endpoint returned 537. The API Member list is itself unbounded and builds full
profiles through a sequential N+1 loop at
`backend/crates/intel_backend/src/repository/members.rs:417-460`.

### 14. Member trade history filters a global 200-row slice

`frontend/lib/services/stocks.ts:115-117` fetches the first 200 global trades
and filters that slice by Member. The live warehouse contained 36,454 trades,
and the first slice covered only 30 Members. Most dossier trade histories can
therefore appear empty despite loaded records.

### 15. Member financial dossiers are incomplete

Member pages do not include the required financial-position or net-worth card.
The disclosure tab at `frontend/app/legislators/[id]/page.tsx:862-884` lists
filing documents but does not render the loaded assets, liabilities, income,
transactions, ownership, snapshots, or history. The Portfolio Overview is a
Member roster and committee summary rather than reported holdings.

### 16. Bill detail has both runtime and semantic failures

`GET /api/bills/119/hr/9250/intel` returned a 500 because
`repository/bills.rs:563-568` decodes a PostgreSQL `NUMERIC` value as `f64`
without a cast.

Bill funding at `repository/bills.rs:527-545` sums every cycle and combines
direct receipts, supporting expenditures, and opposing expenditures into one
positive amount. Cold bill detail also performs more than three sequential
queries per sponsor. A large bill can execute hundreds of queries without a
request deadline.

### 17. Party-line alignment invents a majority on ties

`repository/votes.rs:103-128` uses row-number ordering to select one position
when party votes are tied. Live Congress 119 data contained 126 tied party-vote
groups. The query also uses current party rather than the party stored for the
vote. Historical party switches can alter past metrics.

Vote rows omit bill linkage, result, measure type, amendment context, source URL,
and other fields required by the accepted Member dossier contract.

### 18. Senate discovery cannot cover 2012 to present

The Senate command defaults to 2021 through 2026 and a 1,000-row limit at
`backend/crates/intel_backend/src/bin/ingest.rs:156-163`. The worker invokes
those defaults. Discovery stops at the limit even if more provider records are
available and then marks the run successful. The end date will also become
stale. Live state remained at zero reports and zero staged search pages.

### 19. Lobbying ingestion is not scheduled or idempotent

Lobbying activity insertion has no semantic conflict target at
`repository/lobbying.rs:193-217`, and reruns append rows. Duplicate live rows
already exist. The worker has no scheduled LDA refresh path.

### 20. Legislation ingestion silently truncates

The all-Member legislation refresh at `ingest.rs:424-465` makes one sponsored
and one cosponsored request per Member, discards request and row errors, and can
mark the run successful when only some rows were seen. The client methods do not
paginate these results.

### 21. Public resource protection is absent

The router has permissive CORS but no request timeout, rate limit, concurrency
limit, response-size bound, or load shedding. Several list routes accept
negative or arbitrarily large limits. The Member list combines this with a
sequential full-profile N+1 path.

### 22. Source and disclosure coverage can report false health

Source status selects only the latest run across all endpoints and cycles. A
small successful request can hide a failed bulk cycle. Non-success states such
as partial, running, auth missing, and consent missing are collapsed.

The disclosure coverage endpoint counts attempts rather than distinct document
versions, includes duplicate rows, calls the minimum discovered year the oldest
completed year, and reports any discovered backlog as active. The live endpoint
called 2018 completed while 2018 work remained unresolved.

## Test and Documentation Findings

### 23. Several tests provide false confidence

- The FEC/LDA separation test constructs test-only objects and imports no
  production transformation.
- The net-worth range test reimplements the calculation instead of calling
  production code.
- Several backend endpoint tests return successfully on 404.
- Database tests silently return when `DATABASE_URL` is absent.
- Live frontend detail tests return without assertions when source lists are
  empty.
- The test catalog says `pnpm verify` excludes live APIs even though it includes
  the live API suite.

### 24. Parser promotion measures precision without recall

The M2 gate requires row precision and critical-field exactness but sets no row
recall, field recall, expected-row, missed-page, or expected-section threshold.
A parser that emits one correct row and drops the rest can pass the stated gate.

### 25. Milestone tags and states do not match the release rules

The plan requires a focused commit and matching tag for completion. M4 and M5
are marked complete without milestone tags. The annotated
`m0-m6-end-to-end-verification` tag claims all checks passed and all milestones
were complete, while M1, M2, M3, M5, and M6 still have open work. Most current
implementation and worksheets are uncommitted.

### 26. Performance gates are not reproducible

The plan does not name the Raspberry Pi model, OS, architecture, corpus version,
warmup, repetitions, CPU budget, I/O budget, or allowed foreground degradation.
The public load gate has no minimum successful-response rate or fixed traffic
mix. A system returning mostly 429 or 503 responses could satisfy the current
latency and memory wording.

### 27. Authoritative docs disagree

The implementation plan, backend requirements, agent plans, final verification
report, test catalog, and Senate worksheets contain conflicting statements about
amendments, lobbying links, disclosure counts, Senate consent, M5, M6, and source
completion. Stale reports named FINAL are not marked superseded.

### 28. Page failure and accessibility coverage is incomplete

Only a small share of the 29 page routes have route-level loading or error
files. Rendered smoke checks cover 10 routes and omit several critical
directories and dossiers. Interactive election SVG paths are unnamed buttons.
The global skip link targets an ID missing from API Docs and both FEC pages.

## Current Live State

Counts changed during the audit because the House worker remained active.

- Ingest jobs: 1,482 pending, 41 failed, 43,382 completed at the backend audit checkpoint.
- Senate eFD: zero reports and zero staged search pages.
- House endpoint: 23,493 discovered, 22,432 downloaded, 5,994 reported parsed, 1,573 with issues.
- Disclosure transactions: 364 duplicate semantic groups and 430 extra rows.
- OpenFEC: a current 2022 bulk no-space failure plus partial operating-disbursement and supplemental runs.

## Verification Performed

- Inspected the complete dirty worktree and milestone/tag state.
- Queried live API, source, worker, bill, influence, election, and disclosure behavior.
- Ran the frontend API suite against an unreachable backend. All 18 live tests failed, matching the CI topology.
- Ran the API suite against an isolated current backend. Seventeen passed and the stale Senate assertion failed.
- Used Chrome for Elections DOM, accessibility, geometry, console, overflow, and screenshot checks.
- Confirmed the default receipt query and response behavior.
- Ran `git diff --check`; it initially failed on a trailing blank line in `papercuts.md`.

No production behavior was changed in this audit.
