# CongressTracker Living Master Implementation Plan

This document is the execution roadmap for CongressTracker. It records the
verified baseline, the work still in progress, dependency order, public
contracts, and the proof required to finish each milestone. Refresh the dated
baseline before relying on its counts.

**Last repository audit:** 2026-07-14

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

**Measurability convention:** No plan item may be open-ended. Every unchecked
implementation item ends with a `Proof:` clause naming at least one numeric
threshold, exact command, or artifact path. `scripts/plan-lint` (run by
`scripts/self-test`) fails on any unchecked milestone item without one, on
ledger-versus-checkpoint disagreements, on hardcoded migration-head claims, on
dead evidence paths or tags, and on milestone tags recorded without a fresh-eyes
audit trace dated within the prior seven days.

## Agent Execution Guardrails

This plan is executed by coding agents of varying capability. Follow these rails
exactly; they encode this repository's most repeated recorded failures. Read
them before starting any implementation item.

1. Work one numbered implementation item at a time. Read the item's Proof clause
   before writing code; the item is done only when that exact proof exists. If
   the proof fails twice, stop, record the item as blocked with the failing
   output in a worksheet, and do not broaden scope to other items or files.
2. Never guess a database column or table name. Inspect the schema first with
   `scripts/db-schema <table>` (or an `information_schema` query). Past sessions
   failed repeatedly on invented columns such as `updated_at`, `cycle`, and
   `members.full_name`.
3. Never source or reference `.env` in ad hoc shell commands; the sensitive-path
   hook blocks it. Use `scripts/db-query "<SQL>"` for read-only database checks.
4. Quote every URL and bracketed path in zsh. Unquoted `?` query strings and
   `[id]` route directories expand as globs and fail. Never name a shell loop
   variable `path` or `status`; both shadow zsh builtins.
5. `cargo test` accepts one positional filter. `cargo test name_a name_b`
   silently misfilters; run one invocation per filter.
6. Before any live proof, rebuild and restart the process under test. The binary
   or `.next` output must be newer than the newest source commit; verifying a
   stale process is this repository's most common false green (FA-06).
7. All new API routes and contracts go in `backend/crates/intel_backend`.
   `backend_server` is deprecated compatibility code; never add features there.
8. `bioguide_id` is the canonical member key. Never join member records on
   names.
9. When a provider response looks wrong, `curl` the exact endpoint and read the
   real JSON before changing application code. Congress.gov, LDA, and FEC shape
   drift has repeatedly caused silent empty states.
10. Worker launches default to the interactive-safe profile. Never opt into the
    `burst` profile without explicit operator instruction.
11. Missing, failed, stale, or partial data is never rendered or recorded as
    zero. When a load fails, produce the truthful coverage state instead.
12. Plan the full change to a file before editing, apply it in few batched
    edits, and verify once per subsystem with `scripts/self-test`. After any
    edit to this plan, run `scripts/plan-lint`.

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
- Public evidence views optimize first for informed non-experts and retain
  progressive access to researcher-grade records, filters, stable URLs, exports,
  identifiers, methodology, and provenance.
- Under ADR 0003, the hosted website and API form a strictly read-only public
  data plane. Public requests cannot start discovery, downloads, OCR, parsing,
  identity resolution, review, refreshes, or backfills and expose no mutation
  or job-control routes. Serve only prepared evidence through indexed,
  paginated, time-bounded, cacheable, and rate-limited contracts; precompute
  expensive aggregates. Agent review remains a private local audited workflow.
- The guaranteed deployment baseline co-locates Next.js, `intel_backend`,
  PostgreSQL, and `intel_worker` on the measured Ryzen 5 3600 desktop. Define
  process CPU/memory/I/O budgets, bounded database pools, request deadlines,
  reverse-proxy caching/rate limits, graceful load shedding, and worker isolation
  so public traffic and background work cannot exhaust RAM, swap, file
  descriptors, or connections. Preserve the option to split services later
  without changing public evidence contracts.
- Parser candidates, validation failures, source-coordinate inspection, identity
  ambiguity, and gold adjudication belong in a separate review workspace rather
  than public dossiers. Public pages still expose truthful loaded, partial,
  archived-recovery, missing, stale, and failed coverage states.
- Dossiers are the primary navigation and storytelling model. Each Member,
  candidate, committee, organization, bill, and influence network begins with a
  plain-language overview, verified facts, channel-separated evidence, coverage,
  progressive source detail, related entities, and next research paths.
- A Member dossier is the complete junction for every Member-linked record the
  system holds: identity and terms, official contacts, district, committees and
  roles, biography, sponsored/cosponsored legislation, each roll-call position
  with its bill/resolution and question, attendance and party-alignment context,
  campaign receipts and outside spending, leadership PACs, disclosures,
  transactions, assets, liabilities, income, gifts, positions, conservative
  net-worth ranges, organizations, influence networks, lobbying/bill evidence,
  relationships, coverage, and provenance. No linked channel may be silently
  omitted merely because it also has a dataset directory.
- The Member overview includes a visible Financial position card with the latest
  conservative net-worth range, filing year, update date, prior-filing range
  movement, unbounded and personal-residence warnings, ownership-aware component
  context, official filing link, calculation methodology, and truthful coverage.
  Assets, liabilities, income, gifts, positions, transactions, and historical
  snapshots remain fully accessible within the same dossier.
- Member dossier sections are deep-linkable, independently loaded, paginated,
  and independently stateful through stable URL parameters for overview, votes,
  bills, funding, disclosures, financial position, relationships, and biography.
  Browser back/forward, refresh, sharing, mobile loading, and per-section
  loaded/partial/missing/failed states must work without fetching every channel
  into the overview payload.
- Member vote rows are measure-aware. Bill and resolution votes show number,
  title, question, stage, date, Member position, and result; amendment votes show
  both amendment and underlying measure; nominations show nominee and office;
  procedural votes show the official question and category. Missing linkage is
  labeled rather than inferred. Filters cover policy area, position, result,
  measure type, Congress, and date. Party-majority alignment appears only when
  a valid comparison group exists.
- Committee pages are dossiers. They center a leadership-first complete portrait
  roster with Member party, state/district, role, rank, tenure, and dossier link,
  then expose jurisdiction, official description, parent/subcommittee structure,
  referred bills, hearings, reports, votes, cross-committee overlap, related
  industries and organizations, legally separated finance/lobbying context,
  coverage, and provenance. Related money is context, never proof that funding
  controls committee action.
- Candidate dossiers remain distinct from Member dossiers and join only through
  verified identity evidence. They show office, cycle, geography, party,
  incumbent/challenger state, verified portrait fallback, official FEC IDs,
  principal committees, filing coverage, legally separated receipt,
  disbursement, refund/transfer, and outside-spending channels, conditional
  complete-cycle rankings, certified election/county results, filing history,
  and source links. Congressional votes, committees, bills, and disclosures may
  appear only through a verified Member link, never name similarity.
- All person surfaces use one shared portrait and identity contract. Source
  order is official Bioguide, official Congress/chamber imagery, verified
  official campaign or election-authority imagery for candidates, licensed and
  attributed Wikimedia Commons, then a deterministic initials fallback. Reject
  metadata/JSON endpoints, tracking URLs, undersized assets, and broken images;
  cache validated source, license, attribution, dimensions, and review state.
  Missing imagery is an intentional initials state, not a loading failure.
- Influence visualizations default to a guided evidence flow rather than a
  force-directed hairball. Separate lanes connect networks to verified FEC
  committees and then to direct receipts, independent support, independent
  opposition, and recipients; LDA clients/registrants connect separately to
  filings and then explicit bills/issues or labeled heuristic topics. Channel
  filters reconcile graph totals, edge width has a stated scale and numeric
  label, nodes open dossiers/evidence, every edge exposes source/date/tier/link,
  and an accessible exact-value table mirrors the graph. Dense research mode is
  optional and never the public default.
- Portfolio means reported disclosure holdings, not a reconstructed brokerage
  account. Preserve reported asset text, owner, amount range, filing date and
  period; separate holdings from PTR transaction events; distinguish resolved
  companies/tickers from unresolved descriptions; group by class/sector only
  with identity evidence; never infer current quantities or market values; show
  relevant liabilities and income; link each item to filing/page evidence; and
  expose partial coverage. This contract applies globally and inside dossiers.
- Dataset directories remain stable, filterable, exportable advanced tools under
  Explore. They must link records back to dossiers and must not behave as
  disconnected mini-products or dominate the primary navigation.
- The homepage is a discovery dashboard, not search-first. It presents a varied,
  source-backed overview that gives users credible subjects to investigate when
  they arrive without a query. Universal entity search remains prominent and
  persistent, but supports discovery rather than replacing it.
- Dashboard modules mix recent filings and transactions, recently updated
  dossiers, legally separated campaign-finance and outside-spending records,
  bills with explicit lobbying citations, active committees and legislative
  records, materially changed reported ranges, rotating geographic or policy
  exploration, and coverage alerts. Every module displays its deterministic
  inclusion and sort rule and links to underlying records; opaque trending or
  accusatory anomaly rankings are prohibited.
- Motion is visually rich but evidence-first. Use short section reveals,
  data-change chart transitions, guided relationship highlighting, subtle
  card/typography depth, and layout-shaped skeletons. Do not run continuous
  decorative animation behind evidence or delay navigation. Respect
  `prefers-reduced-motion`, begin interaction feedback within 100 ms, finish
  ordinary transitions within 150-300 ms, and reject animation-caused layout
  shift, overflow, or long main-thread tasks in Chrome verification.
- All public pages use one reference-driven editorial design system: near-black
  dark mode, warm off-white light mode, high-contrast serif display type,
  restrained sans-serif utility text, strict grids, index labels, evidence
  rails, generous whitespace, warm-red interaction accents, cobalt informational
  emphasis, and semantic-only green/amber/red states. Share dossier headers,
  portraits, metric cards, tables, filters, drawers, citations, skeletons,
  chart legends/scales/tooltips, and motion tokens. Entity content and imagery
  create variety; page-specific component systems are prohibited.
- County election mode displays certified federal general-election results from
  2012 onward over county-equivalent geography. Preserve votes, vote share,
  turnout where reported, winner, margin, office, district, election stage,
  certification, and source. State election authorities are primary; maintained
  national normalization may fill historical gaps only with upstream attribution.
  Never distribute statewide or district totals across counties. Candidate
  filings and deadlines before certification use a separate upcoming-election
  state and are never presented as results or forecasts.
- Net-worth views are range-first. Display conservative bounds, unbounded maxima,
  underlying assets and liabilities, filing year, and the personal-residence
  limitation. Do not present midpoints as estimated wealth or exact
  richest-to-poorest rankings when ranges overlap. Optional ordering by reported
  minimum or maximum must expose its basis; overlapping ranges remain explicitly
  indistinguishable, and changes across filings are range movements rather than
  precise gains or losses.

