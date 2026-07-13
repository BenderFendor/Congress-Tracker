import assert from "node:assert/strict"
import test from "node:test"

import {
  buildFecReceiptHref,
  buildFecReceiptQuery,
  parseOptionalReceiptNumber,
} from "../lib/fec-receipts.mjs"

test("builds a bounded canonical receipt query and omits blank filters", () => {
  const query = buildFecReceiptQuery({
    committeeId: "C00100005",
    cycle: 2026,
    search: "Smith",
    recordKind: "contribution",
    minAmount: 100,
    maxAmount: 5000,
    page: 3,
    perPage: 50,
  })

  assert.equal(
    query,
    "committee_id=C00100005&cycle=2026&q=Smith&record_kind=contribution&min_amount=100&max_amount=5000&page=3&per_page=50",
  )
})

test("clamps page size and does not serialize empty strings", () => {
  const query = buildFecReceiptQuery({
    committeeId: " ",
    search: "",
    cycle: 2026,
    page: 0,
    perPage: 999,
  })

  assert.equal(query, "cycle=2026&page=1&per_page=200")
})

test("absent amount filters stay absent instead of becoming zero-dollar filters", () => {
  assert.equal(parseOptionalReceiptNumber(undefined), undefined)
  assert.equal(parseOptionalReceiptNumber(""), undefined)
  assert.equal(parseOptionalReceiptNumber(["  "]), undefined)
  assert.equal(parseOptionalReceiptNumber("0"), 0)

  const query = buildFecReceiptQuery({
    cycle: 2026,
    minAmount: parseOptionalReceiptNumber(undefined),
    maxAmount: parseOptionalReceiptNumber(""),
  })
  assert.equal(query, "cycle=2026&page=1&per_page=50")
})

test("candidate receipt links use the canonical q parameter", () => {
  const href = buildFecReceiptHref({ search: "Alma Adams" })
  assert.equal(href, "/fec/receipts?q=Alma+Adams&page=1&per_page=50")
  assert.equal(new URL(href, "http://localhost").searchParams.has("search"), false)
})
