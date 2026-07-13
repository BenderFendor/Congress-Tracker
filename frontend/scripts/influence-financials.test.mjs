import assert from "node:assert/strict"
import test from "node:test"

import { buildInfluenceFlow, safeMoney } from "../lib/influence-financials.mjs"

test("influence flow keeps direct, support, and opposition separate", () => {
  const flow = buildInfluenceFlow({
    total_direct_contributions: 30,
    total_independent_supporting: 20,
    total_independent_opposing: 50,
    total_all: 100,
    top_recipients: [],
  })

  assert.deepEqual(flow.channels.map(({ key, amount }) => ({ key, amount })), [
    { key: "direct", amount: 30 },
    { key: "support", amount: 20 },
    { key: "oppose", amount: 50 },
  ])
  assert.equal(flow.calculatedTotal, 100)
  assert.equal(flow.reconciled, true)
})

test("influence flow flags a reported total that does not reconcile", () => {
  const flow = buildInfluenceFlow({
    total_direct_contributions: 10,
    total_independent_supporting: 20,
    total_independent_opposing: 30,
    total_all: 999,
    top_recipients: [],
  })

  assert.equal(flow.calculatedTotal, 60)
  assert.equal(flow.reportedTotal, 999)
  assert.equal(flow.reconciled, false)
})

test("recipient coverage reconciles explicit per-recipient activity channels", () => {
  const flow = buildInfluenceFlow({
    total_direct_contributions: 40,
    total_independent_supporting: 60,
    total_independent_opposing: 0,
    total_all: 100,
    top_recipients: [
      { bioguide_id: "A1", total_received: 10, direct_contributions: 10, independent_supporting: 20, independent_opposing: 30, total_activity: 60 },
      { bioguide_id: "B2", total_received: 30, direct_contributions: 30, independent_supporting: 0, independent_opposing: 0, total_activity: 30 },
      { bioguide_id: "", total_received: 10, direct_contributions: 10, independent_supporting: 0, independent_opposing: 0, total_activity: 10 },
    ],
  })

  assert.equal(flow.recipientTotal, 90)
  assert.equal(flow.recipientCoverage, 0.9)
  assert.deepEqual(flow.recipients.map((recipient) => recipient.bioguide_id), ["A1", "B2"])
  assert.deepEqual(
    flow.recipients.map(({ bioguide_id, direct, support, oppose, amount }) => ({ bioguide_id, direct, support, oppose, amount })),
    [
      { bioguide_id: "A1", direct: 10, support: 20, oppose: 30, amount: 60 },
      { bioguide_id: "B2", direct: 30, support: 0, oppose: 0, amount: 30 },
    ],
  )
})

test("opposition activity is never presented as money received", () => {
  const flow = buildInfluenceFlow({
    total_direct_contributions: 0,
    total_independent_supporting: 0,
    total_independent_opposing: 75,
    total_all: 75,
    top_recipients: [{
      bioguide_id: "A1",
      total_received: 0,
      direct_contributions: 0,
      independent_supporting: 0,
      independent_opposing: 75,
      total_activity: 75,
    }],
  })

  assert.equal(flow.recipients[0].amount, 75)
  assert.equal(flow.recipients[0].direct, 0)
  assert.equal(flow.recipients[0].oppose, 75)
  assert.equal(flow.recipientCoverage, 1)
})

test("invalid and negative money values become zero", () => {
  assert.equal(safeMoney("not-a-number"), 0)
  assert.equal(safeMoney(-12), 0)
  assert.equal(safeMoney("12.50"), 12.5)
})
