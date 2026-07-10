# Testing

## Setup

```bash
cp .env.example .env
# Fill in CONGRESS_GOV_API_KEY and OPENFEC_API_KEY
cd frontend && cp .env.local.example .env.local 2>/dev/null; echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:4020" > .env.local
cd ..
```

## Commands

| What | Command | Working Dir |
|------|---------|-------------|
| build | `cargo build -p backend_server` | `backend/` |
| check | `cargo check` | `backend/` |
| fmt | `cargo fmt --check` | `backend/` |
| lint | `cargo clippy --all-targets --all-features` | `backend/` |
| test | `cargo test` | `backend/` |
| run canonical backend | `cargo run -p intel_backend --bin intel_backend` | `backend/` |
| run legacy backend | `cargo run -p backend_server` | `backend/` |
| typecheck | `npx tsc --noEmit` | `frontend/` |
| lint (ESLint, warnings fail) | `pnpm lint` | `frontend/` |
| lint (Oxlint, warnings fail) | `pnpm lint:ox` | `frontend/` |
| strict frontend gate | `pnpm verify` | `frontend/` |
| dev | `pnpm dev` | `frontend/` |
| test (intel) | `cargo test -p intel_backend` | `backend/` |
| smoke ingest | `cargo run -p intel_backend --bin ingest -- all-smoke` | `backend/` |
| refresh MVs | `cargo run -p intel_backend --bin ingest -- refresh-materialized-views` | `backend/` |
| seed influence | `cargo run -p intel_backend --bin ingest -- influence-seeds` | `backend/` |
| e2e | `./e2e_test.sh` | repo root |

## Full verify

```bash
scripts/self-test
```

## Known missing checks

- No frontend test suite (e.g. vitest, jest)
- Runtime endpoint proof still requires a running Postgres-backed `intel_backend`
- No pre-commit hook configured
- No CI pipeline defined
- Oxlint and ESLint are now configured as error gates; any new warning fails the respective command.
- TypeScript uses `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`; type diagnostics fail the build.
- Current data gaps are tracked through `/api/sources/coverage`; an empty stock table is an ingestion gap until House Clerk/Senate eFD workers are complete.

## Environment requirements

- Rust toolchain (cargo, rustc)
- Node.js 18+
- pnpm
- Local environment with `DATABASE_URL`, `CONGRESS_GOV_API_KEY`, `OPENFEC_API_KEY`, and `SENATE_LDA_API_KEY`
- `frontend/.env.local` with `NEXT_PUBLIC_BACKEND_URL`
