# Credits

The Congress Accountability Tracker aggregates data from multiple US government APIs and enriches it using algorithms and design patterns adapted from the following open-source projects, methodologies, and public data sources. We are grateful to every author, maintainer, and organization whose work made this project possible.

---

## Open Source Projects

### [poli-ticker](https://github.com/ibotzhub/poli-ticker)
- **Author:** ibotzhub
- **License:** Not specified
- **What we adapted:** Committee-to-sector conflict detection algorithm and congressional committee membership mapping used to flag potential conflicts of interest when legislators trade stocks within their committee jurisdictions.
- **Used in:** `backend/crates/committee_detector/` — the full crate is modeled on poli-ticker's approach to correlating committee assignments with traded securities' industry sectors.

### [yfinance](https://github.com/ranaroussi/yfinance)
- **Author:** Ran Aroussi
- **License:** Apache 2.0
- **What we adapted:** Yahoo Finance sector/industry API integration pattern (`quoteSummary` endpoint via `assetProfile` module) and the `SECTOR_INDUSTRY_MAPPING` constant originally from `yfinance/const.py`, which maps 11 Yahoo Finance sectors to their constituent industries (172 entries total). Our `resolve_remote` function mirrors yfinance's `info` / `assetProfile` query pattern to resolve ticker symbols to sectors at runtime.
- **Used in:** `backend/crates/ticker_resolver/src/lib.rs` (remote resolution via Yahoo Finance API) and `backend/crates/ticker_resolver/src/mapping.rs` (static `SECTOR_INDUSTRY_MAP` phf map).

### [FinanceDatabase](https://github.com/jerbouma/FinanceDatabase)
- **Author:** Jeroen Bouma
- **License:** MIT
- **What we adapted:** Static ticker-to-sector database concept and industry classification hierarchy. FinanceDatabase's approach of providing a local, offline-resolvable mapping of companies to sectors and industries informed our dual-resolution strategy (static map fallback + live Yahoo API lookup).
- **Used in:** `backend/crates/ticker_resolver/` — the crate's architecture of combining a compile-time static mapping with optional remote API resolution is directly inspired by FinanceDatabase's design.

### [lobbyR](https://github.com/Lobbying-DisclosuRe/lobbyr)
- **Author:** Chris Cioffi
- **License:** LGPLv3
- **What we adapted:** Senate LDA API query interface design and data cleaning patterns. lobbyR's approach to paginating filings, normalizing registrant/client names, and structuring issue area data informed our Senate LDA integration.
- **Used in:** `frontend/lib/services/lobbying.ts` — the `getRecentFilings` and `getRegistrants` functions, along with the TypeScript types for `Filing`, `Registrant`, and `lobbying_activities`, are modeled on lobbyR's API client patterns.

### [lobby](https://github.com/christopherkenny/lobby)
- **Author:** Christopher Kenny
- **License:** Not specified
- **What we adapted:** Senate LDA API client design pattern, including the separation of filings, registrants, and clients into distinct queryable endpoints with year-based filtering and pagination.
- **Used in:** `frontend/lib/services/lobbying.ts` — the client-side API service structure and query parameter design follow lobby's patterns.

### [CongressWatch](https://github.com/OpenSourcePatents/Congresswatch)
- **Author:** OpenSourcePatents
- **License:** Not specified
- **What we adapted:** 6-signal anomaly scoring algorithm concept for identifying unusual congressional trading activity, and the TF-IDF bill similarity engine concept for comparing legislative texts by topic relevance.
- **Used in:** Referenced in the frontend methodology and portfolio analysis pages; the anomaly detection approach is planned for the `/stocks` analysis tab and the TF-IDF similarity concept for the `/bills` comparison features.

### [congress-trading-monitor](https://github.com/kadoa-org/congress-trading-monitor)
- **Author:** Adrian Krebs
- **License:** MIT
- **What we adapted:** Static JSON data architecture for caching congressional trade data and per-filer metrics computation (trade count, unique issuers, volume, last traded date). The `Stats` struct on `PoliticianDetail` and the aggregated portfolio statistics on the frontend follow this project's per-legislator metrics pattern.
- **Used in:** `backend/crates/capitoltrades_api/src/types/politician.rs` (Stats struct), `backend/crates/backend_server/src/main.rs` (LegislatorTradeStats, per-legislator aggregation), and `frontend/app/portfolio/page.tsx` (portfolio statistics computation).

### [senate-stock-watcher-data](https://github.com/timothycarambat/senate-stock-watcher-data)
- **Author:** Timothy Carambat
- **License:** Not specified
- **What we adapted:** Senate financial disclosure JSON schemas, including field naming conventions for transaction date, ticker, asset description, trade type, amount range, and filing URL. Our `Trade` and `StockTrade` types reflect the disclosure field structure documented by this project.
- **Used in:** `frontend/lib/api.ts` (Trade interface), `frontend/lib/services/stocks.ts` (StockTrade interface), and the CapitolTrades API trade parsing in `backend/crates/capitoltrades_api/src/client.rs`.

### [unitedstates/congress](https://github.com/unitedstates/congress)
- **Author:** Community project (multiple contributors)
- **License:** CC0 (Public Domain)
- **What we adapted:** Vote data collection patterns and output schemas for roll call votes in Congress. The bioguide ID-based member identification system and legislative data normalization patterns used throughout our backend are derived from the conventions established by this project. Member avatar URLs use the project's image hosting (`theunitedstates.io/images/congress`).
- **Used in:** `backend/crates/backend_server/src/main.rs` (bioguide ID matching, `build_avatar_url`, member name normalization), `backend/crates/congress_api/` (vote and bill data types).

