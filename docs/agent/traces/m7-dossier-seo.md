# M7 Item 10 — Dossier SEO (Sitemap + Proof)

**Goal:** Finish M7 item 10 (dossier SEO). The four `generateMetadata`
layouts (`frontend/app/{legislators,bills,committees,organizations}/[id]/layout.tsx`)
were already committed. Missing pieces closed in this task: a sitemap and
execution of the plan proof (curl of one dossier per type shows og:title +
description; sitemap endpoint returns entries for all four dossier types).

**Files changed:**

- `frontend/app/sitemap.ts` (new) — Next.js 14 `MetadataRoute.Sitemap`.
  Static top-level routes plus dossier entries fetched from the backend API
  for legislators (`/api/legislators?limit=300`), bills
  (`/api/bills?limit=300`), committees (`/api/committees?limit=300`), and
  organizations (`/api/intel/fec/committees?limit=300`, since there is no
  dedicated organizations-list endpoint — see notes below). Each fetch is
  wrapped in try/catch so an unreachable backend degrades to static routes
  only rather than throwing.
- `frontend/public/robots.txt` — added `Sitemap: /sitemap.xml` line.
- `reports/verification/dossier-seo-proof-2026-07-14.md` (new) — live proof
  transcript.

**Commands run:**

- `pnpm typecheck` — pass.
- `pnpm lint` (`next lint --max-warnings=0`) — pass.
- `pnpm lint:ox` — pass.
- `pnpm build` — pass; build output shows `/sitemap.xml` as a static route.
- `scripts/freshness-guard frontend/.next --label "frontend build"` — FRESH.
- Live proof: started `backend/target/debug/intel_backend` (pre-built debug
  binary, no `cargo build` run) on `:4020` against the local dev Postgres
  (`DATABASE_URL=postgres://congress_tracker:congress_tracker@localhost:5432/congress_tracker`,
  no backend was already listening). Ran the built frontend with
  `pnpm start` on `PORT=3111`. Curled one real dossier of each type
  (fetched real IDs from the backend list endpoints first) and asserted
  `og:title` and `meta name="description"` tags are present; curled
  `/sitemap.xml` and asserted it contains entries for all four dossier
  types. Full transcript: `reports/verification/dossier-seo-proof-2026-07-14.md`.
  Both processes (backend debug binary, frontend `next-server`) were killed
  by PID after the proof — nothing pre-existing was touched.

**Tests added:** none (no existing unit-test harness for `sitemap.ts`
route handlers in this repo; verification relied on typecheck/lint/build
plus the live curl proof per the plan's own proof clause).

**Assumptions:**

- Organizations have no dedicated list endpoint. `/api/organizations/{id}`
  accepts either the numeric `organization_id` or an FEC committee id
  (looked up via `organization_identifiers` where `scheme = 'fec'`).
  `refresh_relationship_evidence` seeds an `organizations` row and a
  matching `fec` identifier for every non-empty-name row in `fec_committees`,
  so `/api/intel/fec/committees` committee_ids are a reliable proxy for an
  organizations list. Verified live: 3/3 sampled committee ids resolved
  200 at `/api/organizations/{id}`.
- `NEXT_PUBLIC_SITE_URL` is not yet set anywhere in the repo; `sitemap.ts`
  falls back to `http://localhost:3000`. Whoever wires the production
  domain should set that env var; the sitemap already reads it.

**Risk tier:** low (new frontend-only route; static-route fallback protects
against backend outages).

**Rollback:** delete `frontend/app/sitemap.ts`, revert the `Sitemap:` line
in `frontend/public/robots.txt`.

**Status:** done.

**Finding for follow-up (not fixed — out of scope, layouts were already
committed):** the four `layout.tsx` files read field names that do not all
match the single-item API response shapes, so titles/descriptions fall back
to the raw id instead of a human-readable name for three of the four types:

- `legislators/[id]/layout.tsx` reads `data.display_name || data.full_name`;
  `/api/legislators/{id}` actually returns `official_full_name` (plus
  `first_name`/`last_name`).
- `bills/[id]/layout.tsx` reads `data.title || data.bill_number`;
  `/api/bills/{id}` nests the bill under `data.bill.title`.
- `organizations/[id]/layout.tsx` reads `data.name`; `/api/organizations/{id}`
  returns `canonical_name`.
- `committees/[id]/layout.tsx` reads `data.name`, which does match the API
  and renders correctly.

The og:title and description meta tags are present either way, so the plan
proof passes as written, but the SEO quality is degraded for three of the
four dossier types (raw id in title instead of a name). Logged here rather
than fixed silently since the layouts were out of this task's declared
scope.
