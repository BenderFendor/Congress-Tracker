# Backend Requirements And Current Contracts

CongressTracker uses `backend/crates/intel_backend` as the canonical API. Pages should not call Congress.gov, OpenFEC, LDA, CapitolTrades, or static CSV fixtures directly from the UI. Ingestion writes normalized rows to Postgres; frontend routes read those rows through stable backend endpoints.

## Canonical Page Endpoints

| Page | Endpoint |
|------|----------|
| Home | `GET /api/home/summary`, `GET /api/sources/status`, `GET /api/sources/coverage` |
| Legislators | `GET /api/legislators`, `GET /api/legislators/:bioguide_id` |
| Member intelligence | `GET /api/members/:bioguide_id/votes`, `GET /api/members/:bioguide_id/legislation`, `GET /api/members/:bioguide_id/disclosures` |
| Bills | `GET /api/bills`, `GET /api/bills/:bill_id`, `GET /api/bills/:congress/:bill_type/:bill_number/intel` |
| Influence | `GET /api/influence/networks`, `GET /api/influence/networks/:slug`, `GET /api/influence/networks/:slug/financials` |
| Committees | `GET /api/committees`, `GET /api/committees/:committee_id` (including `roster` and referred `bills`) |
| Stocks | `GET /api/stocks/transactions`, `GET /api/intel/trades/:ticker` |
| Portfolios | `GET /api/intel/portfolio/summary`, `GET /api/intel/portfolio/members`, `GET /api/intel/portfolio/sectors`, `GET /api/intel/portfolio/pulse` |
| Lobbying | `GET /api/lobbying/filings`, `GET /api/lobbying/filings/:id` |
| Elections | `GET /api/elections/candidates` |
| Search | `GET /api/search` |
| Evidence graph | `GET /api/relationships`, `GET /api/organizations/:organization_id` |

## Required Behavior

- Do not silently fall back to mock or static records.
- If an API key or ingestion source is missing, show an empty, error, or setup state.
- Every row returned by page APIs must come from normalized database tables or a clearly labeled source status endpoint.
- `source_runs` is the freshness ledger. New ingest jobs must create and finish source runs. Source coverage labels each source `fresh`, `stale`, `missing`, or `failed` using its registered TTL.
- `refresh-relationships` deterministically derives evidence edges from normalized committees, bills, FEC transactions, and trade rows. It records the source row and never infers a negative relationship from missing data.
- Relationship rows must include an evidence tier (`direct`, `derived`, or `contextual`), confidence, and source provenance. A missing row is not evidence of no relationship.
- Portfolio values must remain range-aware. Do not invent exact balances or returns from congressional disclosures.

## Known Remaining Backend Gaps

- Official annual House statements and Senate eFD financial disclosure ingestion are still needed for full portfolio holdings.
- `house-ptr` parses official House periodic transaction report PDFs into range-aware transaction rows. `disclosure-manifest` records other official filing metadata and provenance.
- An `organization-manifest` ingest command records canonical organizations and source identifiers for SEC/FEC/LDA crosswalks. Crosswalk presence alone must not create a member relationship.
- Lobbying clients, registrants, and lobbyist search have canonical storage but only filings are exposed as page routes.
- FEC receipts/disbursements need canonical list endpoints before the receipts page can be promoted to a required tab.
- Member votes and sponsorships now have canonical relational endpoints; frontend pages must not reconstruct either relationship through search or the legacy server.
- Influence charts, net-worth estimates, visualizations, and organization detail remain intentionally unavailable until their canonical source records are ingested.
- The visualizations page is intentionally an unavailable state until canonical relationship/activity rows are ingested; it does not read legacy CSV fixtures.