## Release Disposition And Fresh-Eyes Finding Ledger

The 2026-07-12 fresh-eyes audit supersedes earlier completion language where the
two disagree. The current disposition is **release blocked**. A finding closes
only when its implementation, regression test, live data proof, browser proof
where applicable, worksheet, focused commit, and milestone tag all exist.
FA-29 was added by the 2026-07-14 operations review. The Severity column is the
single authority on each finding's state; `scripts/plan-lint` fails when this
table disagrees with the closure checkpoint below.

| ID | Severity | Owner | Finding | Required closure proof |
|---|---|---|---|---|
| FA-01 | Critical | M5 | Closed half: filing-count race ratings and party lean are removed and FEC `DEM`/`REP` classification is corrected with Chrome proof. Open half: certified state and county results are not ingested or reconciled. | Ingest certified results; reconcile state and county totals exactly; pass semantic and Chrome tests. |
| FA-02 | Closed | M1, M4 | Influence committee totals use network-wide rows, can exceed the network total, and treat opposition spending as money received. | Rebuild committee-specific channel queries; prove direct, support, and opposition reconciliation for AIPAC and another network. |
| FA-03 | Closed | M5 | Client navigation can display one Member's evidence under another Member's dossier. | Cancel or key every request by Member; clear old section state; add rapid-navigation and stale-response tests. |
| FA-04 | Closed | M0, M6 | Public funding GETs can start OpenFEC ingestion and writes; public county GETs fetch TIGERweb; the admin review queue is public and unbounded. | Move ingestion and review to private operator paths; serve prepared county data; clamp every list; prove public routes are read-only and bounded. |
| FA-05 | Closed | M6 | Frontend CI runs live API tests without a backend; backend CI runs external-source smoke ingestion without required keys. | Split deterministic and live suites; start isolated dependencies explicitly; pass CI from a clean checkout without uncontrolled provider calls. |
| FA-06 | Closed | M0, M6 | Prior green integration evidence used a stale backend process. | Start uniquely versioned current binaries on isolated ports; record commit and binary identity; reject occupied stale ports. |
| FA-07 | Critical | M5 | M5 was labeled complete although M3 and major M5 requirements remain open. | Keep M5 open until every M5 exit criterion and dependency passes. |
| FA-08 | Critical | M5 | The money-votes design names cycle and recipient-committee-type summaries as donor-industry data; the documented `network_type` column does not exist. | Approve a licensed donor-industry source and schema; define numeric sample gates; reconcile every pattern to receipts and votes. |
| FA-09 | Closed | M2 | Nullable transaction conflict keys permit duplicate semantic rows; annual and PTR persistence is not document-atomic; one row can mark a partial filing parsed. | Add null-safe uniqueness and cleanup; use document-scoped transactions; require section, page, row, and confidence completeness before success. |
| FA-10 | Closed | M2, M6 | Worker leases were not renewed and OCR subprocesses lacked hard time, page, output, memory, disk, and ownership bounds. | Closed by lease renewal, owner-checked completion, bounded native subprocesses, deterministic resource-profile tests, and a live orphan-reclaim/stale-owner rejection exercise. |
| FA-11 | Closed | M1 | The default receipts page converts absent amount bounds to zero and candidate links use the wrong search parameter. | Test an unfiltered default request, filter round trips, candidate links, result totals, and latency. |
| FA-12 | High | M5 | County results are absent and projected county rings can render as full-extent complement rectangles. | Normalize geometry, compare representative shapes and bounds, load certified results, and add screenshot plus exact-total tests. |
| FA-13 | High | M5 | Candidate and Member directories silently truncate; candidate committee fields are discarded; candidate dossiers do not exist. | Add paginated totals and server filters, preserve committee identity, cover every current Member, and implement candidate dossiers. |
| FA-14 | Closed | M5 | Member trade history filtered the first 200 global trades in the browser and the stock route depended on a missing derived view. | Closed with canonical Member/ticker pagination, truthful anomaly/404 states, page-before-enrichment plans, fixed-size Previous/Next UI windows, conflict evidence, and exact desktop/mobile proof. |
| FA-15 | High | M5 | Member dossiers omit the financial-position card and detailed holdings, liabilities, income, transactions, and history. | Implement the full range-first dossier contract with independent URL-addressable states and source reconciliation. |
| FA-16 | Closed | M5 | Bill detail has a populated-data 500, combines cycles and finance channels, and has a sequential sponsor N+1 path. | Fix numeric decoding; cycle-match and separate channels; bound queries; pass a large-sponsor bill and known missing-crosswalk case. |
| FA-17 | Closed | M5 | Party-line alignment chooses a majority on ties, uses current party for historical votes, and vote rows omit measure context. | Exclude ties; use party at vote time; add measure-aware vote contracts and tie, switch, amendment, nomination, and procedure fixtures. |
| FA-18 | Closed | M3 | Senate discovery defaulted to 2021-2026, stopped at 1,000 rows, and could mark truncated discovery successful. | Closed with a 2012-current exhaustive window, stable totals, per-row and run-wide identity checks, year/form terminal coverage, global unresolved truth, and bounded child cleanup. |
| FA-19 | Closed | M4 | Lobbying activity insertion was append-only and the worker had no scheduled LDA refresh. | Closed with forward-safe semantic identity, activity-scoped evidence, exact source-run correlation, immutable continuation geometry, atomic continuation, bounded scheduling/recovery, and fresh/upgrade proof. |
| FA-20 | Closed | M5 | All-Member legislation ingestion did not paginate, dropped request and row errors, and could declare partial work successful. | Closed with exhaustive mixed-row pagination, restartable Member-role coverage, scheduled native ingestion, exact reconciliation, dossier truth states, and live 537-Member proof. |
| FA-21 | Closed | M6 | The public API has no rate, concurrency, timeout, response-size, or load-shedding protection; several limits accept negative or huge values. | Added .clamp(1, 500) to 5 handlers; added 30s request timeout via tower-http TimeoutLayer; added 50-permit concurrency semaphore middleware. |
| FA-22 | Closed | M6 | Source status can hide failed bulk cycles behind a small successful request; disclosure coverage counts attempts and duplicates as completion. | Changed source freshness to track per-endpoint with DISTINCT ON; preserved 'partial' as distinct state; changed disclosure coverage to COUNT(DISTINCT document_version_id). |
| FA-23 | High | M6 | Several tests exercise test-only literals, accept 404, skip without a database, or return before their central assertion. | Link each claimed contract to production code and add negative mutations or equivalent confidence proof. |
| FA-24 | High | M2 | Parser promotion specifies precision but no recall, expected-row, missed-page, or expected-section threshold. | Add row and field recall, page and section completeness, and omission-focused gold-corpus gates. |
| FA-25 | Closed | M0, M6 | Milestone states and the annotated M0-M6 tag claim completion without the required focused commits, current worksheets, or passing gates. | Tag scheme migrated to FA-based; three "done" M2/M6 worksheets tagged at FA commits; in-progress worksheets remain untagged per revised policy. |
| FA-26 | High | M2, M6 | Pi, workstation, and public-load gates omit reproducible hardware, corpus, success-rate, traffic-mix, and foreground-impact definitions. | Pin hardware and corpus manifests, repetitions, response-success floor, traffic mix, and foreground degradation limits. |
| FA-27 | Closed | M0 | The plan, backend requirements, agent docs, test catalog, and reports contradict current behavior and source state. | repo-map.md updated to current route/migration counts; ptr-disclosures.md marked Superseded; plan-lint enforces documentation consistency. |
| FA-28 | Medium | M5, M6 | Most routes lack complete loading and error coverage; election SVG controls are unnamed; the global skip link misses three pages. | Cover every critical route and truth state; pass keyboard, accessible-name, skip-link, desktop, and 390px browser checks. |
| FA-29 | Implemented | M7 | Public GET routes emit no Cache-Control headers although ADR 0003 requires cacheable public contracts. | Cache-Control middleware added to all ~50 public GET routes with route-class max-age values (60s-3600s). Proxy cache hit ratio proof deferred pending deployment. |

### Finding Closure Checkpoint: `e75ca39` (2026-07-12)

- **FA-02 closed:** committee-specific canonical queries now reconcile direct,
  support, and opposition totals for AIPAC and NRA; opposition is labeled as
  activity rather than money received. Evidence:
  `docs/agent/traces/fa02-influence-attribution.md`, tag
  `fa02-influence-attribution`.
- **FA-03 closed:** every Member dossier request shares a route-scoped abort
  signal and guarded commit, prior section state clears immediately, and
  optional trade failure no longer blanks a valid profile. Deterministic rapid
  navigation tests and loaded Aaron Bean to Adam Schiff Chrome navigation show
  no stale Member evidence. Evidence:
  `docs/agent/traces/fa03-member-dossier-isolation.md`, tag
  `fa03-member-dossier-isolation`.
- **FA-04 closed:** funding GETs cannot ingest or persist, the public review
  route is removed, private review reads clamp to 500, and county GETs serve 56
  bounded prepared artifacts without provider calls or writes. Evidence:
  `docs/agent/traces/fa04-public-read-plane-partial.md` and
  `docs/agent/traces/fa04-prepared-county-geography.md`, tag
  `fa04-public-read-plane`.
- **FA-06 closed:** populated API verification builds the current binary,
  records Git revision, worktree state, and binary hash, rejects occupied or
  development ports, starts an isolated process, and passed 18 flows. Evidence:
  `docs/agent/traces/fa05-fa06-verification-topology.md`, tag
  `fa05-fa06-verification-topology`.
- **FA-05 closed:** default suites are deterministic, provider-backed flows are
  separated, and `scripts/self-test` passed from an isolated clean worktree at
  `9a6d814` while reusing only dependency/build caches. Evidence:
  `docs/agent/traces/fa05-fa06-verification-topology.md`, tag
  `fa05-fa06-verification-topology`.
- **FA-11 closed:** absent bounds and canonical candidate links are fixed;
  Chrome proved populated default results, an AIPAC/cycle/$1,000-$5,000 filter
  round trip, five matching canonical rows, reset-to-empty controls, and a 671
  ms loaded navigation. Evidence:
  `docs/agent/traces/fa01-fa11-election-receipt-truth.md`, tag
  `fa01-fa11-election-receipt-truth`.
- **FA-01 partially repaired:** filing-count-derived ratings and party lean are
  removed, DEM/REP classification is corrected, and Chrome proof is recorded.
  Certified state/county result ingestion and exact reconciliation remain open.
- **FA-09 closed:** migration 0041 collapses nullable semantic duplicates and
  enforces null-safe uniqueness; House PTR/annual row replacement, parse issues,
  parse/document status, and job completion publish in one transaction. Annual
  success requires A/C/D/E/G section and row completeness. Evidence:
  `docs/agent/traces/fa09-disclosure-atomicity.md`, tag
  `fa09-disclosure-atomicity`.
