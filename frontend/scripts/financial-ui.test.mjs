import assert from "node:assert/strict"
import test from "node:test"

import {
  candidateMatches,
  committeeMatches,
  formatDisclosureRange,
  snapshotMatches,
} from "../lib/financial-ui.mjs"

test("candidate filters search across source identifiers without changing truth state", () => {
  const candidate = { name: "Alex Rivera", candidate_id: "H6PA02100", state: "PA", office_sought: "H", party: "DEM" }
  assert.equal(candidateMatches(candidate, { query: "h6pa", state: "PA", office: "H" }), true)
  assert.equal(candidateMatches(candidate, { query: "rivera", state: "NJ", office: "H" }), false)
})

test("committee search includes official FEC identifier and state", () => {
  const committee = { committee_name: "River City Fund", committee_id: "C00999999", state: "PA" }
  assert.equal(committeeMatches(committee, "c0099"), true)
  assert.equal(committeeMatches(committee, "california"), false)
})

test("net worth labels preserve an unbounded upper range", () => {
  const snapshot = { net_worth_min: 218372321, net_worth_max: null, lower_bound_unavailable: false, upper_bound_unavailable: true }
  assert.equal(formatDisclosureRange(snapshot), "$218,372,321 to No finite upper bound")
})

test("snapshot filters do not coerce an unavailable range into zero", () => {
  const snapshot = { member_name: "Morgan Lee", state: "CA", chamber: "House", bioguide_id: "L000001", reporting_year: 2024 }
  assert.equal(snapshotMatches(snapshot, { query: "morgan", year: "2024", chamber: "house" }), true)
  assert.equal(snapshotMatches(snapshot, { query: "", year: "2023", chamber: "house" }), false)
})
