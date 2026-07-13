# CongressTracker Living Master Implementation Plan

This document is the execution roadmap for CongressTracker. It records the
verified baseline, the work still in progress, dependency order, public
contracts, and the proof required to finish each milestone. Refresh the dated
baseline before relying on its counts.

**Last repository audit:** 2026-07-12

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

| ID | Severity | Owner | Finding | Required closure proof |
|---|---|---|---|---|
| FA-01 | Critical | M5 | Election Safe, Likely, Tilt, and Toss-up ratings come from candidate filing counts rather than certified results. FEC `DEM` and `REP` values are also misclassified. | Remove filing-count race ratings; ingest certified results; reconcile state and county totals; pass semantic and Chrome tests. |
| FA-02 | Critical | M1, M4 | Influence committee totals use network-wide rows, can exceed the network total, and treat opposition spending as money received. | Rebuild committee-specific channel queries; prove direct, support, and opposition reconciliation for AIPAC and another network. |
| FA-03 | Critical | M5 | Client navigation can display one Member's evidence under another Member's dossier. | Cancel or key every request by Member; clear old section state; add rapid-navigation and stale-response tests. |
| FA-04 | Critical | M0, M6 | Public funding GETs can start OpenFEC ingestion and writes; public county GETs fetch TIGERweb; the admin review queue is public and unbounded. | Move ingestion and review to private operator paths; serve prepared county data; clamp every list; prove public routes are read-only and bounded. |
| FA-05 | Critical | M6 | Frontend CI runs live API tests without a backend; backend CI runs external-source smoke ingestion without required keys. | Split deterministic and live suites; start isolated dependencies explicitly; pass CI from a clean checkout without uncontrolled provider calls. |
| FA-06 | Critical | M0, M6 | Prior green integration evidence used a stale backend process. | Start uniquely versioned current binaries on isolated ports; record commit and binary identity; reject occupied stale ports. |
| FA-07 | Critical | M5 | M5 was labeled complete although M3 and major M5 requirements remain open. | Keep M5 open until every M5 exit criterion and dependency passes. |
| FA-08 | Critical | M5 | The money-votes design names cycle and recipient-committee-type summaries as donor-industry data; the documented `network_type` column does not exist. | Approve a licensed donor-industry source and schema; define numeric sample gates; reconcile every pattern to receipts and votes. |
| FA-09 | Critical | M2 | Nullable transaction conflict keys permit duplicate semantic rows; annual and PTR persistence is not document-atomic; one row can mark a partial filing parsed. | Add null-safe uniqueness and cleanup; use document-scoped transactions; require section, page, row, and confidence completeness before success. |
| FA-10 | Critical | M2, M6 | Worker leases are not renewed and OCR subprocesses have no hard time, page, output, memory, disk, or ownership bounds. | Add lease renewal and owner-checked completion; enforce subprocess and resource budgets; pass kill/retry and Pi/Ryzen coexistence tests. |
| FA-11 | High | M1 | The default receipts page converts absent amount bounds to zero and candidate links use the wrong search parameter. | Test an unfiltered default request, filter round trips, candidate links, result totals, and latency. |
| FA-12 | High | M5 | County results are absent and projected county rings can render as full-extent complement rectangles. | Normalize geometry, compare representative shapes and bounds, load certified results, and add screenshot plus exact-total tests. |
| FA-13 | High | M5 | Candidate and Member directories silently truncate; candidate committee fields are discarded; candidate dossiers do not exist. | Add paginated totals and server filters, preserve committee identity, cover every current Member, and implement candidate dossiers. |
| FA-14 | High | M5 | Member trade history filters the first 200 global trades in the browser. | Add a Member-keyed paginated backend query and prove known early and late warehouse records. |
| FA-15 | High | M5 | Member dossiers omit the financial-position card and detailed holdings, liabilities, income, transactions, and history. | Implement the full range-first dossier contract with independent URL-addressable states and source reconciliation. |
| FA-16 | High | M5 | Bill detail has a populated-data 500, combines cycles and finance channels, and has a sequential sponsor N+1 path. | Fix numeric decoding; cycle-match and separate channels; bound queries; pass a large-sponsor bill and known missing-crosswalk case. |
| FA-17 | High | M5 | Party-line alignment chooses a majority on ties, uses current party for historical votes, and vote rows omit measure context. | Exclude ties; use party at vote time; add measure-aware vote contracts and tie, switch, amendment, nomination, and procedure fixtures. |
| FA-18 | High | M3 | Senate discovery defaults to 2021-2026, stops at 1,000 rows, and can mark truncated discovery successful. | Use an open-ended 2012-present window, exhaust pagination, prove year-level terminal counts, and reject truncated success. |
| FA-19 | High | M4 | Lobbying activity insertion is append-only and the worker has no scheduled LDA refresh. | Add semantic idempotency, clean duplicates, schedule bounded refresh and recovery, and prove rerun stability. |
| FA-20 | High | M5 | All-Member legislation ingestion does not paginate, drops request and row errors, and can declare partial work successful. | Exhaust provider pagination, retain per-Member failures, and require terminal Member-level coverage. |
| FA-21 | High | M6 | The public API has no rate, concurrency, timeout, response-size, or load-shedding protection; several limits accept negative or huge values. | Enforce shared request budgets and bounded pagination, then pass the single-machine load and abuse cases. |
| FA-22 | High | M6 | Source status can hide failed bulk cycles behind a small successful request; disclosure coverage counts attempts and duplicates as completion. | Report source, endpoint, cycle, and document-version coverage separately; reconcile UI totals to canonical ledgers. |
| FA-23 | High | M6 | Several tests exercise test-only literals, accept 404, skip without a database, or return before their central assertion. | Link each claimed contract to production code and add negative mutations or equivalent confidence proof. |
| FA-24 | High | M2 | Parser promotion specifies precision but no recall, expected-row, missed-page, or expected-section threshold. | Add row and field recall, page and section completeness, and omission-focused gold-corpus gates. |
| FA-25 | High | M0, M6 | Milestone states and the annotated M0-M6 tag claim completion without the required focused commits, current worksheets, or passing gates. | Treat old tags as historical evidence; create new milestone tags only after every current exit criterion passes. |
| FA-26 | High | M2, M6 | Pi, workstation, and public-load gates omit reproducible hardware, corpus, success-rate, traffic-mix, and foreground-impact definitions. | Pin hardware and corpus manifests, repetitions, response-success floor, traffic mix, and foreground degradation limits. |
| FA-27 | High | M0 | The plan, backend requirements, agent docs, test catalog, and reports contradict current behavior and source state. | Reconcile or mark every stale document superseded; add a deterministic documentation consistency check. |
| FA-28 | Medium | M5, M6 | Most routes lack complete loading and error coverage; election SVG controls are unnamed; the global skip link misses three pages. | Cover every critical route and truth state; pass keyboard, accessible-name, skip-link, desktop, and 390px browser checks. |