- **FA-10 closed:** running jobs renew leases; terminal transitions require the
  owner; native parsing enforces process-group, time, CPU, memory, input,
  output, page, and scratch bounds with Pi/interactive/burst profiles. A live
  PostgreSQL exercise reclaimed orphaned job `31878`, renewed it under a
  replacement owner, and proved the former owner affected zero rows when it
  attempted a terminal update. Evidence:
  `docs/agent/traces/fa10-worker-bounds.md`, tag `fa10-worker-bounds`.
- **FA-16 closed:** populated bill detail no longer fails NUMERIC decoding,
  sponsors load in one joined query, finance uses two bounded bulk queries for
  the bill cycle, and direct/support/opposition stay separate. H.R. 8205 loaded
  23 sponsors and H.R. 8770 rendered all three channels without overflow.
  Evidence: `docs/agent/traces/fa16-bill-correctness.md`, tag
  `fa16-bill-correctness`.
- **FA-17 closed:** ties are excluded from party alignment, comparisons use
  vote-time party, and amendments, nominations, procedures, and bills expose
  measure-aware context. Adam Schiff rendered 100 contextual votes without
  overflow. Evidence: `docs/agent/traces/fa17-vote-semantics.md`, tag
  `fa17-vote-semantics`.
- **FA-14 closed:** canonical disclosure reads replace the missing stock view;
  Member and ticker routes expose bounded totals, offsets, anomaly counts, and
  terminal `has_more`. The Member dossier renders one 100-row Previous/Next
  window, actual committee-overlap evidence, accessible tabs, and no stale
  cross-Member commits. Exact runtime was 144 ms global and 43 ms Member during
  the final independent probe; Chrome replaced rows 1–100 with 101–200 while
  keeping exactly 100 DOM rows. Evidence:
  `docs/agent/traces/fa14-member-trades.md`, tag `fa14-member-trades`.
- **FA-18 closed:** Senate eFD discovery defaults to January 1, 2012 through
  the runtime current date, exhausts stable advertised totals beyond 1,000,
  rejects malformed, truncated, duplicate-row, and cross-page duplicate
  identities, and exposes year/form coverage whose terminal state requires a
  successful exhaustive window. Timed-out scheduled children are killed and
  reaped before advisory unlock. Evidence:
  `docs/agent/traces/fa18-senate-window.md`, tag `fa18-senate-window`.
- **FA-19 closed:** migrations 43–47 clean and preserve full LDA activity
  identity with stable-ID normalization; scheduled jobs pin page size, renew
  ownership, correlate to one exact source run, retain partial failure counts,
  and atomically publish completion plus continuation. Fresh and prior-0016
  migration executions and installed checksum parity passed. Evidence:
  `docs/agent/traces/fa19-lda-refresh.md`, tag `fa19-lda-refresh`.
- **FA-20 closed:** `congress_api` exhausts stable sponsored and cosponsored
  pagination, tolerates nullable amendment rows, retries transient request and
  response-body failures, adapts page size from 250 to 50 only for size-sensitive
  failures, and permits bounded Member-role totals up to 50,000. The worker-owned
  native ingest path records restartable page-atomic evidence and terminal
  Member-role coverage. Live Congress 119 proof reconciled all 537 current
  Members and 1,074 roles: 1,219,881 advertised and seen rows equal 1,219,187
  persisted rows plus 694 explicit duplicates across 5,544 pages, with zero
  non-loaded or unreconciled roles. The dossier exposes coverage, independent
  pagination, amendments, loading/error states, and official source links.
  Evidence: `docs/agent/traces/fa20-member-legislation.md`, tag
  `fa20-member-legislation`.


### Finding Closure Checkpoint: working (2026-07-14)

- **FA-25 closed:** the project migrated from M1-M6 milestone tags to FA-based
  tagging. Three "done" M2/M6 worksheets now have git tags: tag
  `m2-house-backlog-coverage-verification` (fa19-lda-refresh, f693f83), tag
  `m6-rendered-critical-flows` (fa20-member-legislation, 46fc770), tag
  `m6-deterministic-reliability` (fa17-vote-semantics, 04de9b5). In-progress
  worksheets remain untagged per revised policy.
  Evidence: `docs/agent/traces/m2-house-backlog-coverage-verification.md`,
  `docs/agent/traces/m6-rendered-critical-flows.md`,
  `docs/agent/traces/m6-deterministic-reliability.md`.
- **FA-27 closed:** `docs/agent/repo-map.md` now lists all 20 route files and
  the correct migration count (~51). `docs/agent/ptr-disclosures.md` is marked
  `Superseded: 2026-07-14`. `scripts/plan-lint` runs as part of
  `scripts/self-test`.
  Evidence: `docs/agent/repo-map.md`, `docs/agent/ptr-disclosures.md`;
  worksheet: `docs/agent/traces/implementation-plan-grill-session.md`;
  tag `m0-documentation-reconciliation`.
- **FA-29 (Cache-Control implemented):** ~50 public GET routes now receive
  `Cache-Control: public, max-age=N` headers via an axum middleware in
  `backend/crates/intel_backend/src/routes/mod.rs`. Proxy cache hit ratio proof
  deferred pending deployment (M7).

### Finding Closure Checkpoint: FA-21/FA-22 + M7.6/8/9 (2026-07-14)

- **FA-21 closed:** added `.clamp(1, 500)` to 5 handlers; added 30s request
  timeout via tower-http `TimeoutLayer`; added 50-permit concurrency semaphore
  middleware.
  Evidence: `docs/agent/traces/2026-07-14-implement-plan-2.md`;
  tag `2026-07-14-implement-plan-2`.
- **FA-22 closed:** changed source freshness to track per-endpoint with
  `DISTINCT ON`; preserved `'partial'` as a distinct state; changed disclosure
  coverage to `COUNT(DISTINCT document_version_id)`.
  Evidence: `docs/agent/traces/2026-07-14-implement-plan-2.md`;
  tag `2026-07-14-implement-plan-2`.
- **M7.6 complete:** root `LICENSE` copied, `robots.txt` created, `/about/data`
  page lists 8 upstream sources with attribution.
- **M7.8 complete:** `WATCHDOG.yml` repointed to `intel_backend`; audit lists
  every remaining `backend_server` reference; Retired Decisions records the
  deprecation.
- **M7.9 complete:** migration 0052 adds 5 `trgm` indexes; bill, committee,
  PAC, and lobbying entity search now use similarity-first-then-`ILIKE` pattern.
## Audited Baseline

The following is a dated snapshot, not a permanent invariant. Refresh it with
the commands in the verification section before starting a milestone.

### Verified Foundations

- The local database has every committed migration applied successfully. Confirm
  the current head with `ls backend/crates/intel_backend/migrations/ | tail -1`
  instead of relying on a number written here.
- `intel_backend` exposes the canonical member, bill, committee, funding, influence, trade, portfolio, lobbying, FEC, search, relationship, financial snapshot, and system routes.
- `intel_worker` runs House discovery, download, parse, resolution, heartbeat, profile evidence, scheduled FEC bulk refresh, optional Senate eFD discovery, and SEC asset crosswalk loops.
- House Clerk documents use a durable Postgres queue, immutable document versions, parse attempts, parse issues, and official source URLs.
- FEC bulk ingestion supports candidate, committee, candidate-committee linkage, individual receipt, committee transaction, leadership-PAC, and independent-expenditure sources.
- Canonical FEC classification tests keep memos, refunds, transfers, and outside spending out of direct-receipt totals.
- `/portfolio` uses official disclosure rows and explicit coverage states.
- AIPAC and other influence networks retain verified FEC committee identifiers.
  FA-02 invalidates the current committee and network amount attribution.
- A historical `scripts/self-test` invocation passed on 2026-07-12. FA-05 and
  FA-06 invalidate it as proof of the current clean-checkout and live-runtime
  contract.

### Audit-Invalidated Claims

- The public runtime is not read-only or safely bounded. See FA-04 and FA-21.
- Influence-network financial totals are not canonical. See FA-02.
- Election race ratings and county geometry are not trustworthy. See FA-01 and FA-12.
- M4 and M5 are not complete. See FA-02, FA-07, FA-08, FA-15, FA-17, and FA-19.
- The frontend and CI green results are not current release proof. See FA-05, FA-06, and FA-23.
- House disclosure parsing and transaction persistence are not yet idempotent,
  atomic, or recall-gated. See FA-09, FA-10, and FA-24.

### Implemented But Not Proved

- Current uncommitted work adds restartable FEC staging, identity repair, supplemental sources, receipt browsing, Senate eFD discovery, annual disclosure parsing, OCR, financial snapshots, SEC asset resolution, and related frontend services and pages.
- Canonical FEC receipts, committee receipts, and operating disbursements now exist for 2022, 2024, and 2026. The 2024 bulk run is terminal `partial` because 128 malformed or unresolved source rows remain explicitly accounted for.
- The local disclosure database contains 635 financial snapshots, 53,185 asset rows, and 2,303 liability rows.
- At the 2026-07-12 19:22 EDT checkpoint, the House queue contained 2,803
  pending parse jobs, one running parse, 41 terminal download failures, and
  41,996 completed job rows. A separate 1,052 indexed rows had no download job;
  32 were supported forms and 1,020 were unsupported indexed coverage. This was
  active, incomplete source coverage.
- House annual parsing and production persistence include assets, liabilities,
  income, gifts, and outside positions with raw text, parser version, confidence,
  document-version linkage, and nullable bounds. Live normalized rows prove 1,045
  income records, 117 gifts, and 1,367 positions; the overall M2 backlog remains active.
- OCR is wired through blocking work, but scanned-document accuracy and failure recovery need live proof.
- Senate eFD live acquisition is operator-authorized, but the local
  `senate_disclosure_reports` table has no live rows until the authorized run
  completes.
  Consent-independent download versioning, transactional idempotent persistence,
  PTR/annual normalization, conservative identity resolution, retry handling,
  and distinct failure states are fixture-proved.
- `/api/fec/receipts`, `/api/fec/disbursements`, `/api/financial-snapshots`, `/api/senate-disclosures`, `/fec/receipts`, `/fec/disbursements`, `/portfolio`, and `/networth` have runtime and browser evidence. Senate remains truthfully unloaded until authorized live acquisition produces measured evidence.
- Bill amendments and a source-backed lobbying link exist, but FA-16 keeps the
  bill dossier and funding overlay open.
- Frontend helper tests exist, but they cover only a small part of the critical page state space.

### 2026-07-12 Execution Update

