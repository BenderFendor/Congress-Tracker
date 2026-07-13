export const INITIAL_DIRECTORY_ROWS = 24

export function normalizeDirectoryQuery(value) {
  return value.trim().toLocaleLowerCase("en-US")
}

export function candidateMatches(candidate, filters) {
  const query = normalizeDirectoryQuery(filters.query ?? "")
  const searchable = [candidate.name, candidate.candidate_id, candidate.party, candidate.state]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en-US")

  return (!query || searchable.includes(query))
    && (filters.state === "all" || candidate.state === filters.state)
    && (filters.office === "all" || candidate.office_sought === filters.office)
}

export function committeeMatches(committee, queryValue) {
  const query = normalizeDirectoryQuery(queryValue)
  if (!query) return true
  return [committee.committee_name, committee.committee_id, committee.party, committee.state]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en-US")
    .includes(query)
}

export function formatDisclosureBound(value, unavailable, side) {
  if (value === null || unavailable) return side === "upper" ? "No finite upper bound" : "Lower bound unavailable"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDisclosureRange(snapshot) {
  return `${formatDisclosureBound(snapshot.net_worth_min, snapshot.lower_bound_unavailable, "lower")} to ${formatDisclosureBound(snapshot.net_worth_max, snapshot.upper_bound_unavailable, "upper")}`
}

export function snapshotMatches(snapshot, filters) {
  const query = normalizeDirectoryQuery(filters.query ?? "")
  const searchable = [snapshot.member_name, snapshot.state, snapshot.chamber, snapshot.bioguide_id]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en-US")
  return (!query || searchable.includes(query))
    && (filters.year === "all" || snapshot.reporting_year === Number(filters.year))
    && (filters.chamber === "all" || snapshot.chamber.toLocaleLowerCase("en-US") === filters.chamber)
}