## Audited Baseline

The following is a dated snapshot, not a permanent invariant. Refresh it with
the commands in the verification section before starting a milestone.

### Verified Foundations

- The local database has migrations through `0040` applied successfully.
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
  the empty-database and upgrade-from-`0016` paths through migration `0040`,
  including a second idempotent migration run.
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
9. [ ] Close FA-04 by separating the private operator plane from every public GET path.
10. [ ] Close FA-06 by making integration checks start and identify an isolated current stack.
11. [ ] Close FA-25 by reconciling milestone states, tags, worksheets, and focused commits.
12. [ ] Close FA-27 by reconciling or marking stale authoritative documents and reports superseded.

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
2. Prove content-addressed downloads, resumable partial files, bounded streaming, restartable staging, canonicalization, amendment precedence, rankings, and staging cleanup.
3. Resolve candidate and committee identities from official master files. Keep ambiguous or missing links in `fec_linkage_issues` and report partial coverage.
4. Finalize leadership-PAC and independent-expenditure supplemental ingestion under the same source-run and retry rules.
5. Finalize `GET /api/fec/receipts` and `/fec/receipts` with stable pagination, filters, record classification, coverage metadata, source timestamps, warnings, and filing links.
6. Add canonical operating-disbursement ingestion, `GET /api/fec/disbursements`, and a matching browse page. Do not mix disbursements into receipt totals.
7. Populate member donor, committee, and influence-network rankings only from canonical cycle-complete records.
8. Keep `Totals only` and `Rankings unavailable` when a member has official totals but lacks complete canonical rankings.
9. Fix FA-02's committee and network attribution before any influence amount is public.
10. Fix FA-11's default receipt query and candidate receipt links.
11. Repair resumable-download identity and archive replacement semantics; prove
    ETag or content-range validation and removal of records absent from a
    replacement archive.
