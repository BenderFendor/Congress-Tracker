# FA-03 Member Dossier Isolation

## Goal

Prevent rapid Member navigation from displaying one Member's profile or section
evidence under another Member's dossier.

## Files changed

- `frontend/app/legislators/[id]/page.tsx`
- `frontend/lib/member-dossier-request.mjs`
- `frontend/lib/services/funding.ts`
- `frontend/lib/services/legislators.ts`
- `frontend/lib/services/relationships.ts`
- `frontend/lib/services/stocks.ts`
- `frontend/lib/services/voting.ts`
- `frontend/scripts/member-dossier-isolation.test.mjs`
- `docs/agent/test-catalog.md`
- `docs/Log.md`
- `papercuts.md`

## Commands run

- `cd frontend && node --test scripts/member-dossier-isolation.test.mjs`: passed, 4 tests.
- `cd frontend && pnpm typecheck`: passed.
- `cd frontend && pnpm exec next lint --max-warnings=0 --file ...`: passed.
- `cd frontend && pnpm exec oxlint ... --deny-warnings ...`: passed.
- `cd frontend && pnpm test:unit`: passed, 64 tests.
- `cd frontend && pnpm build`: compiled successfully, then failed during page
  collection because the already-running `next dev` process shares `.next` and
  `./936.js` was unavailable. This is the documented concurrent-output failure
  in `docs/agent/known-errors.md`; the user-owned dev server was not stopped.
- `git diff --check`: passed after normalizing the papercut log EOF.

## Tests added

- Proves a cancelled request cannot commit after rapid navigation.
- Proves a response keyed to another Member cannot commit.
- Proves abort failures remain distinct from real request failures.
- Proves every dossier section clears and every request receives the same abort
  signal with cleanup on route replacement.

## Assumptions

- Next may reuse the client page component when only the dynamic Member route
  parameter changes, so the effect must reset and cancel explicitly.
- The dossier's existing client-side fetch architecture remains in scope; this
  patch does not introduce a new query dependency.

## Risk tier

Medium.

## Rollback

Revert the request guard, service signal parameters, and the Member page effect
as one unit. Removing only signal propagation would restore an incomplete race
fix.

## Status

Done.
