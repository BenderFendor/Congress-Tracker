# Influence Attribution Worksheet

This worksheet records the FA-02 repair for committee-specific, channel-safe
influence-network financial attribution.

## Goal

Make each influence committee and recipient derive from its own canonical FEC
rows, keep direct contributions, independent support, and independent
opposition separate, and guarantee committee totals reconcile to the network.

## Files changed

- `backend/crates/intel_backend/src/repository/influence.rs`
- `backend/crates/intel_backend/src/models.rs`
- `backend/crates/intel_backend/tests/influence_financials_test.rs`
- `frontend/lib/services/influence.ts`
- `frontend/lib/influence-financials.mjs`
- `frontend/components/influence-flow-map.tsx`
- `frontend/scripts/influence-financials.test.mjs`
- `docs/agent/test-catalog.md`
- `docs/Log.md`
- `docs/IMPLEMENTATION_PLAN.md`

## Commands run

- `cargo check -p intel_backend`: passed.
- `cargo fmt --all -- --check`: passed.
- `cargo clippy -p intel_backend --all-targets --all-features -- -D warnings`: passed.
- `cargo test -p intel_backend --test influence_financials_test -- --nocapture`: populated run passed in the implementation packet; the root rerun without `DATABASE_URL` exercised the explicit skip path and is not counted as database proof.
- `node --test scripts/influence-financials.test.mjs`: passed, 5 tests.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with zero warnings.

## Tests added

- A self-cleaning populated PostgreSQL fixture proves two committees receive
  distinct values, committee sums reconcile to all three network channels, and
  opposition never enters `total_received`.
- Frontend transformation tests prove recipient activity uses explicit direct,
  support, and opposition channels and labels opposition as activity rather
  than money received.

## Live evidence

The populated 2024 AIPAC response returned $35,000 direct contributions,
$13,980,903.77 independent support, and $5,019,397.90 independent opposition.
The committee sums reconciled exactly to all three network values. Final root
browser evidence must use the isolated current backend rather than the stale
process previously occupying port 4020.

## Assumptions

- `fec_canonical_committee_receipts` is the canonical direct-contribution
  channel and independent expenditures remain separate facts.
- Total activity is a useful scale only when the UI names its channels and does
  not describe opposition as money received.

## Risk tier

High. Incorrect joins can multiply money or invert the meaning of opposition.

## Rollback

Revert the matching focused commit. Do not restore the network-level
materialized-view join for committee attribution.

## Status

Implementation and deterministic/populated contracts are done. Final status
depends on isolated-current-backend browser proof and the focused commit/tag.
