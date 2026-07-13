# FA-17 Vote Semantics

Purpose: Record the historical-party, strict-majority, and measure-context repair for member roll-call evidence.

## Goal

Exclude tied caucus votes from party-line alignment, compare against party at
vote time rather than current party, and distinguish amendments, nominations,
procedures, and legislation in the member vote contract and UI.

## Files changed

- `backend/crates/intel_backend/migrations/0042_vote_time_party.sql`
- `backend/crates/intel_backend/src/models.rs`
- `backend/crates/intel_backend/src/repository/votes.rs`
- `backend/crates/intel_backend/tests/full_api_contract_test.rs`
- `frontend/app/legislators/[id]/page.tsx`
- `frontend/lib/services/legislators.ts`
- `frontend/lib/services/voting.ts`
- `docs/Log.md`
- `docs/agent/test-catalog.md`
- `docs/agent/traces/fa17-vote-semantics.md`
- `papercuts.md`

## Commands run

- `cargo test -p intel_backend repository::votes::tests --lib`: passed, 5 tests.
- `cargo check -p intel_backend`: passed.
- `cargo fmt --check`: passed after formatting.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with zero warnings.
- `pnpm lint:ox`: passed with zero warnings.
- Transactional execution of migration `0042_vote_time_party.sql` against the
  populated local schema: passed; 209,937 rows matched and the transaction was
  rolled back.
- `scripts/verify-migrations`: blocked because the documented local database
  role cannot create disposable databases. The migration itself was then
  validated transactionally against the populated schema.

## Tests added

- Deterministic Rust fixtures cover a tied party vote, a member's before/after
  party-switch comparisons, amendment context, nomination context, procedural
  context, and a normal bill context.
- The populated API contract now requires measure kind and label, description,
  and result on loaded member vote rows.

## Assumptions

- A non-null party supplied by the vote source is more precise than a term
  interval and remains authoritative.
- `member_terms` is the canonical fallback for Voteview records that omit party
  and state; unresolved dates remain excluded rather than filled from current
  member attributes.
- Measure classification is limited to facts present in the canonical roll-call
  bill identifier, question, and description.

## Risk tier

Medium. This changes a public metric denominator, adds response fields, and
backfills historical party values without overwriting non-null source values.

## Rollback

Revert the vote repository, model, frontend, test, and documentation changes.
Migration `0042` only fills previously null party/state fields; if data rollback
is required, restore the database from its pre-migration backup rather than
guessing which values were source-provided.

## Status

Done. Focused backend and frontend gates pass. Full workspace verification is
owned by the parent integration task and was not duplicated while concurrent
worker and bill agents were editing the shared worktree.
