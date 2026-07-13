import assert from "node:assert/strict"
import test from "node:test"

import { availableCount, influenceNetworkCoverage, requestTruthState } from "../lib/truth-states.mjs"

test("preserves a genuine zero but marks a failed count unavailable", () => {
  assert.equal(availableCount([], false), 0)
  assert.equal(availableCount([], true), "Unavailable")
})

test("does not invent affiliated entities or a reporting cycle", () => {
  assert.deepEqual(influenceNetworkCoverage([], undefined), {
    affiliatedCount: 0,
    affiliatedDetail: "No explicit links in this source run",
    cycleValue: "Unavailable",
    cycleDetail: "The network detail source does not report a cycle",
  })
})

test("uses reporting cycle metadata when the source supplies it", () => {
  assert.equal(influenceNetworkCoverage([], 2024).cycleValue, "2024")
})

test("request truth states keep failures separate from loaded empty results", () => {
  assert.equal(requestTruthState({ loading: true, responseLoaded: false, count: 0 }), "loading")
  assert.equal(requestTruthState({ error: "request failed", responseLoaded: false, count: 0 }), "error")
  assert.equal(requestTruthState({ responseLoaded: false, count: 0 }), "unavailable")
  assert.equal(requestTruthState({ responseLoaded: true, count: 0 }), "empty")
  assert.equal(requestTruthState({ responseLoaded: true, count: 0, partial: true }), "partial")
  assert.equal(requestTruthState({ responseLoaded: true, count: 3, partial: true }), "partial")
  assert.equal(requestTruthState({ responseLoaded: true, count: 3 }), "loaded")
})

test("loading and request failures take precedence over partial coverage", () => {
  assert.equal(requestTruthState({ loading: true, responseLoaded: true, count: 3, partial: true }), "loading")
  assert.equal(requestTruthState({ error: "timeout", responseLoaded: true, count: 3, partial: true }), "error")
})
