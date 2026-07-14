# Learnings

## 2026-04-30 — Trade interface mismatch caused empty portfolio data

Context:
- The portfolio page showed 12 trades, 0 buy/sell orders, and N/A for most-traded ticker
- Backend was returning 35,095 total trades with rich nested data

What worked:
- Adding `BackendTrade` interface matching the real API response shape
- Creating `mapBackendTrade` adapter that translates backend fields to frontend flat fields
- Adding `size`/`page` query params to the backend trades handler

What failed:
- The frontend `Trade` interface assumed flat field names (`type`, `ticker`, `representative`) but backend returned nested structure (`txType`, `asset.assetTicker`, `politician.firstName`)

Future agents should:
- Always validate API response shapes against frontend interfaces
- When adding new API consumers, check the actual response with `curl` before building the frontend interface

---

## 2026-04-30 — Congress.gov API shape mismatches in proxy member mapping

Context:
- Legislator detail pages showed "Data Unavailable" despite successful proxy calls
- Error: `Cannot read properties of undefined (reading 'includes')`

What worked:
- Adding fallback chain in `mergeProxyMember`: `member.name || member.directOrderName || ...`
- Fixing `terms` type from `{ item: [...] }` to direct `Array<{chamber}>`
- Extracting party from `partyHistory` array instead of flat `partyName`

What failed:
- `CongressProxyMember` type assumed fields that don't exist in the API response
- The `terms` structure was wrong — API returns a flat array, not a nested object with `item`
- No runtime validation between the proxy response and the member type

Future agents should:
- Check Congress.gov API responses with curl before writing TypeScript types
- The Congress.gov member endpoint returns: `firstName`, `lastName`, `directOrderName`, `invertedOrderName`, `partyHistory[]`, `terms[]` (flat array), `depiction.imageUrl`, `officialWebsiteUrl`
- No flat `name`, `partyName`, or `url` fields on the member object

---

## 2026-04-30 — Congress.gov proxy used wrong API key

Context:
- `CONGRESS_API_KEY` in `.env.local` was set to the OpenFEC key value
- Proxy sent key as `api_key=` query param instead of `X-Api-Key` header

What worked:
- Using `X-Api-Key` header (matches `bills.ts` pattern)
- Looking up `CONGRESS_GOV_API_KEY` in env var fallback chain

What failed:
- Wrong key value (OpenFEC key, not Congress.gov key) in `.env.local`
- Wrong env var name (`CONGRESS_API_KEY` instead of `CONGRESS_GOV_API_KEY`)

Future agents should:
- Always test API keys directly with curl before debugging frontend issues
- Verify env var naming matches what `.env.example` documents

---

## 2026-07-03 — Canonical source-run and LDA provider typing checks

Context:
- LDA ingestion failed after the live API returned fields with mixed JSON types.
- Successful source ingests appeared stuck as `running` because source-run completion errors were swallowed.
- A browser verification script changed URLs with `history.pushState` but left the Home route rendered.

What worked:
- Testing provider keys with direct `curl` requests before debugging application code.
- Using `serde_path_to_error` to identify the exact provider field causing decode failure.
- Keeping mixed LDA fields as JSON values at the provider boundary.
- Casting source-run status updates with `$1::source_run_status`.
- Running real browser URL navigations for route verification.

Future agents should:
- Treat source-run completion as part of ingest correctness; do not ignore finish errors.
- Expect Senate LDA fields such as `client_government_entity` and `registrant_different_address` to vary by row.
- Do not use `history.pushState` alone as proof that a Next route rendered.
# 2026-07-10 — Profile evidence ingestion belongs to the worker lifecycle

Context:
- Member profiles silently depended on manual source commands and exposed empty ideology, vote, bill, funding, and disclosure sections.

What worked:
- Use one scheduled aggregate command under a PostgreSQL advisory lock, keep each source represented in `source_runs`, and run the aggregate outside the worker's main select loop.
- Use Voteview's Congress-specific CSVs and load ICPSR crosswalks once per run.

What failed:
- Voteview all-history files plus per-vote identifier queries were too slow for routine refreshes.
- Hard-coded CSV indexes had drifted from Voteview's published headers.

Future agents should:
- Treat published CSV headers as contracts and test representative rows.
- Keep ingestion idempotent, bounded, failure-isolated, and automatic; manual commands are diagnostics only.

# 2026-07-11 — Disclosure and FEC warehouse guardrails

What worked:
- Bounded Tokio task sets improved House downloads measurably while keeping parser concurrency at two; `spawn_blocking` is required for pdftotext, OCR, and parser CPU work.
- House annual PDF text can interleave asset values with adjacent income columns. Parse only the first value range and reject inverted bounds before persistence.
- FEC receipt browsing needs precomputed cycle counts; a window count over millions of canonical rows made the public endpoint exceed 18 seconds.
- Senate eFD discovery must keep the terms gate explicit and stage official report links before parsing.

