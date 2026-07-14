# Worksheet: Frontend Dossier Refactor And Bounded Parser Corpus

**Date:** 2026-07-14

**Branch:** `agent/refactor-frontend-and-complete-gaps`

**Pull request:** #9

## Goal

Implement the repository work that can be completed and proved without downloading the full House or Senate disclosure archive. Refactor oversized frontend surfaces, make dossier downloads work, add the missing candidate dossier path, retain truthful evidence and coverage semantics, and exercise disclosure parsers with a small representative corpus.

## Scope decision

The operator explicitly requested bounded disclosure verification instead of a historical PDF backfill. This work therefore adds three deterministic text fixtures:

1. A modern House PTR layout with two transaction rows, owner codes, dates, amount ranges, and tickers.
2. A House annual-report layout with metadata, section markers, owner columns, identifiers, and asset ranges.
3. An unknown/malformed layout that must produce no canonical rows.

No live provider archive, production database, Senate terms-gated acquisition, OCR corpus, or historical PDF directory is downloaded by this branch.

## Implemented

### Member dossier

- Replaced `frontend/app/legislators/[id]/page.tsx`, formerly 1,472 lines, with a five-line composition boundary.
- Split overview, funding, votes, legislation, trades, relationships, disclosures, biography, state management, and UI primitives into focused modules.
- Added URL-addressable tabs, browser back/forward support, keyboard tab navigation, lazy per-section requests, request cancellation, stale-response rejection, retries, and independent loaded/partial/missing/failed states.
- Added working JSON and CSV downloads for evidence loaded in the current browser session.
- Kept campaign receipts, PAC relationships, independent support, and independent opposition separate.
- Preserved financial-disclosure ranges, source filings, unresolved identifiers, and contextual conflict language.

### Election map

- Split the 1,100-line election-map component into a controller and a presentation/detail module.
- Preserved county acquisition, geography truth states, search, share links, tooltips, accessible county directory, state and national detail views, and filing-versus-result language.
- Added repository-wide TSX size auditing plus a stricter 650-line election-module regression gate.

### Candidate dossier

- Added `GET /api/elections/candidates/:candidate_id` using one exact FEC candidate identifier.
- Preserved official candidate–committee links, cycle, committee type, designation, and principal-committee state.
- Added a candidate dossier route and directory navigation.
- Loaded itemized receipts and operating disbursements as separate channels.
- Explicitly prohibited candidate-to-Member attachment through name similarity.
- Added JSON and CSV candidate-dossier exports and official FEC source links.

### Verification durability

- Added exact Oxlint report artifacts.
- Added deterministic Rust test-report artifacts.
- Added a generated frontend component-size report.
- Updated older source-contract tests to follow the refactored module boundaries rather than requiring implementation details to remain in monolithic route files.

## Failure found and corrected

The first bounded annual-corpus run failed because the synthetic fixture placed House owner codes at the start of asset rows. The verified parser contract expects the owner column immediately before the disclosed value range. The fixture was corrected to the representative House layout; the spouse and joint-owner assertions remained unchanged and passed afterward.

## Proof

GitHub Actions run `29364346560` passed on commit `e79a6b20a0db98268f806952475c69eec67b915e`:

- Frontend deterministic tests: passed.
- TypeScript: passed.
- ESLint: passed.
- Oxlint: passed.
- Next.js production build: passed.
- Rust format: passed.
- Rust Clippy with warnings denied: passed.
- Rust check: passed.
- Fresh and upgrade migrations: passed.
- Deterministic Rust tests, including all three bounded disclosure samples: passed.
- Integration-test compilation: passed.
- Deterministic database contracts: passed.

## Not proved by this branch

- Full House 2008-present acquisition, parse, identity, and coverage rates.
- Full Senate 2012-present terms-gated acquisition and normalization.
- Representative live OCR accuracy and recovery across the historical PDF corpus.
- Production host, Caddy/TLS, restore-drill, alert-channel, Pi/Ryzen load, or storage-volume proofs.
- Live populated-browser screenshots against the operator's production database.
- The external Vercel integration, which was already failing on the base branch and is not the repository's documented systemd/Caddy deployment path.

These remain truthful external or live-data proof requirements rather than being marked complete by deterministic fixtures.
