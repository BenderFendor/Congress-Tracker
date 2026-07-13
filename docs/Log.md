# Project Change Log

This log records changes to public behavior, developer workflows, data
contracts, and verification requirements. It does not replace Git history or
the detailed worksheets under `docs/agent/traces/`.

## 2026-07-12 - Election Filing Semantics And Receipt Query Truth

- Removed race ratings, party lean, and competitiveness claims derived from
  FEC candidate filing counts; the election atlas now labels these records as
  filings and explicitly says they are not results or forecasts.
- Added explicit classification for common FEC Democratic, Republican, and
  independent party codes.
- Preserved absent receipt amount filters instead of converting them to zero
  and changed candidate receipt links to the canonical search parameter.
- Added deterministic regression tests plus loaded desktop and mobile Chrome
  evidence. Certified state and county result ingestion remains open.

## 2026-07-12 - Hermetic And Isolated Verification Topology

- Split deterministic frontend tests from populated live API flows so default
  tests and CI no longer require or accidentally reuse a backend on port 4020.
- Added an explicit live API wrapper that builds the current backend and runs it
  on an isolated port before testing the representative populated database.
- Replaced the stale Senate coverage assertion with the current explicit state
  contract and made the live suite fail closed when the wrapper is bypassed.
- Kept provider-backed and populated integration flows out of default CI while
  compiling them and running deterministic database contracts separately.

## 2026-07-12 - Fresh-Eyes Audit Fused Into Master Plan

- Consolidated all 28 fresh-eyes audit findings into the living implementation
  plan with stable IDs, severity, milestone owners, and closure proof.
- Reopened M0, M1, M4, M5, and M6 where live evidence invalidated earlier
  completion or verification claims.
- Added explicit remediation for public read-only separation, influence
  attribution, Member request isolation, disclosure atomicity, worker leases,
  county results, dossier completeness, hermetic CI, and bounded public load.
- Removed the duplicate standalone audit. Its original commit and worksheet
  remain historical evidence.

## 2026-07-12 - Roadmap Grilling And Domain Contracts

- Reworked the open M2/M3/M5/M6 plan through a one-question-at-a-time product
  and architecture interview grounded in live coverage evidence.
- Accepted full House 2008-present and Senate 2012-present coverage, strict
  per-year/per-form outcomes, Member identity thresholds, archived recovery,
  deterministic Rust-owned parser semantics, Pi/Ryzen performance gates,
  interactive-safe scheduling, layout-family clustering, dual-agent gold
  verification, and auditable document corrections.
- Defined a public-first dossier product with a discovery dashboard, read-only
  public data plane, complete Member/committee/candidate dossiers, certified
  county results, range-first net worth, reported-holdings portfolio semantics,
  guided influence flows, profile enrichment, contextual money-votes patterns,
  and one editorial design/motion system.
- Added ADRs for deterministic Pi-class parsing and the read-only public data
  plane, expanded the domain glossary, and added the revision-pinned parser
  prior-art research workflow.
- Confirmed milestone tags are strict completion markers; checkpoint commits may
  preserve partial progress without claiming milestone completion.

## 2026-07-12 - Repeatable Critical Rendered-Route Smoke Gate

- Added an isolated rendered-route smoke command covering search, member,
  receipts, disbursements, portfolio, net worth, lobbying, influence, bills,
  and organization pages without requiring fabricated records.
- Expanded the live API flow suite for disbursements, member disclosures,
  bill evidence, organization relationships, and separated influence finance
  channels.
- Kept loaded browser interaction and visual proof separate because those need
  the real populated backend and Chrome rather than deterministic error-state
  fixtures.

## 2026-07-12 - Supported House Queue Recovery

- Added an idempotent worker recovery sweep that converts supported House index
  records missing a download job into normal queue work at startup and after
  each discovery pass.
- Added matching parse-job recovery for immutable document versions whose
  index-to-parse handoff was interrupted.
- Prioritized current-year recovery ahead of historical backlog without
  reopening terminal failures or unsupported filing types.
- Live worker startup recovered and downloaded 32 missing supported records;
  a second startup recovered zero, and post-run coverage had no missing
  supported download or parse jobs.

## 2026-07-12 - Deterministic Worker Recovery and Partial UI States

- Centralized worker decisions for retry exhaustion, retry delay, response
  classification, and Senate consent, then attached focused unit tests to those
  production paths.
- Added explicit stale and missing-key source freshness tests.
- Proved duplicate active job delivery is conflict-safe in the disposable
  migration database.
- Added a frontend partial request state and used it on FEC disbursements so
  incomplete but loaded rows remain visible without becoming a complete or
  empty claim.

## 2026-07-12 - Complete State and Territory Election Drill-Down

- Kept map selection in Census FIPS while resolving selected candidate and
  district records through their FEC postal abbreviation.