### [CIV.IQ](https://civdotiq.org)
- **Organization:** CIV.IQ
- **License:** MIT
- **What we adapted:** Free civic data aggregation API reference architecture. CIV.IQ's approach of combining multiple government APIs (FEC, LDA, USAspending) into a unified query interface informed our backend server design, which similarly aggregates CapitolTrades, Congress.gov, and OpenFEC under one REST API.
- **Used in:** `backend/crates/backend_server/src/main.rs` — the multi-source aggregation pattern where legislators are enriched with trading data, committee assignments, and campaign finance information mirrors CIV.IQ's cross-referencing architecture.

---

## Data Sources

### [CapitolTrades](https://www.capitoltrades.com)
- **What we use:** Primary source for congressional stock trade data, including trade type (purchase/sale), ticker symbol, transaction date, disclosure date, amount range, and politician profile information (name, state, party, chamber, trade statistics).
- **Used in:** `backend/crates/capitoltrades_api/` (API client scraping `bff.capitoltrades.com` and `www.capitoltrades.com`), all trade and politician endpoints in `backend/crates/backend_server/src/main.rs`.

### [House Stock Watcher](https://housestockwatcher.com)
- **What we use:** Supplementary trade data and disclosure record cross-referencing for House members. Provides additional verification and data completeness checks against CapitolTrades data.
- **Used in:** Frontend data validation and cross-reference logic.

### [Senate Stock Watcher](https://senatestockwatcher.com)
- **What we use:** Supplementary trade data and disclosure record cross-referencing for Senate members. Provides additional verification and data completeness checks against CapitolTrades data.
- **Used in:** Frontend data validation and cross-reference logic.

### [Yahoo Finance](https://finance.yahoo.com)
- **What we use:** Stock sector and industry classification data via the `quoteSummary` API endpoint (`assetProfile` module). Used to classify congressional trades by economic sector for conflict-of-interest analysis.
- **Used in:** `backend/crates/ticker_resolver/src/lib.rs` (`resolve_remote` function).

---

## Government APIs

### [Congress.gov API](https://api.congress.gov)
- **Provided by:** Library of Congress
- **What we use:** Legislative data including member biographies, committee assignments, bill texts and summaries, voting records, and congressional reports.
- **Used in:** `backend/crates/congress_api/` — full API client with endpoints for members (`/v3/member`), bills (`/v3/bill`), and votes (`/v3/vote`). Serves the legislators, bills, and voting tracking features.

### [OpenFEC API](https://api.open.fec.gov)
- **Provided by:** Federal Election Commission
- **What we use:** Campaign finance data including candidate and committee information, contribution records (Schedule A), independent expenditures, and committee financial reports.
- **Used in:** `backend/crates/openfec_api/` — full API client with endpoints for candidates (`/v1/candidates`), committees (`/v1/committees`), and receipts (`/v1/schedules/schedule_a`). Powers the campaign finance and candidate tracking features.

### [Senate LDA API](https://lda.senate.gov)
- **Provided by:** Senate Office of Public Records
- **What we use:** Lobbying disclosure data including LD-1 and LD-2 filings, registered lobbyists and firms, client information, spending amounts, issue areas, and government contacts.
- **Used in:** `frontend/lib/services/lobbying.ts` — client-side API integration for filings and registrant queries. Powers the Influence Tracker / lobbying disclosure features.

---

## Methodology References

### [GovTrades](https://govtrades.org/methodology)
- **What we reference:** Portfolio reconstruction methodology using a combination of periodic transaction reports and annual financial disclosures. GovTrades' approach to estimating legislator holdings by starting from disclosed transaction history and adjusting for purchases and sales informs our portfolio tracking logic.
- **Applied in:** `frontend/app/portfolio/page.tsx` and the portfolio analysis features.

### [NOTUS Capitol Gains](https://www.notus.org/capitol-gains/how-we-calculated-federal-lawmakers-wealth)
- **What we reference:** Net worth estimation methodology using the median of disclosed asset and liability ranges. NOTUS's approach of taking the midpoint of each disclosed range (e.g., $50,001-$100,000 becomes $75,000) and summing across all disclosed holdings informs our planned net worth estimation feature.
- **Applied in:** `frontend/app/networth/page.tsx` (planned feature).

### [PlainInfluence](https://plaininfluence.com/methodology)
- **What we reference:** Entity resolution approach for cross-referencing FEC campaign finance data, LDA lobbying disclosures, and USAspending federal contract data. PlainInfluence's methodology of matching organizations across disparate data sources using name normalization, state matching, and address comparison informs our cross-source legislator matching algorithm.
- **Applied in:** `backend/crates/backend_server/src/main.rs` — the `match_confidence` function, `normalize_name`, and `chamber_matches` functions that cross-reference Congress.gov members with CapitolTrades politicians using bioguide ID, name, state, and chamber matching.

---

## License

This project (Congress Accountability Tracker) is released under the MIT License. See `backend/LICENSE` for the full license text.

Each project credited above retains its own license. Where our code directly incorporates or adapts code from another project (such as the `SECTOR_INDUSTRY_MAP` from yfinance), the original license terms are noted in the relevant source files.