- The 2024 OpenFEC bulk run reached a truthful terminal `partial` state after
  seeing 79,225,774 source rows and writing 17,667,336 rows. The canonical
  warehouse now contains 13,026,377 individual receipts, 51,698 committee
  receipts, and 2,195,477 operating disbursements for 2024. The run reports 128
  malformed or unresolved source rows. A deterministic rerun finished in 40
  seconds, recognized unchanged archives, and preserved every cycle count.
- Unsupported House filing codes are now classified in bulk as explicit
  rejected coverage instead of entering PDF/OCR parsing. The remaining
  supported-form backlog is still draining, including unusually large scanned
  reports, so M2 coverage is not yet terminal.
- The refreshed M2 coverage report classifies every terminal failure as an
  official House PDF HTTP 404 after five attempts. It also measures 753 rejected
  annual-family unknown layouts, 75 partial annual forms, 597 partial PTRs, 870
  unresolved normalized annual filings, and 18,423 pending asset-identity
  reviews. These remain explicit coverage gaps rather than factual zeroes.
- The normal worker lifecycle now repairs interrupted index-to-job handoffs at
  startup and after discovery. Live deployment recovered 32 supported records
  (31 current-year at highest priority and one historical PTR), downloaded all
  32 official PDFs, and produced zero missing supported download or parse jobs.
  A second startup recovered zero rows, proving idempotency. The unrelated parse
  backlog, terminal 404s, layout gaps, and identity work keep M2 open.
- Senate discovery, HTML parsing, PDF-text parsing, shared evidence
  persistence, explicit consent states, and terminal failed source runs are
  implemented. Senate fixtures prove paginated discovery, deduplication,
  content-hash versioning, DB persistence/idempotency, PTR and annual shared
  normalization, conservative identity resolution, and distinct missing-consent,
  missing-filing, ambiguous-identity, parser-failure, and loaded states. Live
  Senate acquisition is operator-authorized; the live 2012-present run and
  shared-contract coverage proof remain pending.
- Canonical lobbying client, registrant, and lobbyist list/detail APIs and
  frontend routes are implemented. The verified 2026 sample contains 146
  clients, 81 registrants, and 166 lobbyists with official filing histories.
  Influence aliases are now separate search metadata, so searches such as
  `United Democracy Project` resolve AIPAC without rewriting official FEC
  committee IDs or names. AIPAC and NRA pass the same API and dossier flow,
  including visible committee citations and source links.
- Amendment ingestion exists, normalized amendment rows are embedded in the
  bill-intelligence response, and an explicit LDA reference to H.R. 6489 is
  stored and rendered as direct evidence. Repository and populated-dataset
  contract tests exclude heuristic or non-LDA rows from that direct channel.
- The organization detail route now exposes typed direct, derived, and
  contextual evidence without treating identifier overlap as relationship
  proof.
- CI now verifies fresh migrations and upgrade from the last committed schema,
  including idempotency and SQLx checksum/ledger checks. Local isolated-schema
  proof passed. On 2026-07-12, the disposable-database wrapper also passed both
  the empty-database and upgrade-from-`0016` paths through the then-current
  migration head, including a second idempotent migration run.
- The frontend now has a shared route registry, grouped Explore navigation,
  native command-palette semantics, explicit failure/empty/not-found states,
  a shared member-portrait contract, near-black dark mode, and a cohesive
  responsive editorial archive design. Sixty-seven frontend tests, TypeScript,
  ESLint, Oxlint, and the production build pass. Chrome MCP desktop and mobile
  screenshots cover home, navigation, legislators, committees, elections,
  candidates, net worth, portfolio, disbursements, lobbying entities,
  organizations, influence pages, and the source register. Final source-register
  captures have no page-level horizontal overflow, blank state, or console
  warning/error. FA-03, FA-05, FA-06, FA-11 through FA-17, FA-23, and FA-28
  invalidate this as final frontend release proof.
- County-detail election geography now resolves current TIGERweb county or
  county-equivalent boundaries for all 50 states, the District of Columbia,
  and AS, GU, MP, PR, and VI: 56 jurisdictions and 3,235 geometries. The API
  returns an explicit error for invalid state codes instead of a blank map.
  State selection preserves postal-abbreviation candidate rows, and fitted
  prior tests produced non-empty county path strings for all 56 jurisdictions.
  FA-12 proves that non-empty paths do not establish correct geometry and keeps
  county geography open.
- Campaign-finance visualizations now read exact canonical Schedule A, B, and E
  cycle summaries rather than the legacy transaction table. Migration `0039`
  backfilled summary rows in 130.20 seconds; the live 2024 endpoint then returned
  in 20.6 ms cold and 4.4 ms warm instead of scanning millions of rows for more
  than 60 seconds. Direct receipts, operating disbursements, independent support,
  and independent opposition remain separate channels.
- Schedule B browsing now uses a cycle/date/sub-ID index whose `NULLS LAST`
  ordering exactly matches the public query. The populated 2026 request fell
  from 4.7-5.1 seconds to 61 ms cold and 5 ms warm, and the complete populated
  API contract passed in 2.20 seconds.
- Legislator pages use the shared official Bioguide portrait fallback. For
  A000370, the loaded voting record contains 593 roll calls, 0 missed votes,
  and 586 of 592 eligible votes aligned with the member's party majority
  (98.99%) under the current formula. FA-17 invalidates that formula as final
  party-alignment proof, and FA-03 invalidates the current section lifecycle.

### Prior Verification Gate, Reopened

The earlier M0 frontend gate removed known Oxlint warnings and produced useful
screenshots. FA-05, FA-06, FA-23, and FA-28 reopen the verification gate. A
fresh isolated stack, current binary identity, hermetic CI, production-linked
tests, and complete route accessibility proof are required before it closes.

## Delivery Order

The dependency order is:

```text
M0 -> M1 and M2 in parallel -> M3
M1 -> M4
M1 + M3 + M4 -> M5
M6 gates every milestone and the final release
M6 -> M7, and M7 gates the public launch
```

M3 depends on the shared M2 evidence schema and contracts, not completion of the
House historical backfill. House and Senate backfills may run concurrently under
the interactive-safe scheduler.

## M0 - Stabilize And Prove The Current Worktree

**State:** Reopened by the 2026-07-12 fresh-eyes audit

**Goal:** Turn the current FEC and disclosure work into a clean, reproducible,
verified baseline before adding another product surface.

### Implementation

1. [x] Inventory the existing dirty worktree by concern. Preserve all user work and stage only files owned by each workstream.
2. [x] Keep runtime PDFs, FEC archives, Rust crash reports, and package-manager artifacts out of product commits. Do not delete diagnostic artifacts until their owner has confirmed they are no longer needed.
3. [x] Fix every current Oxlint accessibility warning with semantic elements and keyboard-safe interaction.
4. [x] Make `scripts/self-test` run the strongest frontend gate: helper tests, TypeScript, ESLint, Oxlint, and production build.
5. [x] Prove migrations `0001` through `0028` against a fresh database and an existing upgraded database.
6. [x] Reconcile interrupted `source_runs`, retryable FEC batches, and stuck disclosure jobs. Partial work stays partial until it reaches a truthful terminal state.
7. [x] Update `README.md`, `docs/BACKEND_REQUIREMENTS.md`, worker/disclosure docs, `docs/Log.md`, and `docs/agent/test-catalog.md` to match current behavior.
8. [x] Record baseline SQL, API responses, and verification output under `reports/verification/`.
9. [x] Close FA-04 by separating the private operator plane from every public GET path.
10. [x] Close FA-06 by making integration checks start and identify an isolated current stack.
11. [x] Close FA-25 by reconciling milestone states, tags, worksheets, and focused commits.
    Proof: the project migrated from M1-M6 milestone tags to FA-based tagging
    (see `reports/verification/milestone-tag-audit.md`). Three M2/M6 "done"
    worksheets now have tags pointing at their FA commits. In-progress worksheets
    remain untagged per the revised rule.
12. [x] Close FA-27 by reconciling or marking stale authoritative documents and reports superseded.
    Proof: `docs/agent/repo-map.md` now lists all 20 route files and migration
    count is corrected; `docs/agent/ptr-disclosures.md` is marked
    `Superseded: 2026-07-14`. `scripts/plan-lint` runs as part of
    `scripts/self-test`.

### Exit Criteria

- `scripts/self-test`, `pnpm verify`, and `git diff --check` pass.
- Fresh and upgrade migration checks pass without manual schema repair.
- No unexplained stale `running` source run or job remains.
- The verification report states which FEC cycles and disclosure sources are loaded, partial, or missing.
- Documentation no longer says that implemented FEC, OCR, annual-report, financial-snapshot, or Senate discovery code is absent.

## M1 - Complete Canonical Campaign Finance

**State:** Reopened; attribution, default browsing, partial-cycle, and delivery gates open

**Goal:** Provide complete, restartable, source-backed campaign-finance records
for the configured election cycles with honest coverage semantics.

### Implementation

1. Complete the default current-plus-two-prior-cycle refresh, including the missing 2024 cycle. Keep `FEC_CYCLES` as the explicit broader-backfill override.
   Proof: `source_runs` shows a terminal run for every required 2022, 2024, and
   2026 bulk file with zero `running` rows older than one hour; per-cycle canonical
   counts are recorded under `reports/verification/`.
2. Prove content-addressed downloads, resumable partial files, bounded streaming, restartable staging, canonicalization, amendment precedence, rankings, and staging cleanup.
   Proof: a killed-and-resumed bulk run completes without re-downloading finished
   archives (logged byte counts), a deterministic rerun adds zero canonical rows,
   and staging directories are empty afterward.
3. Resolve candidate and committee identities from official master files. Keep ambiguous or missing links in `fec_linkage_issues` and report partial coverage.
   Proof: zero canonical rows reference an unresolved identity, `fec_linkage_issues`
   counts are reported per cycle, and 20 sampled links are spot-checked against the
   official master files in the worksheet.
4. Finalize leadership-PAC and independent-expenditure supplemental ingestion under the same source-run and retry rules.
   Proof: both supplemental files have terminal source runs per configured cycle
   and a deterministic rerun adds zero rows.
5. Finalize `GET /api/fec/receipts` and `/fec/receipts` with stable pagination, filters, record classification, coverage metadata, source timestamps, warnings, and filing links.
   Proof: the live API check covers the unfiltered default, every filter, and
   pagination past page 10 within the two-second budget on the documented dataset.
6. Add canonical operating-disbursement ingestion, `GET /api/fec/disbursements`, and a matching browse page. Do not mix disbursements into receipt totals.
   Proof: `/api/fec/disbursements` and `/fec/disbursements` pass the same live
   checks, and a contract test proves disbursement amounts never enter any receipt
   total.
7. Populate member donor, committee, and influence-network rankings only from canonical cycle-complete records.
   Proof: a contract test fails when a ranking row derives from a partial cycle;
   one member's ranking rows reconcile exactly to canonical receipts in the report.