12. Resolve or explicitly account for the current 2022 no-space failure and all
    partial 2022, 2024, and 2026 required imports.

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
2. Maintain the implemented annual extraction and persistence for assets,
   liabilities, income, gifts, and positions; extend fixtures when a supported
   House layout produces a truthful partial or failed parse.
3. Retain the raw source row, parser name, parser version, confidence, document version, official URL, and range text for every normalized record.
4. Keep `pdftotext`, page rendering, OCR, and parser CPU work off the async runtime.
5. Store OCR and layout failures as partial or failed parse attempts with UTF-8-safe diagnostics and manual-review records.
6. Resolve documents and filings to members before deriving member snapshots. Ambiguous identity stays unresolved.
7. Resolve public assets through official SEC/company identifiers. Do not infer identifiers from weak name similarity.
8. Build financial snapshots from reported asset and liability bounds with versioned calculation rules and component provenance.
9. Correct financial API provenance so it names only the sources that contributed to each row.
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
11. Enforce ADR 0002's deterministic, Pi-class parser architecture. Use one
    extraction contract with resource profiles: a low-memory single-worker
    profile for Raspberry Pi-class hosts and an auto-tuned workstation profile
    for the measured Ryzen 5 3600 (6 cores/12 threads, 32 GiB RAM, SSD storage).
    Profiles may change bounded concurrency, batching, caches, and scratch-disk
    placement, but never normalized output or evidence rules.
    Production parser semantics and orchestration are Rust-only. Version-pinned
    native PDF rendering, text extraction, and OCR executables are permitted as
    bounded adapters; Python parser environments and services are not.
12. Add reproducible parser benchmarks covering electronic text, wrapped tables,
    scanned OCR, malformed input, and unusually large filings. The Pi-class
    profile is limited to 512 MiB RSS per worker, one worker by default, p95 at
    or below 2 seconds per text page and 15 seconds per OCR page, and a ten-minute
    document timeout. The Ryzen 5 3600 burst profile must reach p95 at or below
    250 ms per text page and 2 seconds per OCR page, avoid swap growth, and
    deliver at least four times Pi-profile throughput with byte-equivalent
    normalized records.
13. Add an interactive-safe workstation background profile that can coexist
    with arbitrary latency-sensitive or resource-heavy desktop work. It must
    reserve CPU, memory, and I/O headroom,
    never use the GPU, and defer new expensive OCR work under measured pressure
    without abandoning or duplicating in-flight jobs.
    This is the default for `./run_all.sh`, scheduled ingestion, and ordinary
    worker launches. The maximum-throughput `burst` profile requires explicit
    operator opt-in, including during historical backfills.
14. Implement a content-addressed deterministic parser cascade. Run the cheapest
    known-layout parser first; invoke bounding-box, ruled-line, or OCR candidates
    only after validation fails or when the source is partial, unknown-layout,
    or OCR-derived. Compare candidates field by field. Persist only validated
    agreement or one uniquely schema-valid candidate, and retain disagreements
    with both outputs and page/region provenance for review. Reuse render, text,
    bounding-box, and OCR artifacts by document hash.
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
16. Fingerprint unknown layouts before writing parser rules. Signatures include
    form/year, page count and dimensions, stable anchors, text-layer presence,
    token-coordinate bands, horizontal/vertical rules, inferred column count,
    OCR requirement, and image density. Cluster matching signatures into layout
    families, verify representative documents, implement one Rust strategy per
    family, and rerun it across every cluster member and the gold corpus.
    Document-specific exceptions require proof that no existing family applies.
