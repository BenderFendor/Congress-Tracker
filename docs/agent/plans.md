# System Plans & Decisions

## Active Architecture

### Data pipeline

```
House Clerk yearly ZIP index
    ↓ intel_worker (tokio poll loop)
PostgreSQL (source_index_entries → ingest_jobs queue)
    ↓
disclosure_documents + document_versions (versioned PDF storage)
    ↓
disclosure_transactions (normalized, idempotent)
    ↓
stock_trades (materialized view with enrichment)
    ↓ GET /api/stocks/transactions
frontend /portfolio (3-tab evidence hub)
```

### Key decisions

| Decision | Rationale |
|----------|-----------|
| `stock_trades` as materialized view | Single source of truth; enrichment computed in-view via PL/pgSQL functions; no data duplication |
| PostgreSQL as job queue | `FOR UPDATE SKIP LOCKED` for worker coordination; no Redis dependency |
| Advisory locks per year | Prevents duplicate discovery across worker instances |
| Document versioning via SHA-256 | Same PDF at same URL can be re-downloaded safely; never overwrite |
| PL/pgSQL enrichment functions | Ported from Rust `committee_detector` crate; runs in-view for zero-latency access |
| Evidence tier system | direct (primary source) → derived (computed) → contextual (correlated); never present inferred as observed |
| No accusation language | "Filed 58 days after transaction" not "illegal"; "Direct committee overlap" not "corrupt" |
| Funding fallback provenance | OpenFEC candidate totals may fill an empty member-cycle response, but donor/committee rankings remain empty with an explicit warning until canonical paginated FEC transactions are ingested |
| Chronology guard | Source transaction and filing dates remain visible; impossible negative filing intervals become unavailable rather than inferred |

### Implemented plans

1. **Fused Portfolio + Evidence Engine** — `/portfolio` absorbs `/stocks` into a 3-tab disclosure hub with evidence flags, late-filing detection, and source provenance. See `docs/agent/worker-pipeline.md` and `docs/agent/ptr-disclosures.md`.

2. **Worker Pipeline** — Automated House Clerk ingestion replacing manual PDF uploads and the `seed.rs` count-comparison sync. Four-phase implementation: worker stubs, historical backfill, annual reports, enrichment. All four phases complete.

### Data source hierarchy

| Tier | Sources | Status |
|------|---------|--------|
| 1 — Primary | House Clerk PTRs, Senate eFD, Congress.gov, LDA, FEC, USAspending | House PTRs automated via worker; others via CLI ingest |
| 2 — Secondary | CapitolTrades (removed from pipeline), OpenSecrets, GovTrack | Kept for cross-verification only |
| 3 — Enrichment | SEC CIK, ticker lookups, committee jurisdiction maps | `ticker_lookup` table + PL/pgSQL functions |

### Frontend evidence components

| Component | What it renders |
|-----------|----------------|
| `ConflictBadge` | Committee overlap severity pill (amber/red, expandable) |
| `LateFilingFlag` | STOCK Act deadline pill (>45 days = late) |
| `SourceProvenancePill` | Tier-colored source label (green=primary, gray=secondary) |
| `ConflictDetailPanel` | Expandable list of specific committee conflicts |
| `EvidenceRow` | Composite inline row of all three flags |
| `OverlapCard` | Relationship evidence card (subject → predicate → object) |

### API routes added

| Route | Purpose |
|-------|---------|
| `GET /api/system/disclosure-coverage` | Pipeline statistics (years, documents, parses) |
| `GET /api/system/worker-health` | Worker instance status + job queue counts |
| `GET /api/stocks/transactions` | Now served from materialized view |
| `GET /api/intel/portfolio/pulse` | Dynamic — queries live DB state |

### Files deleted

| File | Reason |
|------|--------|
| `seed.rs` (102 lines) | Replaced by worker auto-seed |
| `upsert_stock_trade()` in trades.rs | No more direct writes to stock_trades |
| `cmd_capitol_trades()` + `try_capitol_trades()` in ingest.rs | CapitolTrades scraper removed |
| `frontend/app/stocks/` | Absorbed into /portfolio |
| `frontend/lib/services/enrichment.ts` | Zero callers, broken types |
