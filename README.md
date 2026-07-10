# Congress Accountability Tracker

CongressTracker is a full-stack congressional accountability app. It tracks Congress as a political-economic system: legislators, bills, committees, lobbying filings, elections, campaign finance, stock disclosures where available, portfolio-style disclosure summaries, influence networks, and global search.

The app must not present mock data as real data. Missing source keys or empty ingests should show honest empty/setup states.

## Stack

- Backend: Rust + Axum in `backend/crates/intel_backend`
- Frontend: Next.js 14 + TypeScript + Tailwind in `frontend/`
- Database: Postgres, normalized through `intel_backend` migrations

`backend/crates/backend_server` is older code. New page features should use `intel_backend`.

## Data Sources

- `unitedstates/congress-legislators`: current members, terms, identifiers, committees, committee memberships
- Congress.gov API: bills, sponsors, actions, official source URLs
- OpenFEC API: candidates, committees, campaign finance entities
- Senate LDA API: lobbying filings, clients, registrants, issue codes
- House Clerk financial disclosures: official PTR index and PDFs ingested by `intel_worker`
- CapitolTrades adapter: legacy/manual compatibility boundary; the canonical portfolio path uses official disclosure rows

## Canonical API

The frontend reads from `http://localhost:4020` by default.

| Page | Backend endpoint |
|------|------------------|
| Home | `/api/home/summary`, `/api/sources/status` |
| Legislators | `/api/legislators`, `/api/legislators/:bioguide_id` |
| Member intelligence | `/api/members/:bioguide_id/votes`, `/api/members/:bioguide_id/legislation`, `/api/members/:bioguide_id/disclosures` |
| Relationships and organizations | `/api/relationships`, `/api/organizations/:organization_id` |
| Source coverage | `/api/sources/status`, `/api/sources/coverage` |
| Bills | `/api/bills`, `/api/bills/:bill_id` |
| Influence | `/api/influence/networks`, `/api/influence/networks/:slug` |
| Committees | `/api/committees`, `/api/committees/:committee_id` |
| Stocks | `/api/stocks/transactions` |
| Portfolios | `/api/portfolios`, `/api/intel/portfolio/*` |
| Lobbying | `/api/lobbying/filings`, `/api/lobbying/filings/:id` |
| Elections | `/api/elections/candidates` |
| Search | `/api/search` |

## Local Run

1. Create a local Postgres database named `congress_tracker` owned by user `congress_tracker`.
2. Provide these environment variables to backend commands:
   - `DATABASE_URL`
   - `CONGRESS_GOV_API_KEY`
   - `OPENFEC_API_KEY`
   - `SENATE_LDA_API_KEY`
3. Run source ingests:

```bash
cd backend
cargo run -p intel_backend --bin ingest -- members --current-only --limit 100
cargo run -p intel_backend --bin ingest -- influence-seeds
cargo run -p intel_backend --bin ingest -- congress-bills --congress 119 --limit 50
cargo run -p intel_backend --bin ingest -- fec-candidates --cycle 2024 --limit 100
cargo run -p intel_backend --bin ingest -- lobbying-filings --year 2025 --page-size 25 --limit-pages 2
cargo run -p intel_backend --bin ingest -- disclosure-manifest --source house_disclosures --path ./data/house-disclosures.jsonl
cargo run -p intel_backend --bin ingest -- organization-manifest --source sec_company_identity --path ./data/company-identities.jsonl
cargo run -p intel_backend --bin ingest -- house-ptr --pdf-path ./raw/house/20030494.pdf --bioguide-id F000472 --filing-id 20030494 --source-url https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2025/20030494.pdf
cargo run -p intel_backend --bin ingest -- house-ptr-url --url https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2025/20030494.pdf --output-path ./raw/house/20030494.pdf --bioguide-id F000472 --filing-id 20030494
cargo run -p intel_backend --bin ingest -- refresh-relationships
cargo run -p intel_backend --bin ingest -- refresh-materialized-views
```

`disclosure-manifest` imports one JSON object per line with an official filing URL and optional member/report metadata. It records documents as pending or parsed; it does not invent holdings or transaction values. House and Senate download/parsing jobs should produce this manifest and then populate the normalized holding and transaction tables.

`organization-manifest` imports canonical organization records plus identifiers such as SEC CIK, FEC committee ID, or LDA client/registrant ID. Identifier values are source-scoped evidence and are never treated as proof of a member relationship by themselves.

`intel_worker` is the canonical continuous PTR path. It discovers the Clerk TSV index, queues supported periodic transaction reports, stores immutable PDF versions, parses range-aware transactions, resolves members, and refreshes the materialized trade view. The manual `house-ptr-url` command remains useful for a single known filing. Both paths keep the official filing URL and reject unanchored rows instead of guessing.

4. Start the backend:

```bash
cd backend
cargo run -p intel_backend --bin intel_backend
```

5. Start the frontend:

```bash
cd frontend
NEXT_PUBLIC_BACKEND_URL=http://localhost:4020 pnpm dev
```

Frontend: `http://localhost:3000`

Backend: `http://localhost:4020`

## Verification

```bash
scripts/self-test
cd frontend && npm run build
```

Useful runtime checks:

```bash
curl http://127.0.0.1:4020/api/health
curl http://127.0.0.1:4020/api/home/summary
curl http://127.0.0.1:4020/api/sources/status
curl 'http://127.0.0.1:4020/api/bills?limit=10'
curl 'http://127.0.0.1:4020/api/lobbying/filings?limit=10'
curl 'http://127.0.0.1:4020/api/elections/candidates?limit=10'
curl 'http://127.0.0.1:4020/api/search?q=health&limit=5'
```

Browser verification artifacts can be stored under `reports/verification/`.

## Known Limits

- The automated worker currently ingests House periodic transaction reports. Annual disclosure sections, scanned-document OCR, and Senate eFD ingestion remain explicit gaps.
- Member vote and sponsorship pages read only canonical relational records; missing rows are shown as unavailable rather than inferred from search.
- Stocks and portfolio pages must stay empty or caveated until real disclosure rows exist.
- Voteview and Wikidata are registered as sources but are not required for the core smoke dataset.
- The visualizations route is outside the required tab set and still needs a separate cleanup pass.

## License

MIT. Give credit.
