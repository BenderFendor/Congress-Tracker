# FA-16 Bill Detail Correctness

This worksheet records the populated bill-detail failure reproduction, fix,
and focused verification. It covers finance cycle/channel semantics, sponsor
query bounds, frontend contract alignment, and remaining browser evidence risk.

## Goal

Make populated bill detail reliable and evidence-honest: no numeric decode 500,
no all-cycle totals, no combined direct/outside-spending amount, and no
sequential sponsor lookup path.

## Debug evidence

- Reproduction: `GET /api/bills/hr8205-119` on the original port returned 500.
- First wrong transition: `repository/bills.rs` decoded `members.nominate_dim1`
  (`NUMERIC`) into `Option<f64>` (`FLOAT8`) without a SQL cast.
- Actual error: `mismatched types; Rust type Option<f64> ... is not compatible
  with SQL type NUMERIC`.
- The same function summed `member_funding_cycle_mv` and influence-network rows
  without a cycle predicate and issued three sequential queries per sponsor.

## Files changed

- `backend/crates/intel_backend/src/models.rs`
- `backend/crates/intel_backend/src/repository/bills.rs`
- `frontend/lib/services/bills.ts`
- `frontend/app/bills/[id]/page.tsx`
- `docs/Log.md`
- `docs/agent/test-catalog.md`
- `docs/agent/traces/fa16-bill-correctness.md`
- `papercuts.md`

## Commands run

- Original live probe across 25 bills: 20 populated records returned 500.
- `cargo check -p intel_backend`: passed.
- `cargo test -p intel_backend repository::bills::tests -- --nocapture`: 3 passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with zero warnings.
- Alternate backend on port 4022:
  - H.R. 8205 (23 sponsors/cosponsors): 200 in 96 ms.
  - H.R. 6238: 200 in 44 ms.
  - H.R. 8770: 200 in 31 ms; cycle 2026; independent support remained in
    `independent_supporting`, with direct contribution and opposition fields
    present separately.
  - H.R. 6489: 200 in 22 ms; explicit LDA links retained `confidence=direct`.
- Parent Chrome verification loaded H.R. 8205 with 23 linked sponsors, zero
  horizontal overflow, and no console warning/error. H.R. 8770 rendered direct,
  independent support, and independent opposition columns at desktop and 390px
  mobile with no document overflow.

## Tests added

- Congress 112/118/119 map to FEC cycles 2012/2024/2026.
- A sponsor without a FEC crosswalk reports `missing_crosswalk` rather than a
  complete factual zero; a present crosswalk says `crosswalk_loaded`, not that
  all finance coverage is complete.
- Network serialization exposes direct, independent support, and independent
  opposition fields and no combined `amount` field.

## Assumptions

- The election cycle associated with a Congress is the even year ending its
  two-year session.
- A loaded official FEC identifier or linked FEC candidate is sufficient to
  distinguish a source-backed zero from a missing crosswalk.
- Ranking networks by total activity is presentation ordering only; each money
  channel remains separate in the response and UI.

## Risk tier

Medium. Backend, contract, and live API evidence pass; Chrome visual evidence is
blocked by the unresponsive Chrome MCP call.

## Rollback

Revert the four bill model/repository/service/page changes and the accompanying
documentation. No migration or persisted data mutation belongs to this slice.

## Browser evidence

- `docs/agent/traces/fa16-bill-detail-desktop.png`
- `docs/agent/traces/fa16-bill-detail-mobile.png`

## Status

Done in commit `c5612c4`, tag `fa16-bill-correctness`. The integrated
`scripts/self-test` and isolated 18-flow live API suite passed.
