# Repository Map

## Project Structure

```
congress-tracker/
├── backend/
│   ├── Cargo.toml                          # Workspace root
│   ├── crates/
│   │   ├── intel_backend/                  # NEW — Canonical Postgres-backed intelligence backend
│   │   │   ├── Cargo.toml
│   │   │   ├── migrations/                   # 51 numbered SQL migrations (0001–0051)
│   │   │   └── src/
│   │   │       ├── main.rs                 # Server binary (port 4020)
│   │   │       ├── lib.rs                  # Public entrypoint (AppState, build_router, Db, etc.)
│   │   │       ├── config.rs               # Env-driven configuration
│   │   │       ├── db.rs                   # Postgres connection pool + migrations
│   │   │       ├── cache.rs                # Moka in-memory cache layer
│   │   │       ├── models.rs               # Shared API response models
│   │   │       ├── entity_resolution.rs    # Deterministic crosswalk + confidence scoring
│   │   │       ├── provenance.rs           # Source freshness, confidence labels, warnings
│   │   │       ├── normalize.rs            # Normalization helpers (party, chamber, state, position)
│   │   │       ├── bin/
│   │   │       │   └── ingest.rs           # CLI ingest binary (clap subcommands)
│   │   │       ├── routes/
│   │   │       │   ├── mod.rs              # Route registration
│   │   │       │   ├── bills.rs            # Bill intel routes
│   │   │       │   ├── chambers.rs         # Chamber dashboard routes
│   │   │       │   ├── committees.rs       # Committee routes
│   │   │       │   ├── fec.rs              # FEC campaign finance routes
│   │   │       │   ├── financial.rs        # Financial disclosure routes
│   │   │       │   ├── funding.rs          # Member funding routes
│   │   │       │   ├── health.rs           # Health check endpoint
│   │   │       │   ├── home.rs             # Home/intel summary routes
│   │   │       │   ├── influence.rs        # Influence network routes
│   │   │       │   ├── lobbying.rs         # Lobbying data routes
│   │   │       │   ├── member_intel.rs     # Member intelligence routes
│   │   │       │   ├── members.rs          # Member profile routes
│   │   │       │   ├── organizations.rs    # Organization detail routes
│   │   │       │   ├── portfolio.rs        # Portfolio analysis routes
│   │   │       │   ├── search.rs           # Full-text search routes
│   │   │       │   ├── sources.rs          # Source attribution routes
│   │   │       │   ├── system.rs           # System/worker health routes
│   │   │       │   ├── trades.rs           # Stock trade routes
│   │   │       │   └── visualizations.rs   # Visualization data routes
│   │   │       └── repository/
│   │   │           ├── mod.rs              # Repository module exports
│   │   │           ├── members.rs          # Member data access
│   │   │           ├── bills.rs            # Bill data access
│   │   │           ├── votes.rs            # Vote / roll-call data access
│   │   │           ├── fec.rs              # FEC candidate / committee / transaction access
│   │   │           ├── lobbying.rs         # Lobbying data access
│   │   │           ├── trades.rs           # Stock trade data access
│   │   │           ├── influence.rs        # Influence network data access
│   │   │           ├── search.rs           # Full-text search access
│   │   │           ├── source_runs.rs      # Source run tracking
│   │   │           └── entity_resolution.rs# Entity resolution queue access
│   │   │
│   │   ├── backend_server/                 # DEPRECATED compatibility crate; intel_backend is canonical
│   │   │   └── src/
│   │   │       └── main.rs                 # Legacy server entrypoint; routes should migrate to intel_backend
│   │   │
│   │   ├── congress_api/                   # Congress.gov API client
│   │   ├── openfec_api/                    # OpenFEC API client
│   │   ├── lobbying_client/               # LDA/Senate lobbying API client
│   │   ├── civiq_client/                   # CIV.IQ API client
│   │   ├── capitoltrades_api/              # CapitolTrades API client
│   │   ├── ticker_resolver/               # Stock ticker -> sector resolution
│   │   ├── committee_detector/             # Committee conflict detection
│   │   ├── trade_enricher/                 # Trade enrichment and filer metrics
│   │   └── anomaly_scorer/                 # Anomaly scoring for trades
│   │
│   ├── README.md
│   └── Makefile
│
├── frontend/                               # Next.js 14 frontend (TypeScript, Tailwind)
│   ├── app/                                # App router pages
│   │   ├── legislators/[id]/               # Member profile page (6 intelligence tabs)
│   │   ├── bills/[id]/                     # Bill intel page
│   │   ├── influence/                      # Influence workbench
│   │   ├── committees/                     # Committee list
│   │   ├── committees/[id]/                # Committee detail
│   │   ├── stocks/                         # Stock trades
│   │   ├── portfolio/                      # Portfolio analysis
│   │   ├── lobbying/                       # Lobbying data
│   │   ├── candidates/                     # Election dashboard
│   │   ├── search/                         # Cross-entity search
│   │   ├── data-sources/                   # Source attribution page
│   │   └── methodology/                    # Methodology page
│   ├── lib/
│   │   ├── services/                       # Data service modules
│   │   │   ├── legislators.ts              # Member data service (extended with profile fields)
│   │   │   ├── bills.ts                    # Bill data service (reads through backend)
│   │   │   ├── funding.ts                  # Funding endpoint service
│   │   │   ├── committees.ts               # Committee endpoint service
│   │   │   ├── chambers.ts                 # Chamber dashboard service
│   │   │   ├── stocks.ts                   # Stock trade service
│   │   │   ├── lobbying.ts                 # Lobbying data service
│   │   │   ├── search.ts                   # Search endpoint service
│   │   │   └── provenance.ts              # Provenance/confidence types
│   │   └── constants.ts                    # Config constants (NEXT_PUBLIC_BACKEND_URL, etc.)
│   ├── components/
│   │   ├── ui/                             # Reusable UI components (ArchivePanel, etc.)
│   │   └── visualizations/                 # Chart components (CampaignFinanceChart, etc.)
│   └── styles/
│
├── docs/
│   └── agent/
│       ├── repo-map.md                     # This file
│       ├── workflows.md                    # Developer workflows
│       ├── testing.md                      # Test commands and verification
│       ├── known-errors.md                 # Known error patterns and fixes
│       └── learnings.md                    # Reusable learnings
│
├── scripts/
│   └── self-test                           # Full verification script
│
├── AGENTS.md                               # Agent quality gates and conventions
├── CREDITS.md                              # Third-party credits and licenses
├── .env.example                            # Environment variable template
└── README.md
```

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| `intel_backend` as canonical server | All new intelligence routes live here; do not add new page data contracts to `backend_server` |
| PostgreSQL as primary store | Durable, queryable, supports materialized views for dashboard performance |
| Moka in-memory cache | Hot GET response caching; invalidated on ingest writes |
| Deterministic entity resolution | bioguide_id first, FEC/ICPSR crosswalk, fallback name+state+chamber |
| Conservative AIPAC attribution | Only verified FEC committee IDs; no opaque 501(c)(4) attribution |
| `bioguide_id` as canonical member key | Joins `member_identifiers` for FEC, ICPSR, OpenSecrets, etc. |