- Replaced the county drill-down's contiguous-U.S.-only projection with a
  jurisdiction-fitted projection so county paths render for the five supported
  territories as well as all states and DC.
- Added deterministic coverage requiring a non-empty projected county path for
  all 56 supported jurisdictions and explicit FIPS-to-postal filtering tests.
- Verified live Guam and American Samoa county paths in Chrome with no
  document-level horizontal overflow. The stopped backend produced the page's
  expected request-error logs while independent county geography still loaded.

## 2026-07-12 - Final Integration Proof and Canonical Agent Paths

- Standardized concurrent-agent coordination at `docs/agent/hey.md` and moved
  all non-trivial task worksheets to `docs/agent/traces/`.
- Re-ran the disposable PostgreSQL migration gate through migration `0040`.
  Both a fresh database and an upgrade from the committed `0016` boundary
  passed, including idempotent second runs.
- Rebuilt the frontend after the source-register nullable-state repair. The
  Next.js production build, type and lint stages, and `git diff --check` passed.
- Verified `/data-sources` in Chrome MCP at desktop and mobile widths. The page
  had no document-level horizontal overflow, blank state, console warning, or
  console error; missing sources render `Not loaded` rather than `null written`
  or a factual zero.
- Recorded the active House worker state rather than declaring the disclosure
  warehouse complete: 3,331 pending, 16 active, and 41 failed jobs at the
  2026-07-12 18:17 EDT checkpoint.
- Preserved the immutable checksum of applied portrait migration `0036` and
  added `0037` to normalize lowercase Bioguide portrait paths. The upgrade test
  now seeds a lowercase identifier and asserts the canonical uppercase URL.
- Added `0039` exact FEC cycle and sector summaries after Chrome exposed a
  greater-than-60-second visualization request. The one-time canonical backfill
  completed in 130.20 seconds; indexed live requests measured 20.6 ms cold and
  4.4 ms warm. Fresh and upgrade migration verification and the full repository
  self-test passed after this change.
- Added `0040` with the exact `DESC NULLS LAST` Schedule B browse index after
  the populated API contract reproduced a 4.7-second parallel scan. The final
  endpoint measured 61 ms cold and 5 ms warm; the full populated API contract,
  fresh/upgrade migration gate, and repository self-test passed afterward.

## 2026-07-12 - Legislator Vote Evidence and Completeness States

- Replaced the invalid party-code comparison with a roll-call party-majority calculation.
- Added party-alignment eligibility counts and vote coverage dates to the member votes contract.
- Reworked legislator Votes, Bills, and Biography evidence states while preserving shared official portrait fallback.

## 2026-07-12 - Influence Network Evidence Map

- Replaced the static influence illustration with responsive, source-backed
  committee, FEC channel, and recipient graphs.
- Kept direct contributions, independent support, and independent opposition
  separate and added an API-total reconciliation state.
- Added official FEC committee links, member dossier links, coverage notes,
  confidence and source labels, reduced-motion behavior, and explicit FEC/LDA
  separation.
- Added deterministic influence financial transformation tests and Chrome MCP
  desktop and mobile screenshot verification.

## 2026-07-12 - Committee Portrait Roster

- Replaced the committee membership table with a responsive portrait roster
  that separates source-designated leadership from the full membership list.
- Added official Bioguide portraits with initials fallbacks, exact role and
  rank labels, party and district context, chamber labels, and direct links to
  legislator accountability profiles.
- Preserved explicit invalid, not found, request failure, retry, and empty
  roster states.
- Verified the Homeland Security roster in Chrome MCP at desktop and 390px
  mobile sizes with inspected screenshots, 42 linked cards, no horizontal
  overflow, and no console warnings or errors.

## 2026-07-12 - Shared Frontend Revamp

- Refined the shared archive visual system with stronger editorial hierarchy,
  consistent responsive gutters, semantic metrics, clearer evidence actions,
  and restrained motion with reduced-motion support.
- Improved LDA directories with deferred filtering, clear-search actions,
  progressive ledger rendering, and more useful result context.
- Added context bars and top-aligned evidence rails to LDA and organization
  detail views to preserve research continuity and remove mobile dead space.
- Harmonized candidate and disbursement surfaces with the navy archive system
  and compacted their desktop and mobile filter layouts without changing their
  request truth states.
- Verified representative desktop and 390px mobile layouts in Chrome MCP with
  screenshots, no page-level horizontal overflow, and no console errors.

## 2026-07-12 - Truthful Home And Influence States

- Kept successful zero counts distinct from failed requests on the home page.
- Removed fabricated influence affiliation and election-cycle fallbacks.
- Constrained the home-page observatory to the 390px viewport and disabled
  delayed section reveals on small screens so evidence remains readable.
