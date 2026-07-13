# Industry classification via extended influence_networks

Industry sectors (Pharma, Defense, Tech) are stored as rows in the `influence_networks` table with `network_type = 'industry'`, rather than in a separate table. Organization networks (AIPAC, NRA, PhRMA) use `network_type = 'organization'`.

## Why

The alternatives were:

1. **Separate `industry_classifications` table** — clean separation, unambiguous queries, but duplicates the committee-tagging infrastructure (APIs, frontend components, materialized views) already built for influence networks.

2. **External enrichment service** — keeps the DB clean but adds a runtime dependency for every member-page render.

Extending `influence_networks` with a `network_type` column reuses the existing pipeline:
- Same committee-tagging UI and APIs
- Same influence-network frontend components
- Same materialized views for member-industry totals
- A single committee (e.g. Pfizer's PAC) can belong to both PhRMA (organization) and Pharma (industry)

The type column ensures queries can distinguish organizations (which carry lobbying data) from industries (which aggregate across committees without lobbying data).
