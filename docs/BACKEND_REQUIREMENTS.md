# Backend Requirements And Current Contracts

CongressTracker uses `backend/crates/intel_backend` as the canonical API. Pages should not call Congress.gov, OpenFEC, LDA, CapitolTrades, or static CSV fixtures directly from the UI. Ingestion writes normalized rows to Postgres; frontend routes read those rows through stable backend endpoints.

## Canonical Page Endpoints

| Page | Endpoint |
|------|----------|
| Home | `GET /api/home/summary`, `GET /api/sources/status` |
| Legislators | `GET /api/legislators`, `GET /api/legislators/:bioguide_id` |
| Bills | `GET /api/bills`, `GET /api/bills/:bill_id`, `GET /api/bills/:congress/:bill_type/:bill_number/intel` |
| Influence | `GET /api/influence/networks`, `GET /api/influence/networks/:slug`, `GET /api/influence/networks/:slug/financials` |
| Committees | `GET /api/committees`, `GET /api/committees/:committee_id` |
| Stocks | `GET /api/stocks/transactions`, `GET /api/intel/trades/:ticker` |
| Portfolios | `GET /api/intel/portfolio/summary`, `GET /api/intel/portfolio/members`, `GET /api/intel/portfolio/sectors`, `GET /api/intel/portfolio/pulse` |
| Lobbying | `GET /api/lobbying/filings`, `GET /api/lobbying/filings/:id` |
| Elections | `GET /api/elections/candidates` |
| Search | `GET /api/search` |

## Required Behavior

- Do not silently fall back to mock or static records.
- If an API key or ingestion source is missing, show an empty, error, or setup state.
- Every row returned by page APIs must come from normalized database tables or a clearly labeled source status endpoint.
- `source_runs` is the freshness ledger. New ingest jobs must create and finish source runs.
- Portfolio values must remain range-aware. Do not invent exact balances or returns from congressional disclosures.

## Known Remaining Backend Gaps

- Official House/Senate financial disclosure ingestion is still needed for full portfolio holdings.
- Lobbying clients, registrants, and lobbyist search have canonical storage but only filings are exposed as page routes.
- FEC receipts/disbursements need canonical list endpoints before the receipts page can be promoted to a required tab.
- The visualizations page still has legacy CSV fallback text and is not part of the required tab set.