- Verified the updated pages through Chrome MCP and inspected desktop and
  mobile screenshots after data loading completed.

## 2026-07-12 - Three-Cycle FEC Coverage And Browse Performance

- Completed the 2024 FEC bulk run with measured partial coverage: 13,026,377
  individual receipts, 51,698 committee receipts, and 2,195,477 operating
  disbursements; 128 malformed or unresolved source rows remain explicit.
- Proved the unchanged-archive rerun completed without count drift or duplicate
  canonicalization.
- Removed the full-table Schedule B window count, used the maintained cycle
  count for unfiltered browsing, and moved filtered text queries onto the
  existing full-text index.
- Measured populated 2024 Schedule B requests at 1.08 seconds unfiltered and
  578 ms filtered on the documented local dataset.

## 2026-07-12 - Live Schema And Member Portrait Repairs

- Restored the derived `stock_trades` materialized view after populated API
  verification found that the live schema had drifted from its migration
  ledger. The rebuilt view contains 25,200 normalized disclosure transactions.
- Corrected Congress.gov member ingestion so metadata API URLs are no longer
  stored as image URLs.
- Canonicalized current member portraits to official Bioguide URLs and added a
  shared frontend resolver that advances through valid supplied image,
  Bioguide, and initials fallbacks.
- Pointed the Data Sources page at the canonical `/api/sources/status` contract
  instead of the nonexistent legacy admin route.

## 2026-07-11 - Stronger Frontend Verification Gate

- Replaced non-semantic command-palette and election-map interaction roles with native dialog, button, figure, output, and live-region behavior.
- Fixed every existing Oxlint accessibility warning without changing the visible navigation or election data flow.
- Changed `scripts/self-test` to run `pnpm verify`, which includes frontend helper tests, TypeScript, ESLint, Oxlint, and the production build.
- Verified the full backend and frontend self-test successfully.
- Browser proof remains pending because Chrome MCP could not find a running Chrome `DevToolsActivePort`.

## 2026-07-11 - Migration And Source-Run Audit

- Proved migrations `0001` through `0028` in an empty isolated schema and confirmed all 28 SQLx migration records succeeded.
- Confirmed the live database upgraded from migration `0016` through `0028` while preserving members, earlier source runs, and canonical FEC rows.
- Added `scripts/source-run-audit`, a read-only-by-default ledger, heartbeat, and queue report with an explicit stale-run repair mode.
- Reconciled 38 abandoned source runs while preserving the active 2024 FEC and Congress.gov processes.

## 2026-07-11 - Current Pipeline Documentation

- Updated the README and backend contract document for canonical FEC receipt browsing, House annual parsing, OCR, financial snapshots, and staged Senate discovery.
- Updated testing and workflow docs for the strict frontend gate and scheduled FEC bulk cycle window.
- Updated worker and disclosure docs for bounded concurrency, supported annual forms, OCR, current migrations, financial snapshots, and independent heartbeat behavior.
- Kept incomplete income, gift, position, Senate parsing, disbursement, and browser-proof work explicit.

## 2026-07-11 - Runtime Artifact Hygiene

- Added narrow ignore rules for worker PDF storage, Rust compiler crash reports, and npm lockfiles in this pnpm-only repository.
- Kept `papercuts.md` trackable as the project friction ledger.

## 2026-07-11 - Independent Worker Heartbeat

- Moved worker heartbeat writes out of the main download/parse select loop.
- Slow OCR, download, and parse batches can no longer make a live worker disappear from the five-minute health window.
- Proved heartbeat ages stayed below 30 seconds during a live 65.761-second parse batch, then requeued the verification worker's interrupted jobs explicitly.

## 2026-07-11 - Profile Evidence Runtime Repairs

- Paginated OpenFEC candidate refreshes into provider-supported pages of at most 100 rows without narrowing the requested total.
- Deduplicated organization derivation inputs and matched FEC identifiers to their exact PAC type before relationship evidence refresh.
- Proved a 101-row candidate refresh and a 60,147-row live relationship derivation successfully.

## 2026-07-12 - Annual Income, Gift, And Position Parsing

- Extended the House annual parser and worker persistence to normalized income, gift, and outside-position records.
- Preserved parser name, parser version 1.1, confidence, raw text, document version, filing, owner, and reported monetary bounds.
- Proved the new families against three immutable official House filings and corrected live-found header and fixed-column defects before acceptance.
# 2026-07-12 - Normalized LDA Entity Workflows

- Added stable lobbyist normalization and filing links from official Senate LDA identifiers.
- Added client, registrant, and lobbyist list/detail APIs with official filing histories.
- Added matching frontend routes with entity-family navigation, progressive results, responsive motion, and explicit LDA/FEC separation.
- Added a UI and UX audit plus Chrome desktop and 390px verification evidence.
- Fixed Senate source runs so acquisition failures finish terminally and added PDF text parsing off the async runtime.

