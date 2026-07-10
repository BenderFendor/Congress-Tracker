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

## Phase 2: Canonical backend contracts (implemented)

`backend/crates/intel_backend` is the canonical backend. The old `backend_server` routes remain compatibility code and should not be used by new pages.

- `GET /api/members/:bioguide_id/votes` — congress-scoped vote positions and summary.
- `GET /api/members/:bioguide_id/legislation` — normalized sponsorship/cosponsorship rows.
- `GET /api/committees/:committee_id` — roster plus referred bills.
- `GET /api/relationships` and `GET /api/organizations/:organization_id` — evidence-tiered relationship graph.
- `GET /api/sources/status` and `GET /api/sources/coverage` — source runs with TTL-based `fresh`, `stale`, `missing`, and `failed` labels.
- `disclosure-manifest` ingest — official filing metadata with source URLs and parse status.
- `organization-manifest` ingest — SEC/FEC/LDA identifiers without treating an identifier as relationship proof.
- `refresh-relationships` ingest — deterministic edges from normalized committee, bill, campaign, and trade records.
- `house-ptr` ingest — hashes an official House PTR PDF, extracts text with `pdftotext`, and stores range-aware transactions with the filing URL.
- `house-ptr-url` ingest — downloads and validates an official House PDF before invoking the parser.

---

## Phase 3: Official evidence ingestion (next required work)

1. Build House Clerk and Senate eFD download/index workers. Store immutable raw documents, hashes, filing URLs, and source runs. House PTR PDF parsing is now implemented; annual House statements and Senate eFD formats remain.
2. Parse annual financial disclosures and Senate periodic transaction reports into range-aware `disclosure_holdings` and `disclosure_transactions` rows. Preserve owner type and parser errors.
3. Import SEC company identity, FEC committees, LDA clients/registrants, and USAspending recipient identifiers through `organization-manifest`.
4. Derive relationship evidence only from explicit source records. Every edge must include subject/object keys, relation type, evidence tier, confidence, source record, and source URL.
5. Add organization detail and member disclosure panels once rows exist. Empty or stale source coverage must remain visible.
6. Add bill action/amendment history, finance correlations, and lobbying-to-bill links as separate normalized tables and contracts.

## Phase 4: Frontend product completion

- Add source coverage indicators to the home and member pages.
- Add organization search/detail and relationship filtering by company, PAC, lobbying client, committee, and bill.
- Add range-aware holdings/transactions views; never render exact net worth from disclosure ranges.
- Add bill detail with actions, sponsors, committees, lobbying links, and provenance.
- Add visualizations only from canonical relationship and activity rows; no CSV, random, or placeholder fallback.
- Keep unsupported analytics as explicit setup/unavailable states until canonical rows are ingested.

---

## Phase 5: Credits and Documentation

- `CREDITS.md` — full credits for all open-source projects and APIs
- Code-level `///` doc comments on all new Rust modules citing sources
- Comment headers in frontend services citing data sources
- Footer/data-sources page updates

---

## Execution Order

```
Phase 1 (foundation):       Phase 2 (implemented):       Phase 3 (parallel):       Phase 4:
┌─────────────────────┐      ┌──────────────────────┐    ┌─────────────────────┐   ┌───────────┐
│ crates and adapters │─────▶│ Canonical contracts  │───▶│ Disclosure workers  │──▶│ Product UI │
│ source clients      │      │ Evidence schema      │    │ Entity crosswalks   │   │ Detail views│
└─────────────────────┘      │ Coverage + ingest    │    │ Relationship edges  │   │ Visuals   │
                             └──────────────────────┘    └─────────────────────┘   └───────────┘
```

## Stock disclosure source policy

CapitolTrades is an optional enrichment source, not the system of record. The durable stock pipeline must ingest official House Clerk financial disclosure filings and Senate eFD periodic transaction reports, validate each document as an official PDF or API response, retain the source URL and hash, and normalize transaction ranges into `disclosure_transactions`. CapitolTrades may be used for discovery and cross-checking only. If it is unavailable or returns no match, the UI must continue to use official filings and show source freshness rather than silently substituting estimates.
