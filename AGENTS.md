# AGENTS.md - Congress Accountability Tracker

Guidelines for AI agents working on this repository.

## Project Overview
Full-stack web app for congressional accountability tracking:
- **Backend**: Rust (Axum) with API clients for CapitolTrades, Congress.gov, OpenFEC
- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS

## Build Commands

### Backend (Rust)
```bash
cd backend
cargo build                     # Build all crates
cargo check                     # Check compilation
cargo run -p backend_server     # Run server
cargo test -p backend_server    # Run all tests
cargo test -p backend_server test_name_here  # Run single test
cargo fmt && cargo clippy --all-targets --all-features  # Format & lint
```

### Frontend (Next.js)
```bash
cd frontend
pnpm install                    # Install deps
pnpm dev                        # Start dev server
pnpm build                      # Build for production
pnpm lint                       # Lint code
npx tsc --noEmit                # Type check only
```

### Combined
```bash
./run_all.sh                    # Start backend + frontend
./e2e_test.sh                   # Run end-to-end test (requires API keys in .env)
```

## Code Style Guidelines

### Rust
- **Imports**: Group by source, blank lines between groups
- **Naming**: `PascalCase` structs, `snake_case` functions/variables
- **Formatting**: `cargo fmt` (4 spaces, 100 char line width)
- **Error Handling**: Use `thiserror` crate with typed errors
- **Documentation**: `///` comments for public functions

### TypeScript/Next.js
- **Imports**: React/Next.js first, external libs, then internal using `@/` alias
- **Naming**: `PascalCase` components, `camelCase` functions/hooks
- **Types**: Use explicit types, prefer `type` over `interface`
- **Zod**: Use for runtime validation of API responses
- **Avoid**: `any` type - use `unknown` with type guards

## Testing

### Backend Tests
```bash
# Single test with output
cargo test -p congress_api -- --nocapture

# Snapshot testing with insta crate
cargo test -p capitoltrades_api
```

### Frontend Tests
```bash
pnpm lint                        # Run ESLint
npx tsc --noEmit                 # Type check
```

## Environment Variables

### Required (Backend)
- `CONGRESS_GOV_API_KEY` - Congress.gov API key
- `OPENFEC_API_KEY` - OpenFEC API key

### Setup
```bash
./setup-api-keys.sh              # Creates .env from .env.example
```

## Git Workflow

### Branch Naming
- `feature/<description>` - New features
- `fix/<description>` - Bug fixes
- `docs/<description>` - Documentation

### Commit Messages
Follow Conventional Commits format:
```
feat: add OpenFEC API integration
fix: handle missing API keys gracefully
docs: update AGENTS.md
```

### Pre-commit Checks
```bash
# Backend
cargo fmt && cargo clippy --all-targets --all-features

# Frontend
pnpm lint
```

## Common Patterns

### Adding New API Client (Rust)
1. Create crate in `backend/crates/`
2. Implement `Client::from_env()`
3. Define query builders and types
4. Add to `backend_server/Cargo.toml`
5. Create endpoints in `main.rs`

### Adding New Page (Frontend)
1. Create page in `app/[route]/page.tsx`
2. Create components in `components/`
3. Add API service in `lib/services/`

## Project Structure
```
backend/crates/
├── capitoltrades_api/    # CapitolTrades API client
├── congress_api/         # Congress.gov API client
├── openfec_api/          # OpenFEC API client
└── backend_server/       # Axum web server

frontend/
├── app/                  # Next.js pages
├── components/           # React components
└── lib/services/         # API services
```

## Important Notes
- Check existing patterns before implementing new features
- Run linting/formatting before committing
- Test changes locally before pushing
- Keep commits focused and atomic
- Update `.env.example` when adding env vars