17. Recover terminal official 404s through alternate official URL patterns and
    official archives first, then preservation services such as the Internet
    Archive by exact official URL. Preserve original and archive URLs, response
    hash, capture timestamp, and retrieval chain. An archived PDF may produce
    canonical rows only when filing ID, filer, year, form, and document format
    validate against official index metadata; label its source state
    `archived_recovery`. Community-transcribed structured records never replace
    a missing source document. Unrecoverable 404s remain failed supported-filing
    outcomes and count against success.
18. Prohibit filing-ID-specific parser branches. If a document is genuinely
    unique after layout-family analysis, store an auditable correction keyed by
    document hash with affected fields, original candidate, corrected value,
    source coordinates, reason, verifier, timestamp, and review/expiry state.
    Validate corrections against schema and gold contracts, preserve the
    original output, and retire the correction when a generalized Rust strategy
    handles the filing.
19. Make each document parse atomic and idempotent. Add null-safe transaction
    uniqueness, clean existing duplicate semantic rows, renew job leases, and
    require owner-checked status changes.
20. Enforce hard subprocess time, page, output, memory, scratch-disk, and
    document limits for text extraction, rendering, and OCR.

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
2. Paginate the configured date range, preserve raw search responses and hashes, extract submitted dates, and deduplicate official report IDs.
   The required historical window is January 1, 2012 through the current date.
   Prove 2025-present first, expand through the existing 2021-present window,
   then continue backward through 2012 without collapsing year-level coverage.
3. Add Senate download jobs, immutable document versions, hashes, retry policy, and source-run attribution.
4. Add adapters for Senate PTRs, electronic annual reports, and scanned annual reports.
5. Normalize Senate records into the shared filing, transaction, asset, liability, income, gift, and position tables.
6. Resolve Senators through official identifiers before applying conservative name/state matching. Queue ambiguous matches for review.
7. Feed Senate rows into the existing member disclosure, trade, portfolio, financial snapshot, relationship, worker-health, and coverage contracts.
8. Keep `/api/senate-disclosures` as an audit and coverage listing rather than a separate product data model.
9. Replace fixed defaults with a January 1, 2012 through current-date window,
   exhaust provider pagination, persist total records available, and reject a
   success state whenever a row cap truncates discovery.
10. Ensure timed-out Senate subprocesses are killed before advisory locks are released.

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
2. Add canonical lobbying client, registrant, and lobbyist list/detail endpoints.
3. Add frontend routes for lobbying clients, registrants, and lobbyists with source-backed filing histories.
4. Support AIPAC aliases during search while retaining exact source identities in stored and displayed records.
5. Present AIPAC LDA filings on an organization or influence surface separate from member campaign-finance totals.
6. Replace unlabeled keyword correlations with typed evidence and visible confidence.
7. Apply the same general contracts to AIPAC and every other influence network. Do not create an AIPAC-only API.
8. Replace the network-wide committee join and reconcile each committee to its
   own canonical direct, support, and opposition rows.
9. Remove opposition spending from every amount described as received.
10. Add semantic lobbying-activity uniqueness, clean existing duplicates, and
    schedule bounded LDA refresh and recovery in `intel_worker`.

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
2. Add amendment ingestion and normalized amendment records to the existing bill-intelligence response.
3. Add durable explicit LDA-to-bill and LDA-to-issue relationships. Keep heuristic matches in a separate contextual collection.
4. Build the organization detail frontend on the existing organization and relationship backend.
5. Support organization filtering across FEC, LDA, disclosures, committees, bills, and verified identifiers.
6. Add aggregation endpoints for charts only after their canonical row contracts are stable.
7. Enable `/visualizations` one chart at a time. Each chart requires coverage metadata, provenance, empty/error states, and a contract test.
8. Replace county candidate-activity coloring with the certified county-result
   contract for federal general elections from 2012 onward. Retain the current
   all-jurisdiction geometry service, ingest state-attributable result records,
   and keep upcoming candidate information in a separate state.
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
10. Add bounded money-votes contextual evidence. Compare only verified
    industry-classified direct receipts with recorded votes tied to explicit
    policy areas and aligned cycles/dates. Reveal the underlying receipts and
    roll calls before summaries, require minimum contribution and vote samples,
    show missing-data sensitivity and falsification/non-alignment cases, label
    every result `Pattern`, produce no overall Member score, never combine LDA,
    independent expenditures, and direct receipts, and hide the pattern whenever
    either finance or vote coverage is partial.