## Ingest Binary

The `ingest` binary at `backend/crates/intel_backend/src/bin/ingest.rs` provides CLI subcommands:

| Subcommand | Purpose |
|------------|---------|
| `members --current-only --limit N` | Seed current members from unitedstates/congress-legislators |
| `congress-members --limit N` | Update member data from Congress.gov |
| `congress-bills --congress N --limit N` | Ingest bills from Congress.gov |
| `congress-votes --congress N --chamber <house|senate> --limit N` | Ingest roll-call votes |
| `fec-candidates --cycle N --limit N` | Ingest FEC candidates |
| `fec-committees --q TEXT --limit N` | Ingest FEC committees |
| `fec-transactions --cycle N --committee-id ID --limit N` | Ingest direct contributions |
| `fec-independent-expenditures --cycle N --committee-id ID --limit N` | Ingest independent expenditures |
| `lobbying-filings --year N --page-size N --limit-pages N` | Ingest LDA filings |
| `capitol-trades --limit N` | Ingest stock trades from CapitolTrades |
| `voteview --members --votes --rollcalls` | Ingest Voteview ideology/vote data |
| `refresh-materialized-views` | Refresh `member_funding_cycle_mv`, `member_vote_summary_mv`, `influence_network_member_mv` |
| `influence-seeds` | Seed AIPAC/pro-Israel influence network committees |
| `all-smoke` | Run all smoke tests (members 25, influence-seeds, FEC committees, bills 10, refresh MVs) |
