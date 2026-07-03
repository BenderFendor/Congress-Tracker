# Verification Report

Generated: 2026-07-03

## Runtime

- Backend: `intel_backend` on `http://localhost:4020`
- Frontend: Next dev server on `http://localhost:3000`
- Database: local Postgres `congress_tracker`

## Commands

- `scripts/self-test`
- `cd frontend && npm run build`
- Congress.gov key probe: `GET https://api.congress.gov/v3/bill?limit=1&format=json`
- OpenFEC key probe: `GET https://api.open.fec.gov/v1/candidates/?per_page=1`
- Senate LDA key probe: `GET https://lda.senate.gov/api/v1/filings/?page_size=1`
- `cargo run -p intel_backend --bin ingest -- members --current-only --limit 25`
- `cargo run -p intel_backend --bin ingest -- influence-seeds`
- `cargo run -p intel_backend --bin ingest -- congress-bills --congress 119 --limit 25`
- `cargo run -p intel_backend --bin ingest -- fec-candidates --cycle 2024 --limit 50`
- `cargo run -p intel_backend --bin ingest -- lobbying-filings --year 2025 --page-size 25 --limit-pages 1`
- `cargo run -p intel_backend --bin ingest -- refresh-materialized-views`

## Endpoint Proof

- `GET /api/health` returned `{"status":"ok","db":true,"cache_size":0}`
- `GET /api/home/summary` returned counts: 537 legislators, 25 bills, 49 committees, 25 lobbying filings, 81 candidates, 0 stock transactions.
- `GET /api/sources/status` returned successful latest runs for Congress.gov, OpenFEC, Senate LDA, manual influence seeds, and unitedstates legislators.
- `GET /api/bills?limit=2` returned real Congress.gov bill records.
- `GET /api/lobbying/filings?limit=2` returned real Senate LDA filing records.
- `GET /api/elections/candidates?limit=2` returned OpenFEC candidate records.
- `GET /api/search?q=health&limit=5` returned grouped committee search results.

## Database Counts

- members: 537
- member_terms: 2792
- committees: 49
- committee_memberships: 1747
- bills: 25
- bill_sponsors: 30
- fec_candidates: 81
- fec_committees: 10
- lobbying_filings: 25
- lobbying_activities: 54
- influence_networks: 13
- stock_trades: 0
- source_runs: 31

## Browser Proof

Chrome DevTools loaded these routes with screenshots and DOM snapshots saved in this folder:

- `/`
- `/legislators`
- `/bills`
- `/influence`
- `/committees`
- `/stocks`
- `/portfolio`
- `/lobbying`
- `/elections`
- `/search`

Home mobile emulation at `390x844` had `overflowX: false`.

## Known Limits

- Stock transactions are empty because official House/Senate disclosure/PTR ingestion is not yet implemented.
- Portfolio pages show real member/committee aggregation and honest stock caveats, not brokerage-style fake balances.
- Voteview and Wikidata sources are registered but not populated by the smoke ingest.
- Browser console had no application errors after the hydration fix; remaining dev console output was Vercel analytics debug logging.
