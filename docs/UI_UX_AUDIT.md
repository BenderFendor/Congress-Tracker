# CongressTracker UI and UX Audit

This document records product-interface findings and the design direction for
CongressTracker evidence workflows. It covers desktop and mobile hierarchy,
navigation, interaction feedback, motion, accessibility, and data-density
decisions. Re-check these findings after major route or design-system changes.

**Audit date:** 2026-07-12

## Design Direction

**Visual thesis:** A public-record reading room with the speed and precision of
a modern research terminal. Editorial typography establishes trust. Restrained
red, navy, and evidence-blue accents communicate state and action.

**Interaction thesis:** Pages should reveal their structure quickly, preserve
the user's research context, and use short motion to clarify loading, filtering,
and navigation. Motion must stop under `prefers-reduced-motion`.

## Findings

### Legislator evidence tabs

- The Votes tab previously rendered a bare `0.0%` and `N/A` without a denominator, date range, or explanation. The backend calculation also compared vote positions to party codes, making party alignment invalid. The revised card states the Congress scope, coverage dates, numerator, denominator, formula, and explicit unavailable condition.
- The Bills tab now identifies a missing canonical member-to-bill relation as a Congress.gov linkage gap instead of implying that the member sponsored no legislation.
- Biography cards distinguish unavailable structured fields from negative claims. Education and employment are not inferred from community biography prose.
- The shared `MemberPortrait` resolver owns the detail-page portrait fallback. Chrome confirmed the official Bioguide image loaded for A000370.

1. Entity browsing lacks local navigation. Users can enter a client list but
   cannot move directly between clients, registrants, and lobbyists. Add a
   persistent entity switcher and clear result scope.
2. Long evidence lists are visually flat. Fifty equally weighted rows make
   scanning slow and push provenance far below the fold. Use a smaller initial
   window, stronger row rhythm, visible filing counts, and progressive loading.
3. Search feedback is weak. The interface updates after a request but does not
   make result count or active scope prominent. Keep the toolbar near the list
   and show loaded versus total records.
4. Page entrances are inconsistent. Shared archive surfaces have motion tokens,
   but dense rows appear all at once. Add a short capped stagger that preserves
   reading order and avoids delaying interaction.
5. Detail pages need better research continuity. Official filing links exist,
   but users need a direct return path to the same entity family and clear
   separation between LDA evidence and campaign finance.
6. Mobile density needs deliberate controls. Full-width rows work, but actions
   and counts should remain easy to scan without horizontal overflow or tiny
   tap targets.
7. The home page previously converted independent API failures into factual
   zeroes, and influence detail invented a fallback affiliation count and
   cycle. Failure, empty, and loaded states must remain distinct.
8. Several detail and list routes still conflate request failure with empty or
   not found. Bills, committees, candidates, disbursements, and influence
   surfaces need explicit error-state contracts.
9. M1 through M5 routes are underrepresented in global navigation and search,
   which makes new evidence workflows difficult to discover.
10. Full-width visual decoration must not escape the mobile viewport. The home
    observatory exceeded 390px, and scroll-timeline entrances could hide entire
    below-fold sections during fast scrolling and full-page capture.

## Implemented In The LDA Entity Pass

- Added client, registrant, and lobbyist list and detail routes.
- Added a shared entity-family switcher and result metrics.
- Reduced the initial result window and added progressive loading.
- Added capped row entrance motion, hover/focus feedback, and reduced-motion
  support through the existing global policy.
- Preserved official filing links and explicit separation from campaign-finance
  totals.
- Verified representative routes in Chrome at 1440px and 390px with no console
  errors or horizontal overflow.

## Implemented In The Truth-State And Mobile Pass

- Replaced home-page false zeroes with independent unavailable and
  request-failed states while preserving genuine zeroes.
- Removed the fabricated influence affiliation fallback and hard-coded cycle.
  The detail page now uses source metadata or labels the cycle unavailable.
- Constrained the mobile observatory to the viewport and disabled section
  reveal animations below 720px so content remains immediately readable.
- Captured and inspected desktop and mobile PNGs after the DOM checks. The final
  390px home and influence pages have no horizontal overflow.

## Implemented In The Shared Frontend Revamp