11. Fix FA-03 with Member-keyed request cancellation, independent section
    loading/error state, and stable URL state for every dossier section.
12. Fix FA-13 and FA-14 with complete server-paginated candidate, Member, and
    Member-trade contracts. Add candidate dossiers and preserve principal
    committee identity.
13. Implement FA-15's full financial-position card and range-first disclosure
    sections inside the Member dossier.
14. Fix FA-16's populated bill error, cycle and channel semantics, missing-data
    zero handling, and sponsor N+1 query path.
15. Fix FA-17 by excluding tied party comparisons, using party at vote time,
    and returning measure-aware vote evidence.
16. Fix FA-20 by exhausting legislation pagination and retaining per-Member
    request, row, and terminal coverage states.
17. Before implementing money-votes, replace the invalid committee-type design
    with a licensed donor-industry source, schema, provenance, and numeric
    contribution/vote sample thresholds. OpenSecrets cannot become canonical
    until its license and redistribution terms are recorded and accepted.

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
FA-12 through FA-17, FA-20, or FA-28.

## M6 - Verification, CI, And Operations

**State:** Open; CI topology, stale-runtime prevention, public protection, test confidence, and full browser coverage remain incomplete

**Goal:** Make the strongest proof path routine and enforce it for every
milestone.

### Implementation

1. Add CI for backend format, clippy, check, tests, frontend tests, typecheck, ESLint, Oxlint, build, fresh migrations, and upgrade migrations.
2. Expand frontend tests for loading, error, empty, partial, and loaded states on every critical page.
3. Add end-to-end flows for search, member funding, FEC browsing, disclosures, net worth, lobbying, influence, bills, and organizations.
4. Test worker interruption, restart, duplicate delivery, rate limiting, parser failure, missing consent, missing keys, and stale source runs.
5. Capture real desktop and 390px mobile navigation with screenshots, console checks, request failures, and overflow measurements.
6. Maintain `docs/agent/test-catalog.md` with every test file, its claim, and its deliberate exclusions.
7. Require a worksheet under `docs/agent/traces/`, a focused commit, relevant documentation, and a matching tag for each milestone. Checkpoint commits may preserve verified partial progress, but tags are strict completion markers. Apply a tag only to the exact commit containing implementation, final data/runtime/browser evidence, documentation, and worksheet, then rerun CI from that commit. Never create partial-completion milestone tags.
8. Split deterministic unit/contract tests from live populated-data tests. CI
   starts isolated PostgreSQL, backend, and frontend instances where needed and
   never depends on an already-running local process or uncontrolled provider.
9. Record commit SHA, binary build identity, ports, process IDs, migration head,
   and database identity for every integration report. Fail on stale or occupied
   targets.
10. Add shared API input validation, pagination ceilings, request and database
    deadlines, concurrency limits, response-size limits, rate limits, and load
    shedding. Public requests cannot invoke ingestion or review work.
11. Replace silent test skips, accepted 404 paths, test-local reimplementations,
    and early-return assertions with production-linked deterministic proof.
12. Report freshness by source, endpoint, cycle, and canonical data family. Do
    not allow one small success to hide a partial or failed bulk run.
13. Add loading, empty, partial, failed, stale, keyboard, accessible-name,
    skip-link, and mobile coverage for every critical route.

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
FA-01 through FA-28 have reproducible closure evidence, all required sources
have measured terminal coverage, critical user flows pass
live desktop and mobile checks, deferred work remains explicitly deferred, and
the final verification report can reproduce every public claim from source
records, code, or command output.
