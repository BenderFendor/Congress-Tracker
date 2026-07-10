# AGENTS.md — Congress Accountability Tracker

## Stack

Full-stack congressional accountability app.
- **Backend**: Rust (Axum) — `backend/`
- **Frontend**: Next.js 14 + TypeScript + Tailwind — `frontend/`

## Orientation

```bash
scripts/agent-summary
```

Key docs to read before editing:
1. `docs/agent/repo-map.md` — directory layout and what lives where
2. `docs/agent/testing.md` — all verify commands
3. `docs/agent/known-errors.md` — recurring failures and fixes
4. `docs/agent/workflows.md` — step-by-step for common tasks

## Build & verify

```bash
scripts/self-test
```

Manual commands:

| What | Backend | Frontend |
|------|---------|----------|
| check | `cd backend && cargo check` | `cd frontend && npx tsc --noEmit` |
| lint | `cd backend && cargo fmt --check && cargo clippy --all-targets --all-features` | `cd frontend && pnpm lint` |
| test | `cd backend && cargo test` | (none yet) |
| run | `cargo run -p intel_backend --bin intel_backend` | `pnpm dev` |
| worker | `cargo run -p intel_worker --bin intel_worker` | Automatic House Clerk pipeline |
| all | `./run_all.sh` | Backend + frontend + worker |
## Project structure

```
backend/crates/
  capitoltrades_api/   ← scrapes CapitolTrades.com (no API key)
  congress_api/         ← Congress.gov v3 API
  openfec_api/          ← OpenFEC API
  backend_server/       ← Axum router, handlers, portfolio module

frontend/
  app/                  ← Next.js pages & API routes
  lib/api.ts            ← backend client + Trade adapter
  lib/services/         ← portfolio, legislators, bills, lobbying, etc.
  components/           ← shared React components
```

## Environment

Copy `.env.example` → `.env` and fill in keys:
- `CONGRESS_GOV_API_KEY` — from https://api.congress.gov/sign-up
- `OPENFEC_API_KEY` — from https://api.open.fec.gov/developers

Frontend `.env.local` in `frontend/` needs:
- `NEXT_PUBLIC_BACKEND_URL=http://localhost:4020`
- `NEXT_PUBLIC_CONGRESS_GOV_API_KEY` (same key)

## Conventions

- **Rust**: `cargo fmt` (4-space, 100-col), `PascalCase` structs, `snake_case` fns. Use `thiserror` for errors. Imports grouped by source.
- **TypeScript**: React/Next imports first, then external libs, then `@/` alias. `PascalCase` components, `camelCase` fns/hooks. Prefer `type` over `interface`. No `any`.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`).
- **DO NOT**: commit `.env` files, weaken tests, add deps without reason, generate fake data.

## Done means

- [ ] Change is complete and minimal
- [ ] `scripts/self-test` ran and passed (or failures diagnosed)
- [ ] No new `any` types in TypeScript
- [ ] No unused imports or dead code
- [ ] `.env.example` updated if new env vars added
- [ ] `docs/agent/learnings.md` updated if a reusable pattern was discovered

## Ingestion ownership

- Public-source ingestion must be deterministic, idempotent, and owned by the backend or `intel_worker` lifecycle.
- Do not require operators or agents to run one-off ingest commands to make normal member pages complete.
- Scheduled ingestion must cover all current members and the broadest source history supported by provider limits.
- Use `source_runs`, advisory locks, bounded retries, and explicit partial-coverage states. Never replace failed ingestion with fabricated data or factual zeroes.
- Manual ingest subcommands may remain as debugging tools, but production freshness and recovery must not depend on them.