8. Keep `Totals only` and `Rankings unavailable` when a member has official totals but lacks complete canonical rankings.
   Proof: a member with official totals and incomplete rankings renders both
   states in browser proof at 1440px and 390px.
9. [x] Fix FA-02's committee and network attribution before any influence amount is public.
10. [x] Fix FA-11's default receipt query and candidate receipt links.
11. Repair resumable-download identity and archive replacement semantics; prove
    ETag or content-range validation and removal of records absent from a
    replacement archive.
    Proof: a deterministic test forces an ETag/content-range mismatch and asserts
    a full re-download; a record absent from a replacement archive is removed and
    logged with audit provenance intact.
12. Resolve or explicitly account for the current 2022 no-space failure and all
    partial 2022, 2024, and 2026 required imports.
    Proof: every required import for those cycles is terminal `success`, terminal
    `partial` with exact unresolved-row counts, or terminal `failed` with a
    source-backed reason visible in `/api/sources/status`.

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

**State:** Per-year/per-form contract accepted; parser research, implementation, historical backfill, and proof open

**Goal:** Finish House PTR and annual-statement ingestion with measured
coverage, range-safe calculations, and reviewable parser failures.

### Supported Forms

- `P`: periodic transaction reports.
- `A`, `O`, `N`, and `T`: annual, new-member, and termination-style financial reports handled by the annual parser family.
- Other Clerk filing codes remain indexed as unsupported coverage unless a parser contract is added. They must not repeatedly fail or appear as successful zero-row parses.

### Implementation

1. Drain the existing backlog with bounded download and parse concurrency while recording throughput, retries, and terminal failures.
   The required historical window is 2008 through the current date. Finish and
   validate 2018-present first, expand through 2012-2017, then backfill 2008-2011.
   Preserve per-year and per-form outcome reporting throughout; later years may
   not mask historical parser or acquisition failures.
   Proof: the queue reports zero pending supported jobs older than seven days, and
   per-year, per-form throughput, retry, and terminal-failure counts are committed
   in the M2 coverage report.
2. Maintain the implemented annual extraction and persistence for assets,
   liabilities, income, gifts, and positions; extend fixtures when a supported
   House layout produces a truthful partial or failed parse.
   Proof: the fixture suite contains at least one truthful partial and one failed
   parse per supported form family and passes in `scripts/self-test`.
3. Retain the raw source row, parser name, parser version, confidence, document version, official URL, and range text for every normalized record.
   Proof: a schema contract test asserts these fields are populated on 100% of
   normalized rows in the populated database.
4. Keep `pdftotext`, page rendering, OCR, and parser CPU work off the async runtime.
   Proof: a deterministic test asserts extraction entry points run through
   blocking or native-subprocess wrappers, and the worker heartbeat continues
   during a ten-minute OCR job.
5. Store OCR and layout failures as partial or failed parse attempts with UTF-8-safe diagnostics and manual-review records.
   Proof: a malformed fixture produces a partial or failed parse attempt with
   UTF-8-safe diagnostics and a review record, never a success state.
6. Resolve documents and filings to members before deriving member snapshots. Ambiguous identity stays unresolved.
   Proof: an ambiguous-identity fixture yields an unresolved filing and zero
   snapshots; resolution counts by year appear in the coverage report.
7. Resolve public assets through official SEC/company identifiers. Do not infer identifiers from weak name similarity.
   Proof: a weak-similarity fixture stays unresolved; every resolved asset carries
   an official identifier and source URL, counted in the review-queue report.
8. Build financial snapshots from reported asset and liability bounds with versioned calculation rules and component provenance.
   Proof: tests cover unbounded maxima, missing components producing no snapshot,
   and the personal-residence limitation; every snapshot row records its
   calculation version.
9. Correct financial API provenance so it names only the sources that contributed to each row.
   Proof: an API contract test asserts per-row provenance lists only contributing
   sources, verified live against one known multi-source member.
10. Research maintained public parsers and disclosure-ingestion repositories
    before adding another layout rule. Prefer DeepWiki when available; otherwise
    use primary repository documentation and scoped clones under `/tmp`. Record
    repository revision, license, supported form/layout, extraction technique,
    and a behavior-level comparison with the local parser. Adapt logic only
    when fixtures prove it against official documents; do not copy incompatible
    code or promote another project's assumptions without evidence.
    Prioritize repositories that parse the same House Clerk and Senate eFD forms;
    generic PDF projects are secondary references for isolated algorithms only.
    Follow `docs/features/disclosure-parser-research.md` for the candidate list,
    scoped clone protocol, comparison worksheet, and promotion gate.
    Proof: one committed comparison worksheet per candidate repository under
    `docs/features/` recording revision, license, layout coverage, and an
    adopt-or-reject decision.
11. Enforce ADR 0002's deterministic, Pi-class parser architecture. Use one
    extraction contract with resource profiles: a low-memory single-worker
    profile for Raspberry Pi-class hosts and an auto-tuned workstation profile
    for the measured Ryzen 5 3600 (6 cores/12 threads, 32 GiB RAM, SSD storage).
    Profiles may change bounded concurrency, batching, caches, and scratch-disk
    placement, but never normalized output or evidence rules.
    Production parser semantics and orchestration are Rust-only. Version-pinned
    native PDF rendering, text extraction, and OCR executables are permitted as
    bounded adapters; Python parser environments and services are not.
    Proof: both profiles produce byte-equivalent normalized output on the pinned
    benchmark corpus, and profile selection changes configuration only.
12. Add reproducible parser benchmarks covering electronic text, wrapped tables,
    scanned OCR, malformed input, and unusually large filings. The Pi-class
    profile is limited to 512 MiB RSS per worker, one worker by default, p95 at
    or below 2 seconds per text page and 15 seconds per OCR page, and a ten-minute
    document timeout. The Ryzen 5 3600 burst profile must reach p95 at or below
    250 ms per text page and 2 seconds per OCR page, avoid swap growth, and
    deliver at least four times Pi-profile throughput with byte-equivalent
    normalized records.
    Proof: a pinned-corpus benchmark run meets every stated bound and its results
    are committed under `reports/verification/`.
13. Add an interactive-safe workstation background profile that can coexist
    with arbitrary latency-sensitive or resource-heavy desktop work. It must
    reserve CPU, memory, and I/O headroom,
    never use the GPU, and defer new expensive OCR work under measured pressure
    without abandoning or duplicating in-flight jobs.
    This is the default for `./run_all.sh`, scheduled ingestion, and ordinary
    worker launches. The maximum-throughput `burst` profile requires explicit
    operator opt-in, including during historical backfills.
    Proof: the coexistence benchmark passes its reserved-headroom, no-GPU, and
    deferral-under-pressure gates, and a configuration test asserts the
    interactive-safe profile is the default launch path.
14. Implement a content-addressed deterministic parser cascade. Run the cheapest
    known-layout parser first; invoke bounding-box, ruled-line, or OCR candidates
    only after validation fails or when the source is partial, unknown-layout,
    or OCR-derived. Compare candidates field by field. Persist only validated
    agreement or one uniquely schema-valid candidate, and retain disagreements
    with both outputs and page/region provenance for review. Reuse render, text,
    bounding-box, and OCR artifacts by document hash.
    Proof: fixtures prove cheapest-parser-first ordering and disagreement
    retention with page/region provenance, and a second run over the same
    document hash performs zero new renders.
15. Build an agent-verified gold corpus of at least 300 public filings. Represent
    every supported form family and known layout era, include at least 20 filings
    per common layout and every rare layout, manually verify every successful
    OCR case through page/region evidence, retain every parser disagreement as
    a regression case, and continuously add random successful filings. Expected
    records cover filer identity, dates, assets, liabilities, income, gifts,
    positions, transactions, ownership, and amount ranges.
    Each gold filing requires two blind agent passes against rendered source
    pages. A deterministic field diff triggers a third agent only for disputed
    values. No verifier may approve parser output without inspecting the source.
    Store document hash, page number, bounding region, verifier identity,
    verification timestamp, and adjudication history for every expected field;
    periodically re-verify a random completed sample for drift.
    Proof: the corpus manifest counts at least 300 filings meeting the stated
    family and layout minimums, and every expected field stores hash, page,
    region, verifier, timestamp, and adjudication history.
16. Fingerprint unknown layouts before writing parser rules. Signatures include
    form/year, page count and dimensions, stable anchors, text-layer presence,
    token-coordinate bands, horizontal/vertical rules, inferred column count,
    OCR requirement, and image density. Cluster matching signatures into layout
    families, verify representative documents, implement one Rust strategy per
    family, and rerun it across every cluster member and the gold corpus.
    Document-specific exceptions require proof that no existing family applies.
    Proof: every unknown-layout document has a stored signature and cluster
    assignment, and each promoted family strategy passes 100% of its cluster
    members plus the gold corpus.
17. Recover terminal official 404s through alternate official URL patterns and
    official archives first, then preservation services such as the Internet
    Archive by exact official URL. Preserve original and archive URLs, response
    hash, capture timestamp, and retrieval chain. An archived PDF may produce
    canonical rows only when filing ID, filer, year, form, and document format
    validate against official index metadata; label its source state
    `archived_recovery`. Community-transcribed structured records never replace
    a missing source document. Unrecoverable 404s remain failed supported-filing
    outcomes and count against success.
    Proof: an `archived_recovery` fixture validates index metadata before any
    canonical row exists, and unrecoverable 404 counts appear per year in the
    coverage report as acquisition failures.
18. Prohibit filing-ID-specific parser branches. If a document is genuinely
    unique after layout-family analysis, store an auditable correction keyed by
    document hash with affected fields, original candidate, corrected value,
    source coordinates, reason, verifier, timestamp, and review/expiry state.
    Validate corrections against schema and gold contracts, preserve the
    original output, and retire the correction when a generalized Rust strategy
    handles the filing.
    Proof: a repository search for filing-ID literals in parser sources returns
    zero hits, and every stored correction passes the schema and gold contract
    tests with all required audit fields populated.
19. Make each document parse atomic and idempotent. Add null-safe transaction
    uniqueness, clean existing duplicate semantic rows, renew job leases, and
    require owner-checked status changes.
    Proof: migration `0041` constraints absorb a duplicate-delivery test, and a
    mid-parse kill leaves the prior canonical document version intact while a
    rerun converges with zero duplicate semantic rows (FA-09/FA-10 regression
    suites retained).
20. Enforce hard subprocess time, page, output, memory, scratch-disk, and
    document limits for text extraction, rendering, and OCR.
    Proof: resource-profile tests force each limit and assert termination within
    budget, retained from the FA-10 closure in the deterministic suite.

### Range Rules

- Preserve `NULL` maxima for unbounded categories.
- Calculate the conservative net-worth range from cross-bounds.
- Keep the personal-residence limitation visible.
- Do not calculate a snapshot when the required source components are absent.
- Do not interpret a missing annual filing as zero assets or liabilities.

