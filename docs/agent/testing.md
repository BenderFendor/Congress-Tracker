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
| build canonical backend | `cargo build -p intel_backend --bin intel_backend` | `backend/` |
| check | `cargo check` | `backend/` |
| fmt | `cargo fmt --check` | `backend/` |
| lint | `cargo clippy --all-targets --all-features` | `backend/` |
| deterministic Rust tests | `cargo test --workspace --exclude civiq_client --lib --bins` | `backend/` |
| deterministic Civiq query test | `cargo test -p civiq_client test_query_builder` | `backend/` |
| compile Rust integration tests | `cargo test --workspace --tests --no-run` | `backend/` |
| run canonical backend | `cargo run -p intel_backend --bin intel_backend` | `backend/` |
| run legacy backend | `cargo run -p backend_server` | `backend/` |
| typecheck | `npx tsc --noEmit` | `frontend/` |
| lint (ESLint, warnings fail) | `pnpm lint` | `frontend/` |
| lint (Oxlint, warnings fail) | `pnpm lint:ox` | `frontend/` |
| deterministic frontend tests | `pnpm test:unit` | `frontend/` |
| strict deterministic frontend gate | `pnpm verify` | `frontend/` |
| populated live API flows | `DATABASE_URL=... pnpm test:live-api` | `frontend/` |
| dev | `pnpm dev` | `frontend/` |
| test (intel) | `cargo test -p intel_backend` | `backend/` |
| smoke ingest | `cargo run -p intel_backend --bin ingest -- all-smoke` | `backend/` |
| refresh MVs | `cargo run -p intel_backend --bin ingest -- refresh-materialized-views` | `backend/` |
| seed influence | `cargo run -p intel_backend --bin ingest -- influence-seeds` | `backend/` |
| verify fresh and upgrade migrations | `scripts/verify-migrations` | repo root |
| rendered failure-state routes | `scripts/verify-rendered-critical-pages` | repo root |

## Full verify

```bash
scripts/self-test
```

`scripts/self-test` is hermetic with respect to live services. It runs Rust
library/binary tests, compiles every Rust integration test, and runs the complete
deterministic `pnpm verify` frontend gate. It never reuses a backend already
listening on port 4020.

`civiq_client` is excluded from the workspace execution because five tests in
that crate call its live provider. Its deterministic query-builder test still
runs, and the full crate test target is compiled by the integration compile gate.

Populated API contracts are a separate explicit gate:

```bash
cd frontend
DATABASE_URL=postgres://... pnpm test:live-api
```

The wrapper builds `intel_backend` from the current worktree, starts that exact
binary on an isolated non-4020 port, waits for its health endpoint, runs
`e2e-api-flows.live.mjs`, and cleans up only the process it started. The named
database must already contain the representative public records asserted by the
suite.

## Known Missing Checks

- Deterministic frontend tests cover helper and verification-topology contracts;
  rendered component and browser-flow coverage remains limited.
- Populated runtime endpoint proof requires `pnpm test:live-api`; a manually
  running development backend is not accepted as proof.
- No pre-commit hook configured
- `.github/workflows/ci.yml` runs deterministic Rust and frontend tests, compiles
  integration suites, proves fresh/upgrade migrations, and runs canonical FEC
  database contracts against an isolated CI database. Populated/provider-backed
  API flows remain an explicit release/runtime gate rather than a default CI test.
- Oxlint and ESLint are now configured as error gates; any new warning fails the respective command.
- TypeScript uses `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`; type diagnostics fail the build.
- Current data gaps are tracked through `/api/sources/coverage` and `/api/system/disclosure-coverage`; empty stock or financial rows remain ingestion gaps until source coverage is proved.

## Environment requirements

- Rust toolchain (cargo, rustc)
- Node.js 18+
- pnpm
- Local environment with `DATABASE_URL`, `CONGRESS_GOV_API_KEY`, `OPENFEC_API_KEY`, and `SENATE_LDA_API_KEY`
- `frontend/.env.local` with `NEXT_PUBLIC_BACKEND_URL`
