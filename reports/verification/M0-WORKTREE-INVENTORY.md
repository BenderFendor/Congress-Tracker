# M0 Worktree Inventory

This report routes the pre-existing 2026-07-11 worktree changes into roadmap
workstreams. It is an ownership map, not a completion claim. Files with mixed
responsibilities require hunk-level staging or an explicit checkpoint commit.

## M1 Campaign Finance

- FEC bulk download, streaming, staging, batch, classification, identity, canonicalization, supplemental, ranking, and repository modules.
- Migrations `0017` through `0023`, `0027`, and `0028`.
- FEC receipt routes, funding integration, receipt service/query helpers, receipt page, and receipt tests.
- FEC portions of the ingest binary, models, Cargo manifests, API contract tests, and worker scheduler.

## M2 House Financial Disclosures

- Annual disclosure parser and financial-warehouse migrations `0024` and `0025`.
- Worker download, OCR, parse, persistence, identity, snapshot, and concurrency changes.
- Financial snapshot route/service, net-worth page, portfolio integration, and member disclosure presentation.
- SEC asset crosswalk and related ingest command.

## M3 Senate eFD

- Senate discovery module and migration `0026`.
- Terms-gated ingest command, worker scheduler, audit route, and API contract additions.
- Senate download, versioning, parsing, and shared normalization remain future work.

## M4 Lobbying And Influence

- Lobbying route and frontend service changes that broaden source-backed search.
- Canonical influence totals built from FEC direct receipts and separate outside spending.
- Lobbying entity routes and separated AIPAC LDA presentation remain future work.

## Cross-Cutting Files

- `backend/crates/intel_backend/src/bin/ingest.rs` contains M1, M2, and M3 command changes.
- `backend/crates/intel_worker/src/main.rs` contains M0 worker health plus M1, M2, and M3 scheduling and pipeline changes.
- `backend/crates/intel_backend/src/routes/mod.rs`, `src/lib.rs`, `models.rs`, and the full API contract test register several milestones.
- `run_all.sh` changes process lifecycle behavior for the shared local stack.
- `docs/agent/learnings.md` records cross-cutting FEC and disclosure lessons.

## Artifact Policy

- Worker storage, Rust ICE reports, and npm lockfiles are ignored and remain outside product commits.
- `papercuts.md` is tracked as the project friction ledger.
- Existing generated files remain on disk; the ignore policy does not delete them.
