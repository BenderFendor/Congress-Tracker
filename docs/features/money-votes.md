# Money-Votes Correlation Feature

Connects campaign contributions to voting records so users can see patterns of alignment between industries that fund a member and how that member votes.

## User story

An informed non-expert visits a member page and asks: "Where does their money come from, and does it connect to how they vote?"

## Evidence model

Money-votes correlations are **contextual evidence**. The UI must not present them as proof of causation. Each correlation carries:

- A section-level header explaining that patterns show alignment, not proven influence
- An inline `Pattern` badge on each correlation row linking to source FEC and vote records

## Data dependencies

| Layer | Source | Status |
|---|---|---|
| Campaign contributions | `fec_campaign_finance_cycle_summaries` by committee → industry rollup | Done (M1) |
| Vote records | `member_votes` + `roll_call_votes` via Voteview | Done (M5) |
| Industry classification | `influence_networks` with `network_type = 'industry'` | New — ADR 0001 |
| Bill-to-industry mapping | Congress.gov bill subjects + manual keyword mapping | New |
| LDA-to-bill links | `lobbying_activities` with explicit bill identifiers | Partial (M5) |

## UI pattern

Progressive reveal on the member page:

1. **Summary card**: "Rep. Smith's top funding sources and voting alignment" with the top 3 industries
2. **Expand**: full breakdown with industry name, total contributions, alignment percentage, example votes
3. **Tooltip**: `?` icon on "alignment percentage" explains the calculation
4. **Evidence tier badge**: `Pattern` badge on each correlation row, linking to source FEC/vote records

## Industry classification

See ADR 0001. Twenty high-priority industries seeded manually (pharma, defense, finance, tech, energy, agriculture, etc.) with OpenSecrets bulk data as backfill.

## Verification

1. **Rust contract test** — pinned to a known member + vote + industry combination. Asserts exact correlation values.
2. **Agent-readable spot-check script** — prints correlation data for 5 members with source record links. An agent reads and flags classification errors or suspicious patterns.

## Non-goals

- Does not claim causation
- Does not cover House/Senate floor debates or committee markup votes (roll calls only)
- Does not auto-classify industries from LDA data (circular reasoning risk)
