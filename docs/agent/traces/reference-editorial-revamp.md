# Reference Editorial Revamp

**Goal:** Extend the supplied editorial reference language across remaining
core information routes without copying or embedding the reference images, and
repair shared mobile clipping discovered during screenshot review.

**Files changed:**

- `frontend/app/data-sources/page.tsx`
- `frontend/app/methodology/page.tsx`
- `frontend/app/lobbying/page.tsx`
- `frontend/app/lobbying/[id]/page.tsx`
- `frontend/app/portfolio/page.tsx`
- `frontend/app/globals.css`
- `frontend/app/mockup.css`
- `frontend/components/ui/member-identity.tsx`
- `frontend/components/ui/legislator-card.tsx`
- `frontend/lib/member-identity.mjs`
- `frontend/lib/member-identity.mjs.d.ts`
- `frontend/scripts/member-identity.test.mjs`
- `frontend/app/legislators/[id]/page.tsx`
- `frontend/app/committees/[id]/page.tsx`
- `docs/agent/test-catalog.md`
- `docs/UI_UX_AUDIT.md`
- `docs/Log.md`
- `docs/agent/traces/reference-editorial-revamp.md`

**Commands run:**

- `pnpm test`: passed, 54 tests.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with no warnings or errors.
- `pnpm lint:ox`: passed with no warnings or errors.
- Chrome desktop and mobile DOM, screenshot, overflow, and console checks:
  passed at 1440x900 and 390x844.

**Tests added:** Three member identity helper tests cover metadata URL
rejection, portrait candidate order, identifier normalization, and initials.

**Assumptions:** The supplied images are visual references only. Their content
and photography must not appear in the product. Existing data truth-state and
route behavior from parallel work must be preserved.

**Risk tier:** Medium. Shared archive metrics, dark-mode tokens, Portfolio tabs,
and member portrait resolution affect multiple responsive states, so member-
heavy and data-heavy routes were checked directly at desktop and mobile widths.

**Rollback:** Revert the listed route wrapper, shared CSS, and documentation
changes. No schema, API, or persisted data changes are involved.

**Status:** Done. Targeted static checks and Chrome verification passed. The
full production build remains part of the root repository handoff so it does
not replace the active shared Next development output mid-session.
