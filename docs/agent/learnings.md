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
