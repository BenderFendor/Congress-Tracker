# Worksheet: Implement Plan Round 2 (2026-07-14)

## Goal
Continue implementing IMPLEMENTATION_PLAN.md — FA-21, FA-22, M7.6, M7.8, M7.9.

## Files Changed

### FA-21: API Protection
- `backend/crates/intel_backend/Cargo.toml` — added tower-http timeout feature
- `backend/crates/intel_backend/src/routes/mod.rs` — TimeoutLayer (30s), concurrency semaphore (50 permits), AppState.concurrency field
- `backend/crates/intel_backend/src/routes/committees.rs` — limit.clamp(1, 500)
- `backend/crates/intel_backend/src/routes/fec.rs` — limit.clamp(1, 500) on list_candidates + list_committees
- `backend/crates/intel_backend/src/routes/members.rs` — limit.clamp(1, 500)
- `backend/crates/intel_backend/src/routes/portfolio.rs` — limit.clamp(1, 500)

### FA-22: Source Status Fix
- `backend/crates/intel_backend/src/routes/home.rs` — DISTINCT ON (source, endpoint) CTE, classify_source_freshness preserves "partial"
- `backend/crates/intel_backend/src/routes/system.rs` — COUNT(DISTINCT document_version_id) for documents_parsed

### M7.6: Licensing
- `LICENSE` — copied MIT license from backend/ to project root
- `frontend/public/robots.txt` — Allow: / for all user agents
- `frontend/app/about/data/page.tsx` — server component listing 8 upstream sources

### M7.8: backend_server Audit
- `WATCHDOG.yml` — rule 4 now routes to intel_backend/src/routes/
- `docs/agent/repo-map.md` — backend_server labeled DEPRECATED
- `docs/agent/test-catalog.md` — backend_server tests tagged [deprecated]

### M7.9: Search Indexes
- `backend/crates/intel_backend/migrations/0052_search_indexes.sql` — 5 trgm indexes
- `backend/crates/intel_backend/src/repository/lobbying.rs` — similarity-first-then-ILIKE
- `backend/crates/intel_backend/src/repository/search.rs` — similarity-first-then-ILIKE
- `backend/crates/intel_backend/src/repository/fec.rs` — similarity-first-then-ILIKE

## Verification
- `scripts/self-test` — PASSED
  - plan-lint: 0 findings
  - cargo fmt --check: pass (after format)
  - cargo clippy --all-targets --all-features: 0 warnings
  - cargo check: pass
  - cargo test: 100/100 pass
  - frontend: test/typecheck/lint/build all pass, /about/data route added

## Risk Tier
Medium — FA-21 adds middleware (timeout + concurrency) that could affect all routes. FA-22 changes source freshness query semantics. M7.9 adds new migration.

## Status
Complete. FA-23 (test audit) and FA-24 (parser promotion) deferred to next batch.