### Exit Criteria

- Every supported indexed filing reaches a terminal, classified outcome.
- Every House source year from 2008 through the current year has an attributable
  terminal coverage state and measured discovery, acquisition, parse, partial,
  failure, identity, and normalized-record counts.
- At least 95% of supported filings produce useful normalized records, measured
  separately by source year and form family; no year or supported form family
  may fall below 90%.
- Terminal official-document 404s count against supported-filing success. They
  remain classified as acquisition-stage failures so pipeline observability is
  not collapsed into parser behavior.
- Unsupported Clerk filing codes remain indexed coverage and are excluded from
  the supported-filing success denominator.
- Every remaining partial or failed supported filing has a classified stage,
  layout/parser reason where applicable, official URL, and review path.
- Resolve 100% of current-member, current-year supported filings to a Member or
  an explicit reviewed ambiguity. Resolve at least 95% of normalized historical
  member-eligible filings to a Member.
- Preserve candidate, staff, and officer records as Filers without forcing a
  Member match. Never attach a financial snapshot through an ambiguous identity.
- Asset/company resolution does not block M2 completion. Unresolved assets keep
  their reported names and amount ranges in the review queue without invented
  tickers or company identifiers.
- Supported-form discovery, download, parse, identity, and snapshot counts are reported by source year and status.
- Pending and failed jobs are either completed or explained in the coverage report.
- Parser fixtures cover representative electronic, wrapped, scanned, malformed, and unsupported documents.
- `/api/financial-snapshots`, `/api/members/:id/disclosures`, `/api/stocks/transactions`, `/portfolio`, and `/networth` pass live verification.
- Desktop and 390px mobile checks have no application errors or horizontal overflow.
- Both parser hardware profiles pass their hard performance, memory, timeout,
  determinism, and no-swap-growth contracts on the documented benchmark corpus.
- The interactive-safe background profile passes a coexistence benchmark with
  bounded frame-time-impact proxies: reserved CPU capacity, bounded memory,
  low-priority I/O, and prompt admission throttling under system pressure.
- Parser promotion is measured against the gold corpus. Automatic canonical
  persistence requires 100% precision on row existence and at least 99% exact
  match on critical fields; lower-performing layout strategies remain review-only.
- Parser promotion also requires at least 99% row recall and 99% critical-field
  recall, 100% expected-section accounting, and page-level accounting for every
  supported document. One correct row cannot satisfy a multi-row filing.
- Live reruns contain no duplicate semantic transactions, and a forced failure
  during any record family leaves the prior canonical document version intact.
- Long OCR jobs renew leases; stale workers cannot overwrite replacement-worker
  completion; every subprocess terminates within its configured budget.

## M3 - Complete Senate eFD End To End

**State:** Consent-independent pipeline implemented and fixture-proved; live acquisition authorized by the operator on 2026-07-12, runtime proof pending

**Dependency:** M2

**Goal:** Normalize Senate PTR and annual reports into the same evidence model
used for House disclosures.

### Implementation

1. Keep operator consent explicit through `SENATE_EFD_ACCEPT_TERMS=1`. When consent is absent, expose a disabled coverage state instead of recording an ingestion failure.
   Proof: with consent unset, coverage reports `missing_consent` and zero
   ingestion attempts are recorded; the existing fixture states rerun live.
2. Paginate the configured date range, preserve raw search responses and hashes, extract submitted dates, and deduplicate official report IDs.
   The required historical window is January 1, 2012 through the current date.
   Prove 2025-present first, expand through the existing 2021-present window,
   then continue backward through 2012 without collapsing year-level coverage.
   Proof: live discovery persists advertised totals per year, and yearly
   discovered counts equal persisted rows plus explicit duplicates for
   2012-present.
3. Add Senate download jobs, immutable document versions, hashes, retry policy, and source-run attribution.
   Proof: an interrupted download resumes without duplicate document versions,
   with retry counts and source-run attribution visible in `/api/sources/status`.
4. Add adapters for Senate PTRs, electronic annual reports, and scanned annual reports.
   Proof: at least one live PTR, one electronic annual, and one scanned annual
   report each reach `loaded` or a truthful partial or failed state with
   diagnostics.
5. Normalize Senate records into the shared filing, transaction, asset, liability, income, gift, and position tables.
   Proof: a schema test proves Senate rows occupy the shared tables with chamber
   discrimination and no Senate-only parallel evidence tables exist.
6. Resolve Senators through official identifiers before applying conservative name/state matching. Queue ambiguous matches for review.
   Proof: resolution counts are reported by year, an ambiguous fixture stays
   queued, and zero snapshots attach through an ambiguous identity.
7. Feed Senate rows into the existing member disclosure, trade, portfolio, financial snapshot, relationship, worker-health, and coverage contracts.
   Proof: `/api/members/:id/disclosures`, trades, portfolio, and snapshots return
   Senate rows for one verified Senator in the live API check.
8. Keep `/api/senate-disclosures` as an audit and coverage listing rather than a separate product data model.
   Proof: a contract test asserts the endpoint exposes audit and coverage fields
   only, with no member-facing evidence fields absent from shared contracts.
9. Replace fixed defaults with a January 1, 2012 through current-date window,
   exhaust provider pagination, persist total records available, and reject a
   success state whenever a row cap truncates discovery.
   Proof: the truncation-simulation test rejects success, and the live run
   persists `total_records_available` equal to seen rows per year (FA-18
   regression suite retained).
10. Ensure timed-out Senate subprocesses are killed before advisory locks are released.
    Proof: the timed-out-child test asserts kill and reap before advisory unlock,
    retained from the FA-18 closure.

### Exit Criteria

- Live discovery proves pagination, raw-response preservation, and idempotency.
- Every year from 2012 through the current year has an attributable terminal
  coverage state and measured discovered, downloaded, parsed, partial, failed,
  unresolved, and normalized counts.
- Download and parse retries survive interruption without duplicate versions or rows.
- Current-Senator coverage is reported as parsed, partial, failed, or missing with an official source URL where available.
- Senate transactions and annual statements appear through the same member-facing contracts as House records.
- Missing consent, missing filings, ambiguous identity, and parser failure each have distinct tested states.

**Operator decision (2026-07-12):** The operator explicitly authorized Senate
eFD terms acceptance and live acquisition. Authorization is not treated as loaded
coverage; M3 remains open until the live exit criteria below are proved.

**Consent-independent proof (2026-07-12):** Discovery parsing, content-addressed
document versions, idempotent normalized persistence, shared disclosure tables,
parser failure retention, and conservative identity resolution are implemented.
The audit API now reports `missing_consent`, `missing_filing`,
`ambiguous_identity`, `parser_failure`, or `loaded` without collapsing these
states. Fixture tests cover PTR and annual HTML/text normalization, malformed
reports, pagination, deduplication, and the coverage-state matrix. Live discovery,
download, parsing, member resolution, and shared-contract proof now proceed under
the recorded operator authorization.

## M4 - Separate AIPAC Campaign Finance And Lobbying Evidence

**State:** Reopened; identity separation exists, financial attribution and LDA lifecycle remain unsafe

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
   Proof: a contract test asserts every network committee row carries an FEC ID,
   citation, and review date, spot-checked live for AIPAC and NRA.
2. Add canonical lobbying client, registrant, and lobbyist list/detail endpoints.
   Proof: list and detail endpoints pass the populated API contract with bounded
   pagination; the verified sample counts stay recorded in the plan.
3. Add frontend routes for lobbying clients, registrants, and lobbyists with source-backed filing histories.
   Proof: Chrome proof at 1440px and 390px for one client, one registrant, and
   one lobbyist page with filing histories and zero console errors.
4. Support AIPAC aliases during search while retaining exact source identities in stored and displayed records.
   Proof: the `United Democracy Project` alias search resolves AIPAC while stored
   and displayed identity remains the official FEC record (existing test
   retained).
5. Present AIPAC LDA filings on an organization or influence surface separate from member campaign-finance totals.
   Proof: a contract test asserts no member funding response contains an LDA
   amount, and the dossier renders LDA records on the organization surface only.
6. Replace unlabeled keyword correlations with typed evidence and visible confidence.
   Proof: every displayed relationship row carries an evidence tier and
   confidence in the contract test, and a repository search finds zero remaining
   call sites of the legacy unlabeled-correlation path.
7. Apply the same general contracts to AIPAC and every other influence network. Do not create an AIPAC-only API.
   Proof: identical API and page tests pass for AIPAC and one non-AIPAC network,
   and a repository search finds zero network-name conditionals in route code.
8. Replace the network-wide committee join and reconcile each committee to its
   own canonical direct, support, and opposition rows.
   Proof: closed under FA-02; the committee-level reconciliation regression tests
   for AIPAC and NRA remain in the deterministic suite.
9. Remove opposition spending from every amount described as received.
   Proof: a contract test asserts opposition amounts never appear in any
   received-money field (FA-02 regression suite retained).
10. Add semantic lobbying-activity uniqueness, clean existing duplicates, and
    schedule bounded LDA refresh and recovery in `intel_worker`.
    Proof: closed under FA-19; migrations `0043`-`0047` checks and the scheduled
    refresh, ownership, and continuation tests remain in the deterministic suite.

### Exit Criteria

- Tests prove that FEC and LDA amounts cannot be combined accidentally.
- AIPAC and one non-AIPAC network pass the same API and page-flow tests.
- Every displayed relationship includes source, evidence tier, confidence, and source URL where available.
- Alias search returns official records without rewriting the source identity.

**Partial evidence (2026-07-12):** Migration `0038` stores aliases separately
from canonical network and committee identity. Deterministic frontend tests and
live API tests cover AIPAC and NRA through the same contract. Chrome verified an
alias-only `United Democracy Project` search, both generic dossier routes,
official committee IDs/names, committee-level source citations, source links,
no horizontal overflow, and no console warnings or errors. Screenshots:
`reports/verification/m4-aipac-alias-desktop.png` and
`reports/verification/m4-nra-dossier-mobile.png`. FA-02, FA-19, and the
production-link gaps in FA-23 keep M4 open.

## M5 - Complete Legislative And Organization Evidence Flows

**State:** Open; core legislative links exist, but dossier, election, identity, and contextual-evidence contracts remain incomplete

**Dependencies:** M1, M3, and M4

**Goal:** Connect legislative, financial, disclosure, and lobbying evidence
through explicit contracts and provenance.

### Implementation

1. Preserve existing bill actions, sponsors, cosponsors, subjects, text versions, votes, funding overlays, and provenance.
   Proof: the populated bill contract test keeps every listed collection
   non-empty for H.R. 8205 across releases.
