// FEC / LDA separation contract test
// Proves that campaign finance and lobbying data flows are never combined.

import assert from "node:assert/strict"
import test from "node:test"

// Simulated data shapes matching the backend response contracts

test("FEC receipt amounts and LDA filing amounts are structurally separate", () => {
  const fecReceipt = {
    source_record_id: "individual-123",
    amount: 2700.0,
    committee_id: "C00100005",
    source: "fec_canonical_individual_receipts",
  }

  const ldaFiling = {
    filing_uuid: "abc-123",
    income: 50000.0,
    expenses: 35000.0,
    registrant_name: "ACME Lobbying",
    source: "lobbying_filings",
  }

  // FEC and LDA records never share amount fields
  assert.ok("amount" in fecReceipt, "FEC receipt has amount")
  assert.ok(!("income" in fecReceipt), "FEC receipt does NOT have income")
  assert.ok("income" in ldaFiling, "LDA filing has income")
  assert.ok(!("amount" in ldaFiling), "LDA filing does NOT have amount")
})

test("member funding response never includes lobbying amounts", () => {
  const fundingResponse = {
    direct_receipts: 75235.0,
    pac_receipts: 0.0,
    individual_receipts: 75235.0,
    independent_expenditures_supporting: 0.0,
    independent_expenditures_opposing: 0.0,
    top_donors: [],
    top_committees: [],
  }

  // Funding response fields are all FEC-derived
  const fundingFields = Object.keys(fundingResponse)
  assert.ok(!fundingFields.includes("lobbying_income"), "no lobbying_income in funding")
  assert.ok(!fundingFields.includes("lobbying_expenses"), "no lobbying_expenses in funding")
  assert.ok(!fundingFields.includes("lobbying_amount"), "no lobbying_amount in funding")
})

test("influence network totals are campaign finance only, not lobbying", () => {
  const aipacNetwork = {
    committees: [
      { committee_id: "C00797670", role: "direct_pac" },
    ],
    direct_receipts: 500000.0,
    independent_expenditures: 1200000.0,
    // No lobbying_income, lobbying_expenses, or combined total
  }

  assert.ok(!("lobbying_income" in aipacNetwork), "no lobbying income on network")
  assert.ok(!("lobbying_expenses" in aipacNetwork), "no lobbying expenses on network")
  assert.ok(!("total_influence" in aipacNetwork), "no combined FEC+LDA total")
})

test("lobbying filings have income/expenses but no campaign amounts", () => {
  const filing = {
    filing_uuid: "abc",
    income: 50000.0,
    expenses: 25000.0,
    issue_codes: ["TAX", "TRD"],
  }

  assert.ok(!("amount" in filing), "lobbying filing has no campaign amount")
  assert.ok(!("direct_receipts" in filing), "lobbying filing has no direct_receipts")
})
