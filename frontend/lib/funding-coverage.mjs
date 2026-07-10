export function classifyFundingCoverage(funding) {
  if (!funding) {
    return {
      hasFundingTotals: false,
      totalsOnly: false,
      hasCanonicalRankings: false,
    }
  }

  const hasFundingTotals = funding.has_successful_fec_run !== false && [
    funding.direct_receipts,
    funding.pac_receipts,
    funding.individual_receipts,
  ].some((value) => Number(value) > 0) ||
    funding.top_donors.length > 0 ||
    funding.top_committees.length > 0

  const totalsOnly = Boolean(hasFundingTotals && funding.provenance?.sources?.some(
    (source) => source.source === "openfec" && source.status === "live_totals",
  ))
  const hasCanonicalRankings = funding.top_donors.length > 0 || funding.top_committees.length > 0

  return { hasFundingTotals, totalsOnly, hasCanonicalRankings }
}
