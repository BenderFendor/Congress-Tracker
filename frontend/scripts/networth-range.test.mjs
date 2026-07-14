// Net worth range validation contract test
// Proves that financial range calculations follow the plan's range rules.

import assert from "node:assert/strict"
import test from "node:test"

import { calculateNetWorthRange } from "../lib/financial-ui.mjs"

test("conservative net worth uses asset min minus liability max for lower bound", () => {
  const result = calculateNetWorthRange(500000, 1000000, 100000, 500000)
  assert.equal(result.min, 0)        // 500k - 500k = 0
  assert.equal(result.max, 900000)   // 1M - 100k = 900k
})

test("unbounded asset max produces null upper bound", () => {
  const result = calculateNetWorthRange(1000000, null, 200000, 500000)
  assert.equal(result.min, 500000)    // 1M - 500k = 500k
  assert.equal(result.max, null)      // unbounded
})

test("missing personal residence is not treated as zero assets", () => {
  // When personal_residence_unavailable, we do NOT add $0 to the lower bound
  const snapshot = {
    asset_min: 500000,
    asset_max: null,
    liability_min: 0,
    liability_max: 200000,
    personal_residence_unavailable: true,
  }
  // Lower bound should NOT be reduced because residence is excluded
  const result = calculateNetWorthRange(
    snapshot.asset_min,
    snapshot.asset_max,
    snapshot.liability_min,
    snapshot.liability_max,
  )
  assert.equal(result.min, 300000)  // 500k - 200k = 300k (NOT: 500k - 0 = 500k)
})

test("null asset min returns insufficient bounds", () => {
  const result = calculateNetWorthRange(null, 500000, 0, 100000)
  assert.equal(result.min, null)
  assert.equal(result.max, null)
  assert.equal(result.reason, "insufficient bounds")
})

test("snapshot with all bounds present computes complete range", () => {
  // Kevin Hern (from live API): assets 218M unbounded, liabilities 30K-100K
  const result = calculateNetWorthRange(218472321, null, 30002, 100000)
  assert.equal(result.min, 218372321)   // 218,472,321 - 100,000
  assert.equal(result.max, null)         // unbounded asset max
})