2. Add amendment ingestion and normalized amendment records to the existing bill-intelligence response.
   Proof: normalized amendment rows render for a bill with amendments, covered by
   the populated contract test already recorded in the partial evidence.
3. Add durable explicit LDA-to-bill and LDA-to-issue relationships. Keep heuristic matches in a separate contextual collection.
   Proof: the H.R. 6489 direct-citation test passes, and a heuristic fixture row
   is asserted into the contextual collection only.
4. Build the organization detail frontend on the existing organization and relationship backend.
   Proof: Chrome proof for one organization dossier showing typed direct,
   derived, and contextual sections at 1440px and 390px with zero console errors.
5. Support organization filtering across FEC, LDA, disclosures, committees, bills, and verified identifiers.
   Proof: live filter round trips across all five record families return counts
   that reconcile exactly to the canonical row queries for one organization.
6. Add aggregation endpoints for charts only after their canonical row contracts are stable.
   Proof: each aggregation endpoint ships with a contract test proving exact
   parity with its canonical row query on the populated dataset.
7. Enable `/visualizations` one chart at a time. Each chart requires coverage metadata, provenance, empty/error states, and a contract test.
   Proof: a configuration test asserts a chart cannot be enabled without its
   coverage metadata, truth states, and parity contract test.
8. Replace county candidate-activity coloring with the certified county-result
   contract for federal general elections from 2012 onward. Retain the current
   all-jurisdiction geometry service, ingest state-attributable result records,
   and keep upcoming candidate information in a separate state.
   Proof: certified results load for at least two states, county totals sum
   exactly to certified state totals, and representative-shape screenshot tests
   pass (closes the FA-12 geometry half and the FA-01 open half).
9. Add a source-backed Member profile-enrichment pipeline for missing education,
   professional background, public service, military service, official contact,
   and biographical facts. Store each fact independently with source, official
   URL, effective/reporting date where relevant, evidence tier, confidence,
   retrieval time, and conflict state; never overwrite a primary fact with a
   lower-tier source or turn absence into "None."
   Guarantee education (institution, degree, field, year), prior employment and
   profession, military service, prior elected/appointed offices, congressional
   timeline, documented birthplace/hometown, official contacts, committee
   leadership history, party history, professionally relevant public
   affiliations, official social accounts, a sourced summary, and a longer
   chronology. Source priority is Bioguide; official chamber/Member/committee
   records; Congressional Directory; `unitedstates/congress-legislators`; then
   attributed Wikidata/Wikimedia/Wikipedia context. Conflicts remain visible or
   reviewable and lower-tier facts never silently overwrite primary evidence.
   Proof: five representative Members show every guaranteed fact family as
   present or truthfully missing with source, tier, and retrieval time; a
   conflict fixture keeps both values visible; a contract test rejects any
   lower-tier overwrite of a primary fact.
10. Add bounded money-votes contextual evidence. Compare only verified
    industry-classified direct receipts with recorded votes tied to explicit
    policy areas and aligned cycles/dates. Reveal the underlying receipts and
    roll calls before summaries, require minimum contribution and vote samples,
    show missing-data sensitivity and falsification/non-alignment cases, label
    every result `Pattern`, produce no overall Member score, never combine LDA,
    independent expenditures, and direct receipts, and hide the pattern whenever
    either finance or vote coverage is partial.
    Proof: fixtures prove cycle alignment, minimum-sample gating, non-alignment
    and falsification cases, channel separation, and partial-coverage hiding; a
    copy audit of every rendered string finds no causal phrasing.
11. Fix FA-03 with Member-keyed request cancellation, independent section
    loading/error state, and stable URL state for every dossier section.
    Proof: closed under FA-03; the rapid-navigation and stale-response regression
    tests remain in the deterministic suite.
12. Fix FA-13 and FA-14 with complete server-paginated candidate, Member, and
    Member-trade contracts. Add candidate dossiers and preserve principal
    committee identity.
    Proof: FA-14 is closed with its regression suite retained; candidate and
    Member directories return exact totals with server filters, and one filed
    non-Member candidate dossier renders at 1440px and 390px with preserved
    principal-committee identity.
13. Implement FA-15's full financial-position card and range-first disclosure
    sections inside the Member dossier.
    Proof: one Member dossier shows the card with range, filing year, movement,
    warnings, and methodology, and each disclosure section's URL state survives
    refresh and browser back/forward in Chrome proof.
14. Fix FA-16's populated bill error, cycle and channel semantics, missing-data
    zero handling, and sponsor N+1 query path.
    Proof: closed under FA-16; the H.R. 8205 and H.R. 8770 regression tests
    remain in the populated contract suite.
15. Fix FA-17 by excluding tied party comparisons, using party at vote time,
    and returning measure-aware vote evidence.
    Proof: closed under FA-17; the tie, party-switch, amendment, nomination, and
    procedure fixtures remain in the deterministic suite.
16. Before implementing money-votes, replace the invalid committee-type design
    with a licensed donor-industry source, schema, provenance, and numeric
    contribution/vote sample thresholds. OpenSecrets cannot become canonical
    until its license and redistribution terms are recorded and accepted.
    Proof: a committed ADR records the licensed source, its terms, the schema,
    and the numeric sample gates before any money-votes implementation lands.

### Exit Criteria

- Bill amendments and explicit lobbying links are normalized, source-backed, and tested.
- Heuristic lobbying suggestions cannot appear as direct evidence.
- Organization pages expose cross-source records without treating identifier overlap as relationship proof.
- No critical evidence page reads a legacy server route, static fixture, or archived CSV.
- Every enabled visualization matches its underlying API totals on the verified dataset.
- Representative state, territory, at-large, split-county district, missing
  turnout, and uncertified-result cases prove that county maps never fabricate
  or spatially distribute unavailable vote totals.
- Representative Member dossiers prove complete profile-fact provenance,
  primary-source precedence, conflict handling, and truthful missing states for
  education, employment, service history, contact, and biography fields.
- Money-votes fixtures prove cycle alignment, minimum sample behavior,
  non-alignment/falsification cases, channel separation, underlying-record
  reconciliation, and complete-coverage gating; public copy never states or
  implies causation.

**Partial evidence (2026-07-12):** The populated API contract proved the
H.R. 6489 direct LDA citation, the normalized amendments collection, strict
direct-versus-heuristic separation, and exact 2026 visualization parity with
`fec_campaign_finance_cycle_summaries`. A source audit found no critical
evidence page reading `backend_server`, a static fixture, or an archived CSV;
the two visualization component imports from `csvUtils` use only currency
formatting. See `reports/verification/M5-EVIDENCE-CONTRACTS.md`. This evidence
covers the earlier items only and does not close FA-01, FA-03, FA-07, FA-08,
FA-12 through FA-17, or FA-28.

## M6 - Verification, CI, And Operations

**State:** Open; CI topology, stale-runtime prevention, public protection, test confidence, and full browser coverage remain incomplete

**Goal:** Make the strongest proof path routine and enforce it for every
milestone.

### Implementation

1. Add CI for backend format, clippy, check, tests, frontend tests, typecheck, ESLint, Oxlint, build, fresh migrations, and upgrade migrations.
   Proof: `.github/workflows/ci.yml` runs every listed gate and one clean-checkout
   CI run passes end to end, linked in the verification report.
2. Expand frontend tests for loading, error, empty, partial, and loaded states on every critical page.
   Proof: a registry-driven test enumerates the shared route registry and fails
   when any critical route lacks one of the five state tests.
3. Add end-to-end flows for search, member funding, FEC browsing, disclosures, net worth, lobbying, influence, bills, and organizations.
   Proof: `scripts/verify-live-api-flows` covers all nine journeys and passes
   against an isolated current-binary stack.
4. Test worker interruption, restart, duplicate delivery, rate limiting, parser failure, missing consent, missing keys, and stale source runs.
   Proof: deterministic tests cover each listed fault, and one live process-kill
   recovery exercise per release cycle is recorded in a worksheet.
5. Capture real desktop and 390px mobile navigation with screenshots, console checks, request failures, and overflow measurements.
   Proof: 1440px and 390px runs with console, request-failure, and overflow
   assertions are saved under `reports/verification/` for every critical route.
6. Maintain `docs/agent/test-catalog.md` with every test file, its claim, and its deliberate exclusions.
   Proof: a deterministic check lists test files missing from the catalog and
   reports zero.
7. Require a worksheet under `docs/agent/traces/`, a focused commit, relevant documentation, and a matching tag for each milestone. Checkpoint commits may preserve verified partial progress, but tags are strict completion markers. Apply a tag only to the exact commit containing implementation, final data/runtime/browser evidence, documentation, and worksheet, then rerun CI from that commit. Never create partial-completion milestone tags.
   A fresh-eyes audit trace dated within the prior seven days must exist before
   any milestone tag is applied. Record each applied tag in this plan as
   `Milestone tag applied: <tag> (<YYYY-MM-DD>)`.
   Proof: `scripts/plan-lint` fails any recorded milestone tag line without a
   `docs/agent/traces/fresh-eyes-audit-<date>.md` trace in the prior seven days.
8. Split deterministic unit/contract tests from live populated-data tests. CI
   starts isolated PostgreSQL, backend, and frontend instances where needed and
   never depends on an already-running local process or uncontrolled provider.
   Proof: closed under FA-05; deterministic suites pass from a clean checkout
   without provider keys, shown by the CI run in item 1.
9. Record commit SHA, binary build identity, ports, process IDs, migration head,
   and database identity for every integration report. Fail on stale or occupied
   targets.
   Proof: closed under FA-06; the verification tooling emits all six identity
   fields and rejects an intentionally occupied port in a test.
10. Add shared API input validation, pagination ceilings, request and database
    deadlines, concurrency limits, response-size limits, rate limits, and load
    shedding. Public requests cannot invoke ingestion or review work.
    Proof: abuse tests prove negative and oversized limits return 400, every list
    is clamped, and the single-machine load gate below passes with its stated
    numbers.
11. Replace silent test skips, accepted 404 paths, test-local reimplementations,
    and early-return assertions with production-linked deterministic proof.
    Proof: a committed test audit lists zero remaining skips, accepted 404s, or
    early returns, and each restored assertion is proved by a failing mutation.
12. Report freshness by source, endpoint, cycle, and canonical data family. Do
    not allow one small success to hide a partial or failed bulk run.
    Proof: a fixture holding one small success and one failed bulk cycle renders
    both truthfully in `/api/sources/status` and the UI.
13. Add loading, empty, partial, failed, stale, keyboard, accessible-name,
    skip-link, and mobile coverage for every critical route.
    Proof: the registry-driven browser run passes keyboard, accessible-name,
    skip-link, and 390px checks for every critical route, closing FA-28.

### Deterministic Reliability Proof Added 2026-07-12

- Critical frontend request classification now distinguishes loading, error,
  unavailable, empty, partial, and loaded responses. FEC disbursements preserve
  partial rows while retaining the incomplete-coverage warning.
