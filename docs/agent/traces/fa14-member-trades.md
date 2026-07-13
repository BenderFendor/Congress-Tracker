# FA-14 Member-Keyed Stock Trades

This worksheet records the repair of the stock transactions API and Member
Trades tab. It covers the canonical query boundary, pagination, truth states,
and live API/browser proof completed on 2026-07-12.

## Goal

Make public stock transaction reads independent of the missing derived view,
replace the Member page's first-200-global-rows filter with a canonical
Member-keyed bounded query, and preserve honest missing-coverage language.

## Files changed

- `backend/crates/intel_backend/src/repository/trades.rs`
- `backend/crates/intel_backend/src/routes/trades.rs`
- `backend/crates/intel_backend/src/routes/mod.rs`
- `backend/crates/intel_backend/tests/full_api_contract_test.rs`
- `frontend/lib/services/stocks.ts`
- `frontend/lib/services/legislators.ts`
- `frontend/app/legislators/[id]/page.tsx`
- `frontend/scripts/member-dossier-isolation.test.mjs`
- `docs/agent/test-catalog.md`
- `docs/Log.md`
- `papercuts.md`
- `docs/agent/traces/fa14-member-trades.md`

## Commands run

- `curl http://127.0.0.1:4020/api/stocks/transactions?limit=2`: reproduced
  HTTP 500 because relation `stock_trades` did not exist.
- PostgreSQL warehouse probe: found 37,321 canonical disclosure transactions
  across 221 linked Member IDs.
- `cargo check -p intel_backend`: passed.
- `cargo test -p intel_backend repository::trades::tests` and
  `cargo test -p intel_backend routes::trades::tests`: passed, four focused
  predicate, enrichment-boundary, pagination, and coverage tests.
- `pnpm typecheck`: passed.
- `node --test scripts/member-dossier-isolation.test.mjs`: passed, 8 tests.
- `pnpm lint`: passed with zero warnings.
- Isolated backend on port 4124:
  `/api/stocks/transactions?limit=2` returned HTTP 200 and the canonical
  plausible-date total.
- Isolated member query for `G000583`: total 3,134; offset 0 returned a
  2026-06-17 record and offset 3,133 returned a 2018-01-16 record.
- Isolated member query for `A000369`: returned `not_loaded` and explicitly
  stated that missing rows are not evidence of no trading.
- PostgreSQL plausible-date proof: 37,316 visible rows, five excluded future
  date anomalies, and latest visible transaction date 2026-07-07. Member
  `M001136` has 1,515 visible rows and one excluded anomaly; `G000583` has
  3,134 visible rows and zero excluded anomalies.
- Unknown Member `ZZ99999` returns canonical HTTP 404; valid Member `A000369`
  remains HTTP 200 with `not_loaded` coverage.
- `EXPLAIN (ANALYZE, BUFFERS)` proves the page CTE runs before enrichment.
  For global limit 100, both enrichment functions looped 100 times and the
  query completed in 38.135 ms. For `G000583` limit 100, both functions looped
  100 times, completed in 22.231 ms, and used 8,576 shared-hit buffers versus
  the reviewed pre-fix 246.7 ms and 44,995 buffers.
- The exact API returned four flagged rows in the first `G000583` page. The
  verified MSFT row reports `DIRECT OVERLAP`, one flag, and the source-derived
  detail `House Permanent Select Committee on Intelligence has direct oversight
  of Technology sector`.
- `/api/stocks/transactions?ticker=AAPL` returns HTTP 400; the removed filter
  cannot be silently ignored. The dedicated ticker route now returns the same
  bounded response envelope with `total`, `offset`, anomaly count, and
  `has_more`; `MSFT` reported 446 rows and disjoint ordered pages.
- Excessive offsets are rejected rather than silently clamped: exact-worktree
  `/api/stocks/transactions?limit=100&offset=100001` returned HTTP 400 with
  `offset must be between 0 and 100000`.
- Exact-worktree isolated runtime latency on port 4124 was 80.405 ms for the
  global 100-row response and 31.501 ms for the `G000583` 100-row response.
  The second Member page returned 100 rows at offset 100, retained `has_more`,
  and contained eight flagged overlap records.
- Chrome at `http://127.0.0.1:3124/legislators/G000583`: desktop and mobile
  Trades tab rendered 100 rows and the exact `Showing 100 of 3134` coverage
  statement; neither viewport had document-level horizontal overflow and the
  browser console had no warnings or errors. On mobile the coverage statement
  was visible, the trade table was intentionally internally scrollable, and
  the touch-scrollable Member tab strip exposed no native scrollbar. The
  selected Trades tab was fully visible, exposed `aria-selected`, controlled
  the Trades tabpanel, and ArrowRight/ArrowLeft moved to Connections and back.
- Final exact-worktree Chrome proof on backend `4130` and frontend `3130`
  replaced the bounded 100-row window through `Next`: `Showing 1–100 of 3134`
  became `Showing 101–200 of 3134`, while the DOM remained exactly 100 rows.
  `Previous`, `Next`, and `Page 2 of 32` were visible on desktop and mobile,
  the selected Trades tab remained visible, document overflow stayed absent,
  and the console had no warnings or errors. A visible MSFT row rendered
  `DIRECT OVERLAP · 1 flag` and the Intelligence Committee/Technology-sector
  evidence detail.

## Tests added

- Bounded pagination unit coverage for default, invalid, and excessive query
  values, plus the reusable 2012-through-current-date SQL contract and anomaly
  coverage messaging.
- Source-level frontend regression proving Member-keyed endpoint use, removal
  of global-row browser filtering, and preservation of coverage truth copy.
- Regression coverage for truthful overlap labels and methodology copy,
  tablist/tab/tabpanel semantics and keyboard navigation, and member-keyed
  replacement-page commits with previous/next, loading, error, retry, and
  bounded-render guards.
- Live newest/oldest pagination proof against a Member whose 3,134 records
  span far beyond the old first-200 global window.

## Visual evidence

- `docs/agent/traces/assets/fa14-member-trades-desktop.png`
- `docs/agent/traces/assets/fa14-member-trades-mobile.png`
- `docs/agent/traces/assets/fa14-member-trades-conflict.png`
- `docs/agent/traces/assets/fa14-member-trades-page2-desktop.png`
- `docs/agent/traces/assets/fa14-member-trades-page2-mobile.png`

## Assumptions

- `disclosure_transactions` joined to `disclosure_documents` is the canonical
  read source; existing deterministic sector and committee-overlap functions
  preserve the prior enrichment fields without requiring the derived view.
- A 100-row Member page is a bounded window; Previous/Next expose the full
  reachable history without accumulating thousands of DOM rows. The API
  exposes total, offset, and `has_more`, so older records are not implied absent.
- Existing malformed future transaction dates are source-data anomalies, not
  valid reasons to fail or silently hide the entire endpoint.

## Risk tier

Medium. The public response keeps its existing trade fields and adds coverage
metadata. Implausible dates are excluded consistently and disclosed rather
than allowed to dominate the chronology or silently disagree with totals.

## Rollback

Revert the files listed above. This restores the materialized-view dependency
and global-first-200 browser filter, including their known failure modes.

## Status

Done. The scoped API, deterministic tests, live warehouse pagination, anomaly
exclusion, unknown-Member truth contract, and desktop/mobile rendered Member
view are verified. A malformed future-date papercut remains logged for
ingestion-time validation work.
