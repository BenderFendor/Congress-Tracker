# Elections State and Territory Drill-Down

**Goal:** Preserve postal-abbreviation candidate and district data after a FIPS map selection, and render county geometry for every advertised state, district, and territory jurisdiction.

**Files changed:**

- `frontend/app/elections/page.tsx`
- `frontend/components/elections/election-map-render.ts`
- `frontend/lib/county-geography.mjs`
- `frontend/lib/county-geography.d.ts`
- `frontend/lib/county-map-projection.mjs`
- `frontend/lib/county-map-projection.d.ts`
- `frontend/scripts/county-geography.test.mjs`
- `docs/agent/test-catalog.md`
- `docs/Log.md`
- `papercuts.md`

**Commands run:**

- `cd frontend && node --test scripts/county-geography.test.mjs` - passed, 8/8 tests.
- `cd frontend && pnpm typecheck` - passed.
- `cd frontend && pnpm lint` - passed with zero warnings.
- `cd frontend && pnpm lint:ox` - passed with zero warnings.
- `cd frontend && git diff --check` - rerun at handoff after normalizing `papercuts.md` EOF.
- Chrome extension at `http://localhost:3001/elections` - selected Guam (FIPS 66): one county path, SVG `d` length 843, `GU candidate activity`, no horizontal overflow.
- Chrome extension at `http://localhost:3001/elections` - selected American Samoa (FIPS 60): five county paths with non-empty SVG `d` values, `AS candidate activity`, no horizontal overflow.

**Tests added:**

- FIPS-to-postal candidate matching, including a territory, wrong-state, malformed-state, and cleared-selection cases.
- Projection proof for every one of the 56 supported jurisdictions. Bundled county geometries cover states and DC; bounded territory fixtures prove that the production Mercator path accepts and renders remote territory coordinates.

**Assumptions:** FEC candidate state values remain postal abbreviations. TIGERweb remains the runtime geometry source for territories, while local projection fixtures only prove renderer capability and do not substitute for source data.

**Risk tier:** medium

**Rollback:** Revert the files above. Restoring `geoAlbersUsa` for county drill-down will restore the known blank-territory failure.

**Status:** done

Chrome screenshot: `reports/verification/elections-guam-county-chrome.png`. The visible page captured the request-failure truth state because backend port 4020 was stopped; DOM evidence separately confirmed the lower Guam and American Samoa county SVG paths. Two later viewport screenshot attempts timed out and were logged as a papercut.