## 2026-07-12 - Research Destination Navigation

- Replaced duplicated global route lists with one typed research-destination registry.
- Kept five core research rails in the desktop header and grouped the remaining campaign-finance, lobbying, and evidence destinations under Explore.
- Exposed every M1 through M5 destination in the command palette and mobile navigation with plain-language descriptions and search aliases.
- Upgraded the command palette to a native modal dialog with combobox/listbox semantics, active-option announcements, Escape handling, and opener focus restoration.
- Verified the rendered navigation in Chrome at 1440px and 390px with screenshots, keyboard interaction, zero horizontal overflow, and no console warnings or errors.
# 2026-07-12: Candidate and disbursement truth states

- Candidate and committee directories now load independently, preserve filters during retry, and distinguish request failure from a successful filtered empty result.
- Candidate directory tabs and filters now expose accessible names and tab semantics.
- FEC disbursements now keeps coverage, request failure, and loaded empty states mutually exclusive, exposes the supported amount filters, and no longer parses blank numeric parameters as zero.
- Added desktop and 390px Chrome screenshots under `reports/verification/` with no horizontal overflow or page console errors.

## 2026-07-12 - Election County Geography Repair

- Fixed the election atlas county transition so a selected county remains on
  the state's county map.
- Added a state-scoped Next API route backed by the official Census TIGERweb
  county layer with a 30-day framework cache and explicit provenance.
- Added a state selector, searchable county directory, truthful not-loaded
  result states, primary-source links, and reduced-motion-safe map transitions.
- Added deterministic county acquisition tests and verified the live API plus
  desktop and 390px Chrome flows without horizontal overflow or clean-tab
  console errors.
- Expanded the authoritative jurisdiction registry to 56 entries: 50 states,
  DC, and five U.S. territories supported by TIGERweb and us-atlas.
- Changed state acquisition to cached, simplified TIGERweb GeoJSON so all
  3,235 current county equivalents use matching names and geometry.
- Verified every jurisdiction endpoint returned nonempty, state-scoped Polygon
  or MultiPolygon features. Chrome switching from CA to PA to TX updated paths
  and directory rows without stale state geometry.

## 2026-07-12 - Financial Research Surface Revamp

- Rebuilt the candidate and PAC directories around official FEC identifiers,
  progressive record lists, compact filters, source links, and independent
  request truth states.
- Replaced the net-worth table with a filterable disclosure-range ledger that
  preserves unbounded values, calculation timestamps, methodology warnings,
  and personal-residence exclusions.
- Reframed Portfolio Overview as committee and filing context rather than
  valuation, with a portrait-led member coverage roster and explicit sector
  methodology language.
- Added deterministic filter and range-label tests, corrected mobile compact
  masthead sizing, and inspected six Chrome screenshots at 1440px and 390px.

## 2026-07-12 - Reference Editorial Cohesion

- Restyled the source register and methodology as numbered civic record
  indexes using the shared editorial serif, mono metadata, rules, and archive
  materiality without embedding the supplied reference images.
- Added an explicit source-freshness request failure state and aligned lobbying
  list and detail content to the shared archive width.
- Made all three Portfolio tabs visible at 390px and allowed long metric states
  to wrap without clipping.
- Verified representative desktop and mobile Chrome screenshots with no page
  overflow or console warnings and errors.
- Centralized dark mode on near-black and charcoal surfaces while retaining
  cobalt and warm-red evidence accents.
- Added a shared member portrait resolver and migrated legislator cards,
  legislator detail heroes, committee rosters, and Portfolio member rows. The
  resolver rejects Congress API JSON metadata URLs and follows a deterministic
  valid-source, Bioguide, then initials fallback chain.

## 2026-07-12 - Influence Alias And Parity Contract

- Added search-only influence-network aliases without changing canonical
  network names or exact FEC committee IDs and names.
- Made each committee's confidence, role, FEC link, and source citation visible
  in the influence evidence map.
- Proved AIPAC and NRA against the same live API and generic dossier route
  contract, and proved `United Democracy Project` alias search in Chrome.
- Verified desktop and mobile layouts without horizontal overflow or console
  warnings and errors; evidence is under `reports/verification/`.
# 2026-07-12 - M5 evidence-contract closure

- Embedded normalized Congress.gov amendment rows in the canonical bill-intelligence response and rendered them on bill pages.
- Rendered explicit LDA bill citations separately from keyword-derived lobbying suggestions.
- Restricted direct bill citations to direct, source=`lda`, non-heuristic evidence in SQL and Rust.
- Added populated-dataset proof for H.R. 6489 and campaign-finance visualization parity with canonical cycle summaries.
