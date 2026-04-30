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
| run | `cargo run -p backend_server` | `backend/` |
| typecheck | `npx tsc --noEmit` | `frontend/` |
| lint (ts) | `pnpm lint` | `frontend/` |
| dev | `pnpm dev` | `frontend/` |
| e2e | `./e2e_test.sh` | repo root |

## Full verify

```bash
scripts/self-test
```

## Known missing checks

- No frontend test suite (e.g. vitest, jest)
- No backend e2e/integration tests without running servers
- No pre-commit hook configured
- No CI pipeline defined

## Environment requirements

- Rust toolchain (cargo, rustc)
- Node.js 18+
- pnpm
- `.env` with `CONGRESS_GOV_API_KEY` and `OPENFEC_API_KEY`
- `frontend/.env.local` with `NEXT_PUBLIC_BACKEND_URL`
