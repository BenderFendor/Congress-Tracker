import assert from "node:assert/strict"
import test from "node:test"

import { classifyFundingCoverage } from "../lib/funding-coverage.mjs"

const liveTotals = {
  has_successful_fec_run: true,
  direct_receipts: 337831.09,
  pac_receipts: 247300,
  individual_receipts: 75785,
  top_donors: [],
  top_committees: [],
  provenance: { sources: [{ source: "openfec", status: "live_totals" }] },
}

test("classifies OpenFEC candidate totals without rankings", () => {
  assert.deepEqual(classifyFundingCoverage(liveTotals), {
    hasFundingTotals: true,
    totalsOnly: true,
    hasCanonicalRankings: false,
  })
})

test("classifies canonical donor or committee rankings as complete coverage", () => {
  assert.deepEqual(classifyFundingCoverage({
    ...liveTotals,
    provenance: { sources: [{ source: "openfec", status: "loaded" }] },
    top_donors: [{ contributor_name: "PAC", amount: 100, count: 1 }],
  }), {
    hasFundingTotals: true,
    totalsOnly: false,
    hasCanonicalRankings: true,
  })
})

test("does not treat missing or failed funding data as zero totals", () => {
  assert.deepEqual(classifyFundingCoverage(null), {
    hasFundingTotals: false,
    totalsOnly: false,
    hasCanonicalRankings: false,
  })
  assert.deepEqual(classifyFundingCoverage({
    ...liveTotals,
    has_successful_fec_run: false,
    direct_receipts: 0,
    pac_receipts: 0,
    individual_receipts: 0,
  }), {
    hasFundingTotals: false,
    totalsOnly: false,
    hasCanonicalRankings: false,
  })
})
