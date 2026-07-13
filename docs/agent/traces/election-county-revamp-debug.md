# Debug Trace: Election County View

**Task:** Repair and verify the broken election atlas county view.

**Failure:** Selecting Alameda County changed the selected tab and detail card
to county state, but the SVG redrew the national state map.

**Reproduction:** Open `/elections`, select California, then select Alameda
County (`06001`) in Chrome.

**First wrong transition:**

- File: `frontend/components/elections/election-map-render.ts`
- Boundary: React `view="county"` into the D3 feature-selection branch.
- Actual: the county branch required `view === "state"`, producing zero county
  paths and 56 state paths after county selection.
- Required: both state drill-down and selected-county modes must use the
  selected state's county features.

**Secondary source failure:** The former Census Data API request followed a
redirect to an HTTP 200 HTML `Missing Key` page. The JSON parser therefore
never populated county names.

**Fix:** Treat every non-national view with a selected state as county
geography. Acquire names state by state from the official Census TIGERweb
`State_County` layer through a validated, cached Next API route.

**Regression evidence:** The repaired Alameda flow renders 58 county paths,
zero state paths, 58 named directory controls, and explicit not-loaded election
result states.

**Risk:** Medium. TIGERweb is an external primary source. The route returns an
explicit 502 and the UI retains FIPS geometry labels when acquisition fails.

## Full-Jurisdiction Follow-up

An all-jurisdiction comparison found the bundled atlas had 29 Alaska shapes
against 30 current TIGERweb county equivalents, 8 Connecticut shapes against
9, and 3 American Samoa shapes against 5. The route now requests simplified
GeoJSON geometry directly from TIGERweb. The UI uses those current features for
the map and directory together, retaining bundled geometry only as the
explicit request-failure fallback.
