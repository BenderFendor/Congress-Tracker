# Election County Revamp Worksheet

**Goal:** Make the election county view functional, source-honest, accessible,
responsive, and visually consistent with the election atlas.

**Files changed:**

- `frontend/app/api/elections/counties/route.ts`
- `frontend/app/elections/election-map.css`
- `frontend/components/elections/election-map.tsx`
- `frontend/components/elections/election-map-render.ts`
- `frontend/components/elections/election-map-helpers.ts`
- `frontend/lib/county-geography.d.ts`
- `frontend/lib/county-geography.mjs`
- `frontend/scripts/county-geography.test.mjs`
- `docs/UI_UX_AUDIT.md`
- `docs/Log.md`
- `docs/agent/known-errors.md`
- `docs/agent/test-catalog.md`
- `docs/agent/traces/election-county-revamp-debug.md`
- `docs/agent/traces/election-county-revamp.md`
- `reports/verification/elections-county-desktop.png`
- `reports/verification/elections-county-mobile.png`

**Commands run:**

- `curl` against Census Data API and TIGERweb to identify the first source
  contract that returned real county records.
- `pnpm test -- county-geography`: 51 tests passed, including 3 new county
  acquisition tests.
- `pnpm typecheck`: passed after moving derived FIPS state before its effect.
- `pnpm lint`: passed with zero warnings.
- `curl http://127.0.0.1:3000/api/elections/counties?state=06`: 200 with 58
  named California counties, provenance, coverage, retrieval time, and cache
  lifetime.
- `curl http://127.0.0.1:3000/api/elections/counties?state=CA`: 400 with a
  deterministic validation error.
- Chrome desktop 1440px and mobile 390px flows: 58 county paths, zero state
  paths after selection, 58 directory controls, no horizontal overflow, and no
  clean-tab console errors or warnings.
- All 56 jurisdiction endpoints: 3,235 current county equivalents, nonempty
  Polygon or MultiPolygon geometry, correct state prefixes, and zero failures.
- Chrome CA to PA to TX switch: 58, 67, and 254 synchronized path/directory
  counts with prefixes 06, 42, and 48 and no stale California geometry.
- Final Chrome current-GeoJSON check: AK 30/30, CT 9/9, and American Samoa 5/5
  synchronized map/directory counts, zero horizontal overflow, and no console
  warnings or errors.
- Chrome 390px Pennsylvania pass: 57 selector options including the placeholder,
  51 state/DC options, 5 territory options, 44px controls, 67 synchronized
  counties, and no horizontal overflow.
- `cd frontend && pnpm verify`: 57 tests, TypeScript, ESLint, strict Oxlint,
  and the 25-page production build all passed.

**Tests added:**

- State-scoped TIGERweb query serialization.
- County response normalization and cross-state row rejection.
- State FIPS validation.
- Representative CA, PA, TX, NY, AK, HI, and Puerto Rico request support.
- Selector completeness for 50 states, DC, and five territories.
- Polygon and MultiPolygon preservation in normalized TIGERweb GeoJSON.

**Assumptions:** Census TIGERweb remains the authoritative county identity and
boundary source. County election result ingestion remains unavailable until a separate
source-backed, state-authority pipeline exists; FEC district filings are not
treated as county results.

**Risk tier:** medium

**Rollback:** Revert the files listed above. No database migration or persisted
application data changed.

**Status:** done
