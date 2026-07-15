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
- FEC bulk files and OpenFEC API: canonical receipts, committee transfers, leadership PACs, outside spending, candidates, and committees
- Senate LDA API: lobbying filings, clients, registrants, issue codes
- House Clerk financial disclosures: official PTR and annual-report indexes and PDFs ingested by `intel_worker`
- Senate eFD: terms-gated official report discovery; download and parsing remain incomplete
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
| FEC receipts | `/api/fec/receipts` |
| Financial snapshots | `/api/financial-snapshots` |
| Senate disclosure audit | `/api/senate-disclosures` |
| Elections | `/api/elections/candidates` |
| Candidate dossier | `/api/elections/candidates/:candidate_id` |
| Search | `/api/search` |

## Local Run

1. Create a local Postgres database named `congress_tracker` owned by user `congress_tracker`.
2. Provide these environment variables to backend commands:
   - `DATABASE_URL`
   - `CONGRESS_GOV_API_KEY`
   - `OPENFEC_API_KEY`
   - `SENATE_LDA_API_KEY`
3. Start the canonical backend, frontend, and worker together:

```bash
./run_all.sh
```

The worker owns normal member, bill, vote, FEC, House disclosure, and derived
relationship freshness. Manual ingest subcommands remain diagnostics and
targeted repair tools; normal member pages must not depend on them.

Set `SENATE_EFD_ACCEPT_TERMS=1` only after the operator has accepted the Senate
eFD terms. Without it, Senate discovery is skipped rather than reported as a
source failure.

Frontend: `http://localhost:3000`

Backend: `http://localhost:4020`

## Verification

```bash
scripts/self-test
```

Useful runtime checks:

```bash
curl http://127.0.0.1:4020/api/health
curl http://127.0.0.1:4020/api/home/summary
curl http://127.0.0.1:4020/api/sources/status
curl http://127.0.0.1:4020/api/system/worker-health
curl http://127.0.0.1:4020/api/system/disclosure-coverage
curl 'http://127.0.0.1:4020/api/fec/receipts?cycle=2026&page=1&per_page=10'
curl 'http://127.0.0.1:4020/api/financial-snapshots?limit=10'
curl 'http://127.0.0.1:4020/api/bills?limit=10'
curl 'http://127.0.0.1:4020/api/lobbying/filings?limit=10'
curl 'http://127.0.0.1:4020/api/elections/candidates?limit=10'
curl 'http://127.0.0.1:4020/api/search?q=health&limit=5'
```

Browser verification artifacts can be stored under `reports/verification/`.

## Known Limits

- House PTR ingestion and House annual asset/liability parsing are active. Income, gifts, and positions still need production parsing and coverage proof.
- Scanned-document OCR is implemented, but representative accuracy and failure recovery still need live verification.
- Senate eFD discovery is staged and terms-gated. Senate download, versioning, parsing, and shared member normalization remain incomplete.
- Canonical FEC receipt browsing exists, but the configured three-cycle window is not complete until every required cycle reaches a terminal source state.
- Member vote and sponsorship pages read only canonical relational records; missing rows are shown as unavailable rather than inferred from search.
- Stocks, portfolio, and net-worth pages keep explicit coverage caveats when canonical disclosure rows are missing or partial.
- Voteview and Wikidata are registered as sources but are not required for the core smoke dataset.
- The visualizations route is outside the required tab set and still needs a separate cleanup pass.

## License

MIT. Give credit.