- Reworked the archive primitives around a civic reading-room thesis: editorial
  titles orient the user, while compact monospace labels identify record scope,
  provenance, and state.
- Rebalanced shared heroes, metric rails, panels, and search controls with a
  consistent max width, responsive gutter, stronger section separators, and
  fewer competing decorative treatments.
- Made summary metrics semantic description lists, gave every shared search
  field a unique accessible identifier, and made official-source actions full
  width and visually distinct inside evidence rails.
- Added a short shared reveal sequence, capped row motion, long-list rendering
  containment, keyboard-visible focus, and a complete reduced-motion fallback.
- Improved LDA directories with deferred search requests, clear-filter actions,
  result-scope chips, heading hierarchy, and a quieter single-ledger layout.
- Added compact context bars and top-aligned evidence sidebars to organization
  and LDA detail pages so mobile and long-record layouts do not create large
  dead zones.
- Harmonized candidate and disbursement directories through scoped shared
  styling: navy evidence surfaces replace pure black, candidate filters use a
  compact two-control row on desktop, the mobile candidate introduction is
  shorter, and all six disbursement controls align in one desktop row.
- Inspected the existing verification screenshots before implementation, then
  captured new desktop and mobile screenshots from Chrome MCP. Representative
  routes had no page-level horizontal overflow or console warnings and errors.

## Implemented In The Committee Roster Pass

- Replaced the committee detail roster table with a portrait-led editorial
  directory that matches the visual hierarchy of the legislator index.
- Separated source-designated leadership roles from the remaining roster while
  preserving the API's exact title and rank labels.
- Added official Bioguide portraits with initials fallbacks, direct legislator
  profile links, party, state and district, chamber, and visible focus states.
- Added compact mobile portrait rows, restrained hover motion, and a complete
  reduced-motion fallback.
- Preserved invalid identifier, not found, server error, retry, and successful
  empty-roster states instead of treating every missing response as an empty
  committee.
- Verified the Homeland Security committee at the available desktop viewport
  and at 390px in Chrome MCP. All 42 loaded assignments rendered with profile
  links, no page-level horizontal overflow, and no console warnings or errors.

## Implemented In The Financial Research Surfaces Pass

- Rebuilt the candidate directory as a campaign-record desk with independent
  candidate and PAC request states, a compact sticky filter workbench,
  progressive 24-row disclosure, official FEC identifiers, direct FEC record
  links, and receipt-search continuity.
- Replaced the net-worth table with a range ledger that keeps open upper and
  lower bounds textual, separates reported assets and liabilities, exposes the
  calculation date, and repeats the personal-residence caveat at record level.
- Reframed Portfolio Overview as context rather than valuation. Committee
  jurisdiction weights are explicitly distinguished from security holdings,
  source failures remain unavailable, and member coverage now uses a compact
  portrait-led roster linked to legislator records.
- Applied the reference language consistently: oversized editorial serif
  headings, Swiss-style compact metadata, horizontal rules, strong numeric
  scoreboards, navy and warm-red civic color, and restrained capped reveals.
  No decorative image collage or unsupported political imagery was added.
- Corrected compact masthead grid minimum sizing so long editorial headings and
  data visuals fit the 390px viewport instead of being clipped by an intrinsic
  500px grid column.
- Captured and visually inspected desktop and 390px screenshots for candidates,
  net-worth snapshots, and Portfolio Overview. All three routes rendered real
  loaded data without page-level horizontal overflow. Candidate and net-worth
  tabs had no console warnings or errors. Portfolio correctly surfaced two
  live disclosure API failures as unavailable states during concurrent ingest.

## Implemented In The Influence Network Pass

- Removed the decorative network diagram that implied links among Congress,
  companies, bills, votes, contracts, and other entities without record-level
  evidence.
- Replaced it with an evidence path from verified OpenFEC committee identities
  to three distinct campaign-finance channels and then to loaded member
  records. Direct contributions, independent support, and independent
  opposition remain visually and semantically separate.
- Added explicit legends, definitions, official committee links, confidence,
  cycle, source, coverage, and FEC-only scope labels. The interface does not
  allocate a network total to an individual committee because the API does not
  provide that linkage.