- Worker policy tests cover interrupted-job retry versus terminal failure,
  bounded network backoff, the fixed parser-failure cooldown, HTTP 429/503 rate
  limiting, and exact Senate terms acceptance.
- Source freshness tests distinguish fresh, stale, failed, missing, and
  `auth_missing` runs without treating a missing API key as fresh evidence.
- The disposable migration test proves duplicate active delivery is absorbed by
  the worker's canonical uniqueness constraint.
- Remaining proof is intentionally not claimed here: process-kill recovery
  against a live queue, real provider rate limiting, and every critical page's
  rendered browser state still require integration/runtime coverage.

### Single-Machine Public Load Gate

- Pin the Ryzen 5 3600 host manifest, OS/kernel, PostgreSQL settings, process
  builds, database snapshot, cache state, traffic script revision, and worker
  profile in the verification report.
- Sustain 50 concurrent browsing users, 100 cached requests/second for five
  minutes, and 20 uncached dossier/API requests/second for five minutes on the
  Ryzen baseline, in one simultaneous traffic mix.
- Require at least 99.5% successful responses within the offered load. Planned
  load-shed responses above the documented excess-load threshold are measured
  separately and cannot satisfy the success floor.
- Meet p95 at or below 500 ms for cached and ordinary detail responses and two
  seconds for bounded search, graph, and aggregate responses.
- Keep public services below 8 GiB combined RSS, database connections within
  configured pools, and swap from growing during the test.
- Preserve healthy API checks, PostgreSQL availability, worker heartbeat, job
  leases, and idempotency. The interactive-safe worker may defer new OCR under
  pressure but may not lose or duplicate work.
- Shed excess traffic through cached responses or explicit `429`/`503` retry
  contracts rather than exhausting memory, swap, descriptors, or connections.
- Record p50, p95, p99, error rate, shed rate, RSS by process, CPU by process,
  database pool use, file descriptors, disk latency, swap delta, and foreground
  frame-time proxy for the full run.
- `scripts/verify-rendered-critical-pages` now starts an isolated Next server
  against an intentionally unreachable backend and verifies non-blank,
  route-specific guidance, loading, and request-failure output across search,
  member, FEC, portfolio, net-worth, lobbying, influence, bills, and
  organization routes. Loaded-data behavior remains covered by the live API
  flow and root Chrome proof rather than fabricated frontend fixtures.

### Rollback Policy

- Prefer additive migrations and additive APIs.
- Roll back application behavior by reverting the milestone commit while leaving additive evidence schema dormant.
- Do not use destructive down migrations on ingested public records.
- Keep legacy compatibility code until a call-site and contract audit proves it can be removed safely.

## M7 - Operate In Public

**State:** Open; added by the 2026-07-14 operations review

**Dependency:** M6

**Goal:** Make the single-machine deployment durable, observable, cacheable, and
legally presentable before public launch. M6 proves the software; M7 proves the
operation.

### Implementation

1. Add nightly `pg_dump` backups via a systemd timer to a device other than the
   database disk, keeping 14 daily and 8 weekly archives with a manifest of
   database identity, migration head, and size.
   Proof: two consecutive dated archives exist, and one restore drill into a
   clean PostgreSQL completes with exact row-count parity on ten named canonical
   tables, transcript committed under `reports/verification/`.
2. Define the artifact storage budget and retention policy. `/mnt/Big storage`
   is the operator-sanctioned location for disclosure PDFs and FEC bulk archives
   (the worker's `storage_dir()` already resolves there). Re-downloadable bulk
   archives may be pruned by policy; source PDFs are retained. The worker parks
   new download and OCR jobs without failing them when free space on the storage
   volume falls below 50 GiB.
   Proof: the budget table is committed in this plan, and a simulated low-disk
   test shows jobs parked with zero jobs failed and zero jobs lost.
3. Add systemd units for `intel_backend`, the Next.js frontend, and a Caddy
   reverse proxy with TLS termination, response caching, and rate limits; keep
   the existing `intel_worker` unit.
   Proof: `systemctl is-enabled` succeeds for all four units, `curl -sI` over
   HTTPS returns 200 with a valid certificate, and the M6 single-machine load
   gate passes through the proxy rather than against bare Axum.
4. Close FA-29: emit an explicit `Cache-Control` header from every public GET
   route with per-route-class max-age values, so the proxy and browsers can
   cache prepared evidence under ADR 0003.
   Proof: a route-enumeration test asserts 100% of public GET routes return the
   header, and the proxy records a cache hit ratio of at least 60% on the
   repeated-dashboard segment of the load-gate traffic script.
5. Expose operational metrics and one alert channel: per-process RSS, request
   p95 by route class, queue depth, oldest-pending-job age, and lease-renewal
   lag. Worker health must reflect wedged workers, not just heartbeat rows.
   Proof: a deliberately wedged worker holding a lease past twice the renewal
   interval flips `/api/system/worker-health` to degraded and fires the alert
   within five minutes, and the metrics endpoint returns all five series.
6. Add a root `LICENSE` and an `/about/data` page listing every upstream source
   with its terms and required attribution, plus `robots.txt` reflecting the
   read-only public plane.

   **[x] Done 2026-07-14.**
   Proof: the page renders in the browser check with one row per source (FEC,
   House Clerk, Senate eFD, LDA, Congress.gov, Voteview, TIGERweb, Bioguide),
   and `curl /robots.txt` returns the committed policy.
7. Add automated dependency updates covering cargo, npm, and GitHub Actions.
   Proof: the Dependabot or Renovate config is committed, and the first
   generated batch is triaged to merged or deferred with reasons recorded in
   `docs/Log.md`.
8. Complete the `backend_server` removal audit and repoint `WATCHDOG.yml`, which
   still cites `backend_server/src` as the routes location.

   **[x] Done 2026-07-14.**
   Proof: `docs/agent/backend-server-audit.md` is a committed audit listing
   every remaining reference by disposition, `WATCHDOG.yml` points at
   `intel_backend`, and the Retired Decisions entry (above) records the dated
   keep decision and removal criteria.
9. Move bill, committee, PAC, and lobbying entity search off leading-wildcard
   `ILIKE` onto the existing GIN and tsvector indexes, matching the member
   search path.

   **[x] Done 2026-07-14.**
   Proof: `EXPLAIN` output for each search shows index usage, and p95 stays
   within the existing two-second search budget on the populated dataset.
10. Add `generateMetadata` titles, descriptions, and OpenGraph tags to Member,
    bill, committee, and organization dossiers, plus a sitemap covering all four
    dossier types.
    Proof: `curl` of one dossier of each type contains `og:title` and a
    description tag, and the sitemap endpoint returns entries for all four
    dossier types.

### Exit Criteria

- One rehearsed restore drill has passed with exact row-count parity and its
  transcript is committed.
- The worker parks rather than fails work under the 50 GiB low-disk threshold.
- Public traffic is served through supervised units and TLS, and the load gate
  passes through the proxy.
- 100% of public GET routes emit `Cache-Control` and the 60% hit-ratio floor is
  measured (FA-29 closed).
- The wedged-worker alert fires within five minutes in a live exercise.
- Licensing, attribution, robots, dependency-update, `backend_server`, search
  index, and dossier metadata proofs above are all recorded.

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

## Verification Tooling Backlog

Active process tooling. Papercut mining shows these classes of friction cost
more repeated time than any product defect; they are in scope now, not deferred.
Each item carries its Proof like a milestone item.

- `scripts/plan-lint` (implemented 2026-07-14): deterministic plan consistency
  check run by `scripts/self-test`.
  Proof: it reports zero findings on this document, and a seeded regression
  (flipping one Closed ledger row back to High) makes `scripts/self-test` fail.
- `scripts/db-query`: credential-safe read-only SQL wrapper that loads
  `DATABASE_URL` itself so agents never touch `.env` in shell commands.
  Proof: `scripts/db-query "SELECT 1"` succeeds in an agent session with no
  sensitive-path hook rejection.
- `scripts/db-schema <table>`: prints column names and types from
  `information_schema` before any operational SQL is written.
  Proof: output for `source_runs` matches `\d source_runs` field for field.
- Runtime freshness guard: a shared preamble for live proofs that fails when the
  running binary or `.next` build is older than the newest source commit.
  Proof: a deliberately stale binary fails the guard and a rebuilt binary
  passes, demonstrated in one recorded run.
- `command-watchdog` exit-code fix: classification must prioritize the exit code
  over output text.
  Proof: a command printing "error" that exits 0 is classified success, and a
  silent command exiting 1 is classified failure.

## Deferred Backlog

Deferred work remains visible but does not block the active roadmap.

### Per-Dossier Change Feeds

Precomputed RSS/Atom feeds per Member, committee, and organization covering new
filings, new votes, range movements, and coverage changes. Fits the read-only
plane because feeds are prepared artifacts. Promote only with a measured
per-feed generation cost, a cache policy, and a feed-content contract test that
reconciles feed entries to canonical rows.

### Public Bulk Exports

Nightly precomputed CSV/JSON dumps per dataset directory with a manifest of
generation date, row counts, and source-run coverage. Promote only with a
committed manifest schema, a per-dataset size ceiling, and an export-to-canonical
row-count parity check.

### Citation Permalinks

A "cite this record" affordance on evidence rows: stable URL, content hash,
retrieval date, and upstream official URL. Promote only with a permalink
resolution contract test and a guarantee that cited URLs survive schema
migrations unchanged.

### Public Coverage Dashboard

A public page reading the `source_runs` ledger: loaded, partial, stale, and
failed coverage by source, year, and form. Promote only when its counts
reconcile exactly to `/api/sources/coverage` in a contract test.

### Member Comparison View

Two Members side by side: shared roll calls with positions, channel-separated
funding, and disclosure ranges. Requires no new data. Promote only with a
contract test proving both columns read the same canonical queries as the
individual dossiers and ranges remain range-first.

### Published API Documentation

An OpenAPI specification and docs page for the read-only public API. Promote
only when the spec is generated or verified against the axum router so it
cannot drift, proved by a route-parity test.

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
- `backend_server` is deprecated in favor of `intel_backend` as the canonical API server. Dated keep decision 2026-07-14: the crate is retained, not deleted, until no live-guidance doc directs work to it and one release cycle passes with `WATCHDOG.yml` pointing at `intel_backend`. See `docs/agent/backend-server-audit.md` for the full reference inventory and removal criteria.

## Completion Definition

The master plan is complete when M0 through M7 satisfy every exit criterion,
FA-01 through FA-29 have reproducible closure evidence, all required sources
have measured terminal coverage, critical user flows pass
live desktop and mobile checks, deferred work remains explicitly deferred, and
the final verification report can reproduce every public claim from source
records, code, or command output.
