import assert from "node:assert/strict"
import test from "node:test"

import { filingIntervalState } from "../lib/data-quality.mjs"

test("reports a measured filing interval when the backend provides one", () => {
  assert.deepEqual(filingIntervalState("2026-01-01", "2026-01-08", 7), {
    kind: "measured",
    label: "7 day filing interval",
  })
})

test("reports an explicit source anomaly for out-of-order dates", () => {
  assert.deepEqual(filingIntervalState("2026-12-26", "2026-02-09", null), {
    kind: "anomaly",
    label: "Source dates are out of order; filing interval unavailable",
  })
})

test("does not invent an interval when dates are missing", () => {
  assert.deepEqual(filingIntervalState(null, "2026-02-09", null), {
    kind: "unavailable",
    label: "Filing interval unavailable",
  })
})