- Added deterministic API-total reconciliation. A mismatch becomes a partial
  data warning rather than a polished but misleading chart.
- Added a ranked member alternative with legislator links, party, chamber,
  state, exact values, and recipient-list coverage. The interface explains that
  the endpoint does not expose per-recipient channel allocation.
- Captured and inspected desktop and mobile screenshots in Chrome MCP. The
  1440px and 390px route had no page-level horizontal overflow, blank state,
  console error, or console warning.

## Implemented In The Election County Pass

- Fixed the county drill-down state transition so selecting a county keeps the
  selected state's county geometry on screen instead of redrawing the national
  state map.
- Replaced the broken Census Data API name request with a cached, state-scoped
  Census TIGERweb request. County names, FIPS codes, source, cache lifetime,
  retrieval time, and result-coverage state are now explicit.
- Added a state selector and a searchable county directory as an accessible
  alternative to the SVG map. County controls retain a 48px minimum height on
  mobile.
- Removed factual zeroes from county tooltips and details. The UI now says
  `Election results: Not loaded` because FEC candidate filings cannot be
  truthfully allocated from congressional districts to individual counties.
- Added direct links to Census TIGERweb, the Election Assistance Commission's
  state authority directory, and FEC candidate filings.
- Verified California and Alameda County in Chrome at 1440px and 390px. Both
  widths retained 58 county paths, rendered 58 named directory entries, had no
  horizontal overflow, and produced no errors or warnings in a clean tab.
- Expanded the selector and acquisition contract from a California proof to
  all 50 states, DC, and the five U.S. territories represented by both Census
  TIGERweb and the map layer. States and territories are grouped separately in
  the selector.
- Replaced the older bundled county topology during drill-down with simplified
  current TIGERweb GeoJSON. This closes measured county-equivalent gaps in
  Alaska, Connecticut, and American Samoa and keeps the map and directory on
  one source vintage.
- Verified live CA to PA to TX switching in Chrome. County map prefixes and
  directory prefixes changed from 06 to 42 to 48 with counts of 58, 67, and
  254, so no California geometry remained after either switch.
- Raised every mobile map tab, selector, search field, and icon action to a
  44px control height. The 390px Pennsylvania pass had 67 synchronized paths
  and directory rows with no horizontal overflow.

## Implemented In The Reference Editorial Cohesion Pass

- Extended the supplied reference language to the source register and
  methodology without embedding or reproducing the reference images. Oversized
  serif headlines, mono metadata, numbered sections, strict rules, and
  paper-like record surfaces now connect these pages to the wider archive.
- Replaced the source register's silent freshness failure with a visible error
  state. The catalog remains usable while the interface explicitly declines to
  infer live pipeline status.
- Kept lobbying list and filing-detail content inside the shared archive width
  so evidence rails align with the rest of the research routes.
- Reworked the Portfolio tab strip into three equal responsive columns. All
  labels remain visible at 390px, and long metric states such as `Unavailable`
  wrap inside their cells instead of clipping.
- Captured and inspected the source register and methodology at 1440px and the
  source register and Portfolio tabs at 390px. The checked pages had no page
  overflow, blank state, console error, or console warning.
- Replaced local navy dark-mode overrides with a centralized near-black and
  charcoal archive palette. Cobalt now signals evidence and focus while warm
  red remains the editorial accent; light-mode tokens are unchanged.
- Added one canonical member portrait resolver for directory cards, member
  details, committee rosters, and Portfolio rankings. It rejects metadata URLs,
  tries valid supplied images, falls back to the official Bioguide JPG, and
  only then renders initials.
- Verified the known malformed portrait case at `A000371` and a member with no
  supplied depiction at `A000370`. Both rendered their canonical Bioguide
  portraits with no page overflow at the tested desktop and mobile widths.

## Remaining Product-Wide Work

- Apply the revised archive primitives to remaining legacy grids in funding
  and visualizations.
- Fix remaining error-versus-empty state handling on bill, influence, and other
  legacy list/detail routes.
- Add the new evidence destinations to global navigation and the command
  palette without overcrowding the primary header.
- Add route-level loading skeletons and rendered component tests.
- Test keyboard journeys and focus restoration between list and detail pages.
- Review animation performance on lower-power mobile hardware.
