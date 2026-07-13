export function availableCount(records, failed) {
  return failed ? "Unavailable" : records.length
}

/**
 * @param {{ loading?: boolean, error?: string | null, responseLoaded?: boolean, count?: number, partial?: boolean }} state
 * @returns {"loading" | "error" | "unavailable" | "empty" | "partial" | "loaded"}
 */
export function requestTruthState({ loading = false, error = null, responseLoaded = false, count = 0, partial = false }) {
  if (loading) return "loading"
  if (error) return "error"
  if (!responseLoaded) return "unavailable"
  if (partial) return "partial"
  return count === 0 ? "empty" : "loaded"
}

export function influenceNetworkCoverage(committees, cycle) {
  return {
    affiliatedCount: committees.length,
    affiliatedDetail: committees.length > 0
      ? "Explicitly linked PACs and filers"
      : "No explicit links in this source run",
    cycleValue: typeof cycle === "number" ? String(cycle) : "Unavailable",
    cycleDetail: typeof cycle === "number"
      ? "Reporting cycle supplied by the network source"
      : "The network detail source does not report a cycle",
  }
}