Future agents should:
- Keep backfill discovery incremental so one large Clerk index does not block downloads, parsing, and resolution.
- Treat impossible FEC dates as unresolved source data rather than emitting dates outside the congressional reporting window.
- Preserve nullable upper bounds for unbounded disclosure categories and never turn missing coverage into zero totals.
- Keep public lobbying search parameters broad enough to match registrants, clients, and issue text; a UI search that silently maps to one field creates false empty states.
- Truncate parser diagnostics on UTF-8 character boundaries; byte slicing unknown-layout text can panic the worker and stop an otherwise healthy backfill.

# 2026-07-12 — M0-M6 end-to-end verification patterns

Context:
- Completed full M0-M6 implementation plan verification across backend, frontend, and database
- Ran browser verification on 11 critical routes at 1440px without errors
- All 66 backend tests pass, 8 frontend tests pass, production build succeeds

What worked:
- Adding missing struct fields to fix cross-module compilation errors (raw_text on ParsedPtrTransaction for senate_efd)
- Following existing route handler patterns when adding new endpoints (lobbying clients/registrants follow the same Query/Response convention as filings)
- CI workflow matches the exact commands from scripts/self-test for consistency
- Parallel subagents for M1/M2/M3 investigation produced ~4,200 lines of functional code without breaking compilation

What failed:
- Full self-test timed out at 600s due to compile-from-scratch (target directory cleaned); individual checks all pass
- 2024 FEC cycle ingestion still in `running` state — code is correct but runtime depends on external API completion
- Senate eFD pipeline requires SENATE_EFD_ACCEPT_TERMS=1 — code exists and compiles but live execution needs operator consent

Future agents should:
- Run individual verification commands (cargo check, cargo test, pnpm typecheck, pnpm build) rather than the monolithic self-test when the build cache is cold
- Prefer adding new route handlers that follow existing Query/Response patterns rather than inventing new conventions
- Verify cross-module compilation after adding struct fields that are consumed in other modules
- Check the ingestion state (source_runs, ingest_jobs) when a data-dependent endpoint returns empty — the code may be correct but the data may not be loaded
## 2026-07-12 - Prepared public geography artifacts

Context:
- County drill-downs need stable Census geometry, but a read-only public route
  must not acquire provider data or depend on provider uptime.

What worked:
- Store one compact, normalized artifact per validated jurisdiction under the
  static application data tree, preserve source and preparation provenance,
  and keep provider acquisition in an operator-only atomic preparation script.

What failed:
- Framework revalidation on a public proxy still performs provider work in the
  request plane and reports request time rather than dataset preparation time.

Future agents should:
- Treat public cache configuration as delivery policy, not an ingestion
  mechanism. Test public routes structurally for provider calls and writes.

## 2026-07-13 - Congress.gov Member legislation is a mixed evidence stream

Context:
- The official sponsored/cosponsored endpoints advertise bills and amendments
  in one paginated count. Amendment rows retain an official URL but may have
  null bill-style type, number, title, and policy fields.

What worked:
- Count every raw row for pagination, use valid bill identities or normalized
  official URLs for duplicate detection, and preserve every accepted row in a
  generic Member-legislation evidence ledger.
- Upsert one provider page in one database transaction. Three bulk statements
  replace hundreds of per-record round trips while keeping bill, sponsor, and
  evidence writes atomic at page scope.
- Separate provider completeness (`rows_seen`) from successful item persistence
  (`rows_written`) and reported duplicate rows. Publish `loaded` only when raw
  provider rows equal unique persisted evidence plus explicitly collapsed
  duplicates.

Future agents should:
- Do not model mixed provider rows as one non-null bill struct.
- Preserve official amendment and other measure URLs even when the bill fields
  are absent, and expose those records on the Member dossier.
- Keep normal refresh concurrency profile-aware: one stream during gaming/Pi
  use, two balanced, and four only as an explicit burst ceiling.
- Keep response-body parsing inside the retry loop. A successful response head
  can still end in a timed-out or truncated body.
- Adapt page size only for size-sensitive request/body/decode failures. Typed
  authentication and permanent client errors should stop the bounded active
  wave instead of triggering four versions of the same invalid request.
- Derive safety bounds from live distributions. Congress 119 includes Member
  roles above 10,000 rows; the verified maximum was 17,397, so the contract uses
  a still-bounded 50,000 ceiling.
- Sort page writes before bulk persistence and retry only PostgreSQL deadlock or
  serialization failures. Never count writes until the transaction commits.
- Treat watchdog interruption as a recovery test. The initial four-hour run
  peaked at 82,028 KiB and was resumed under the same source-run ID; the final
  250-second continuation peaked at 49,432 KiB and preserved loaded roles.
