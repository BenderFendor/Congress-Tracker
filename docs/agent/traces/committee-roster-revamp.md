# Committee Roster Revamp

**Goal:** Replace the committee detail membership table with an accessible,
source-backed portrait roster that matches the legislator directory and works
at desktop and mobile sizes.

**Files changed:**
- `frontend/app/committees/[id]/page.tsx`
- `frontend/lib/services/committees.ts`
- `frontend/app/mockup.css`
- `docs/UI_UX_AUDIT.md`
- `docs/Log.md`
- `docs/agent/traces/committee-roster-revamp.md`
- `reports/verification/committee-roster-desktop.png`
- `reports/verification/committee-roster-mobile.png`

**Commands run:**
- `curl http://127.0.0.1:4020/api/committees/HSHM`: confirmed a 42-row live
  roster with Bioguide IDs, exact roles, ranks, party, state, district, and
  chamber.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with zero warnings.
- `pnpm lint:ox`: passed with zero warnings.
- `pnpm test`: passed.
- Chrome MCP desktop and 390px mobile snapshots, screenshots, DOM metrics, and
  console checks: passed. The available desktop Chrome window measured 930px;
  the responsive grid rendered three columns with no page overflow. The 390px
  viewport rendered compact portrait rows with no page overflow.

**Tests added:** No helper test was added. The change is presentation logic and
was verified against the live API contract, strict static gates, and browser
DOM and screenshot evidence.

**Assumptions:** The canonical Bioguide portrait URL convention remains the
official portrait source. When a portrait fails or a Bioguide ID is absent,
the UI shows initials and does not invent an image or profile link. Committee
role labels may include subcommittee assignments in the current loaded roster;
the UI preserves those source labels without inferring replacements.

**Risk tier:** medium

**Rollback:** Revert the six source and documentation files above. Screenshot
artifacts can be removed independently. No schema or backend data changes are
required.

**Status:** done
