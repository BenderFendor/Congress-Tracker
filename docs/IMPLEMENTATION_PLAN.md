# Implementation Plan — Congress Accountability Tracker

## Sources and Credits

Each feature below credits the open-source projects whose logic was adapted.

| Feature | Based On | License |
|---------|----------|---------|
| Committee conflict detection | [poli-ticker](https://github.com/ibotzhub/poli-ticker) by ibotzhub | Public |
| Ticker sector/industry lookup | [yfinance](https://github.com/ranaroussi/yfinance) by Ran Aroussi (Apache 2.0) + [FinanceDatabase](https://github.com/jerbouma/FinanceDatabase) by Jeroen Bouma (MIT) | Apache 2.0 / MIT |
| LDA lobbying API client | [lobbyR](https://github.com/Lobbying-DisclosuRe/lobbyr) by Chris Cioffi (LGPLv3) + [lobby](https://github.com/christopherkenny/lobby) by Christopher Kenny | LGPLv3 |
| Anomaly scoring (6-signal) | [CongressWatch](https://github.com/OpenSourcePatents/Congresswatch) by OpenSourcePatents | Open |
| Trade data aggregation | [congress-trading-monitor](https://github.com/kadoa-org/congress-trading-monitor) by Adrian Krebs (MIT) | MIT |
| Stock watcher JSON data | [senate-stock-watcher-data](https://github.com/timothycarambat/senate-stock-watcher-data) by Timothy Carambat | Public |
| Vote data schemas | [unitedstates/congress](https://github.com/unitedstates/congress) community project (CC0) | CC0 |
| Net worth estimation methodology | [GovTrades](https://govtrades.org/methodology) + [NOTUS Capitol Gains](https://www.notus.org/capitol-gains/how-we-calculated-federal-lawmakers-wealth) | Public |
| Entity resolution approach | [PlainInfluence](https://plaininfluence.com/methodology) | Public |
| Civic data aggregation | [CIV.IQ](https://civdotiq.org) (MIT) | MIT |

---

## Phase 1: New Backend Crates (Foundation)

### 1a. `ticker_resolver` crate
- **Path:** `backend/crates/ticker_resolver/`
- **Sources:** yfinance (const.py SECTOR_INDUSTRY_MAPPING) + FinanceDatabase
- **Provides:**
  - `resolve_sector(ticker: &str) -> (String, String)` — sector + industry
  - Static embedded lookup table (11 sectors, 150+ industries)
  - Optional Yahoo Finance API call for unknown tickers
  - `resolve_batch(tickers: &[String]) -> HashMap<String, (String, String)>`

### 1b. `committee_detector` crate
- **Path:** `backend/crates/committee_detector/`
- **Source:** poli-ticker (config.py COMMITTEE_SECTOR_MAP, data.py detect_overlap)
- **Provides:**
  - `COMMITTEE_SECTOR_MAP` — static mapping of committee keywords → sectors
  - `detect_overlap(committees: &[String], sector: &str) -> Severity`
  - `compute_committee_conflicts(trades: &[Trade], committees: &[String]) -> Vec<Conflict>`

### 1c. `lobbying_client` crate
- **Path:** `backend/crates/lobbying_client/`
- **Source:** lobbyR (get_filings.R) — Senate LDA REST API
- **Provides:**
  - `LobbyingClient::from_env()` — reads SENATE_LDA_API_KEY
  - `get_filings(query: FilingQuery) -> Vec<Filing>`
  - `get_filing_by_id(uuid: &str) -> Filing`
  - `get_registrants(query: RegistrantQuery) -> Vec<Registrant>`
  - `get_clients(query: ClientQuery) -> Vec<Client>`
  - Pagination support, rate limiting (120 req/min with key)

### 1d. `trade_enricher` crate
- **Path:** `backend/crates/trade_enricher/`
- **Sources:** poli-ticker (data.py enrich_trades_parallel) + kadoa-org data schema
- **Depends on:** ticker_resolver, committee_detector
- **Provides:**
  - `EnrichedTrade` struct — unified trade with sector, industry, committee overlap
  - `enrich_trades(trades: &[Trade]) -> Vec<EnrichedTrade>`
  - `enrich_trades_parallel(trades: &[Trade]) -> Vec<EnrichedTrade>`
  - `compute_filer_metrics(trades: &[EnrichedTrade]) -> FilerMetrics`

### 1e. `anomaly_scorer` crate
- **Path:** `backend/crates/anomaly_scorer/`
- **Source:** CongressWatch (6-signal weighted scoring)
- **Depends on:** ticker_resolver, trade_enricher
- **Provides:**
  - `AnomalySignals` struct — individual 6 signal scores
  - `compute_anomaly_score(signals: &AnomalySignals) -> f64` — weighted sum
  - `normalize_to_percentile(value: f64, all: &[f64]) -> f64`
  - TF-IDF cosine similarity for bill authorship detection
  - Wealth gap ratio (net worth / cumulative salary)
  - Donor-vote alignment correlation
  - Stock trade timing vs. legislation overlap

---

## Phase 2: Wire Backend Routes

### New routes in `backend_server/src/main.rs`:
- `GET /api/congress/votes` — Congress.gov votes (wired from existing `get_votes()`)
- `GET /api/congress/members/{id}/votes` — Member voting record
- `GET /api/fec/committees` — OpenFEC committees (wired from existing `get_committees()`)
- `GET /api/enrichment/trades` — Enriched trades with sector + committee overlap
- `GET /api/enrichment/member/{id}` — Full member enrichment (votes, donations, conflicts)
- `GET /api/enrichment/anomaly` — Anomaly scores for all members
- `GET /api/lobbying/filings` — Senate LDA lobbying filings
- `GET /api/lobbying/clients` — Lobbying clients
- `GET /api/lobbying/registrants` — Lobbying registrants/orgs

### Updated AppState:
```rust
struct AppState {
    capitoltrades: Arc<CapitolTradesClient>,
    congress: Option<Arc<CongressClient>>,
    openfec: Option<Arc<OpenFECClient>>,
    lobbying: Option<Arc<LobbyingClient>>,   // NEW
}
```

---

## Phase 3: Frontend Services and Pages

### New/updated frontend services:
- `lib/services/enrichment.ts` — enrichment endpoints (trades, member detail, anomaly)
- `lib/services/voting.ts` — UN-STUB: wire to `/api/congress/votes` and `/api/congress/members/{id}/votes`
- `lib/services/lobbying.ts` — UN-STUB: wire to `/api/lobbying/*` endpoints
- `lib/services/legislators.ts` — populate hardcoded-zero fields (age, votingScore, totalDonations, etc.)

### Un-stubbed pages:
- `app/voting/page.tsx` or integrate into legislator detail — real voting data
- `app/lobbying/page.tsx` — wire remaining 4 tabs (Top Spenders, Top Lobbying Firms, Industry Spend, Top Recipients)
- `app/lobbying/[id]/page.tsx` — organization profile with lobbying history + IRS enrichment
- `app/bills/[id]/page.tsx` — bill detail with amendment history, finance correlations, lobbying
- `app/networth/page.tsx` — portfolio estimation from CapitolTrades data
- `app/portfolio/page.tsx` — sector allocation via committee conflict data
- `app/visualizations/page.tsx` — replace Math.random() with real data

### Home page updates:
- `app/page.tsx` — fix networth and portfolios tabs

---

## Phase 4: Credits and Documentation

- `CREDITS.md` — full credits for all open-source projects and APIs
- Code-level `///` doc comments on all new Rust modules citing sources
- Comment headers in frontend services citing data sources
- Footer/data-sources page updates

---

## Execution Order

```
Phase 1 (Parallel):          Phase 2 (Sequential):       Phase 3 (Parallel):       Phase 4:
┌─────────────────────┐      ┌──────────────────────┐    ┌─────────────────────┐   ┌───────────┐
│ 1a ticker_resolver  │      │ Wire backend routes  │    │ Frontend services   │   │ CREDITS.md│
│ 1b committee_detector│─────▶│ Add enrichment       │───▶│ Un-stub pages       │──▶│ Docstrings│
│ 1c lobbying_client  │      │ endpoints            │    │ Wire visualizations │   │ Frontend  │
│ 1d trade_enricher   │      └──────────────────────┘    │ Portfolio analysis  │   │ footers   │
│ 1e anomaly_scorer   │                                  └─────────────────────┘   └───────────┘
└─────────────────────┘
```
