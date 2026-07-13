// Populated live API flow tests.
// Run through `pnpm test:live-api`; the wrapper builds and starts the current
// backend binary on an isolated port so a stale localhost service cannot pass.

import assert from "node:assert/strict"
import test from "node:test"

const BACKEND = process.env.BACKEND_URL
if (!BACKEND) {
  throw new Error("BACKEND_URL is required; run this suite through pnpm test:live-api")
}
const backendUrl = new URL(BACKEND)
if (backendUrl.port === "4020") {
  throw new Error("the populated live suite refuses the normal development port 4020")
}

async function fetchJson(path) {
  const response = await fetch(new URL(path, backendUrl))
  return { status: response.status, data: await response.json() }
}

// ── Health ──

test("health endpoint returns ok", async () => {
  const { status, data } = await fetchJson("/api/health")
  assert.equal(status, 200)
  assert.equal(data.status, "ok")
  assert.equal(data.db, true)
})

// ── Member funding ──

test("member funding returns structured data for known member", async () => {
  const { status, data } = await fetchJson("/api/members/A000370/funding?cycle=2026")
  assert.equal(status, 200)
  assert.equal(data.bioguide_id, "A000370")
  assert.equal(typeof data.direct_receipts, "number")
  assert.ok(Array.isArray(data.top_donors), "top_donors is an array")
})

test("member funding returns 404 for non-existent member", async () => {
  const { status } = await fetchJson("/api/members/ZZZZZZ/funding?cycle=2026")
  assert.equal(status, 404)
})

// ── FEC receipts ──

test("FEC receipts returns paginated data with coverage metadata", async () => {
  const { status, data } = await fetchJson("/api/fec/receipts?cycle=2026&limit=2")
  assert.equal(status, 200)
  assert.ok(Array.isArray(data.data), "data is an array")
  assert.ok(data.meta, "has meta")
  assert.ok(data.meta.paging, "has paging")
  assert.ok(data.provenance, "has provenance")
  assert.ok(data.provenance.warnings, "has provenance warnings")

  if (data.data.length > 0) {
    const row = data.data[0]
    assert.ok("source_record_id" in row, "has source_record_id")
    assert.ok("amount" in row, "has amount")
    assert.ok("include_in_totals" in row, "has include_in_totals flag")
  }
})

test("FEC disbursements preserves partial or loaded coverage metadata", async () => {
  const { status, data } = await fetchJson("/api/fec/disbursements?cycle=2026&limit=2")
  assert.equal(status, 200)
  assert.ok(Array.isArray(data.data), "data is an array")
  assert.ok(["loaded", "partial", "not_ingested"].includes(data.meta.coverage_status))
  assert.equal(typeof data.meta.paging.total_is_exact, "boolean")
  assert.ok(Array.isArray(data.provenance.warnings))
})

// ── Search ──

test("search returns member and PAC results", async () => {
  const { status, data } = await fetchJson("/api/search?q=Alma%20Adams")
  assert.equal(status, 200)
  assert.ok(data.total > 0, "search returns results")
  assert.ok(Array.isArray(data.results), "results is an array")
  const memberResult = data.results.find(r => r.type === "member")
  assert.ok(memberResult, "has member result")
  assert.equal(memberResult.id, "A000370")
})

// ── Lobbying filing list ──

test("lobbying filings returns data with client and registrant", async () => {
  const { status, data } = await fetchJson("/api/lobbying/filings?limit=2")
  assert.equal(status, 200)
  assert.ok(Array.isArray(data.filings), "filings is an array")
  if (data.filings.length > 0) {
    const filing = data.filings[0]
    assert.ok(filing.filing_uuid, "has filing_uuid")
    assert.ok("client_name" in filing, "has client_name")
    assert.ok("registrant_name" in filing, "has registrant_name")
  }
})

// ── Lobbying clients ──

test("lobbying clients returns list with filing counts", async () => {
  const { status, data } = await fetchJson("/api/lobbying/clients?limit=2")
  assert.equal(status, 200)
  assert.ok(Array.isArray(data.clients), "clients is an array")
  if (data.clients.length > 0) {
    const client = data.clients[0]
    assert.ok(client.name, "has name")
    assert.ok("filing_count" in client, "has filing_count")
  }
})

test("lobbying registrants and lobbyists expose stable identity lists", async () => {
  for (const kind of ["registrants", "lobbyists"]) {
    const { status, data } = await fetchJson(`/api/lobbying/${kind}?limit=2`)
    assert.equal(status, 200)
    assert.ok(Array.isArray(data[kind]), `${kind} is an array`)
    assert.equal(typeof data.total, "number")
    if (data[kind].length > 0) {
      assert.equal(typeof data[kind][0].id, "number")
      assert.ok("filing_count" in data[kind][0])
    }
  }
})

test("lobbying entity detail includes source-backed filing history", async () => {
  const list = await fetchJson("/api/lobbying/clients?limit=1")
  assert.equal(list.status, 200)
  if (list.data.clients.length === 0) return
  const { status, data } = await fetchJson(`/api/lobbying/clients/${list.data.clients[0].id}`)
  assert.equal(status, 200)
  assert.ok(Array.isArray(data.filings))
  if (data.filings.length > 0) {
    assert.match(data.filings[0].source_url, /^https:\/\//)
  }
})

// ── Financial snapshots ──

test("financial snapshots returns range-aware data", async () => {
  const { status, data } = await fetchJson("/api/financial-snapshots?limit=2")
  assert.equal(status, 200)
  assert.ok(data.snapshots, "has snapshots")
  if (data.snapshots.length > 0) {
    const snapshot = data.snapshots[0]
    assert.ok("bioguide_id" in snapshot, "has bioguide_id")
    assert.ok("asset_min" in snapshot, "has asset_min")
    assert.ok("asset_max" in snapshot, "has asset_max (may be null)")
    assert.ok("net_worth_min" in snapshot, "has net_worth_min")
    assert.ok("methodology_warnings" in snapshot, "has methodology_warnings")
  }
})

test("member disclosures remain a distinct source-backed flow", async () => {
  const { status, data } = await fetchJson("/api/members/A000370/disclosures")
  assert.equal(status, 200)
  assert.ok(Array.isArray(data.documents), "documents is an array")
  assert.ok(Array.isArray(data.transactions), "transactions is an array")
})

test("bill stream and source-linked detail use canonical routes", async () => {
  const list = await fetchJson("/api/bills?limit=1")
  assert.equal(list.status, 200)
  assert.ok(Array.isArray(list.data.bills))
  if (list.data.bills.length === 0) return
  const bill = list.data.bills[0]
  const detail = await fetchJson(`/api/bills/${bill.congress}/${bill.bill_type}/${bill.bill_number}/intel`)
  assert.equal(detail.status, 200)
  assert.ok(detail.data.bill)
  assert.ok(Array.isArray(detail.data.amendments))
  assert.ok(Array.isArray(detail.data.lobbying_bill_links))
})

// ── Organization by FEC ID ──

test("organization lookup by FEC committee ID works", async () => {
  const { status, data } = await fetchJson("/api/organizations/C00546358")
  assert.equal(status, 200)
  assert.equal(data.canonical_name, "ALMA ADAMS FOR CONGRESS")
  assert.equal(data.organization_type, "pac")
  assert.ok(Array.isArray(data.identifiers), "has identifiers")
  const fecId = data.identifiers.find(i => i.scheme === "fec")
  assert.ok(fecId, "has FEC identifier")
  assert.equal(fecId.value, "C00546358")
  assert.ok(Array.isArray(data.relationships), "has relationship evidence tiers")
})

// ── Influence network ──

test("influence network returns verified committee list", async () => {
  const { status, data } = await fetchJson("/api/influence/networks/aipac")
  assert.equal(status, 200)
  assert.equal(data.network_slug, "aipac")
  assert.ok(Array.isArray(data.committees), "has committees")
  assert.ok(data.committees.length > 0, "has at least one committee")
  const firstCommittee = data.committees[0]
  assert.equal(firstCommittee.confidence, "verified")
  assert.ok(firstCommittee.committee_id, "retains exact FEC committee identity")
  assert.ok(firstCommittee.source_citation, "displays relationship provenance")
  assert.ok(data.aliases.includes("United Democracy Project"), "supports AIPAC alias search metadata")
})

test("influence financial flow reports coverage without combining channels", async () => {
  const { status, data } = await fetchJson("/api/influence/networks/aipac/financials?cycle=2024")
  assert.equal(status, 200)
  assert.equal(data.cycle, 2024)
  assert.ok(Array.isArray(data.top_recipients))
  assert.equal(typeof data.total_direct_contributions, "number")
  assert.equal(typeof data.total_independent_supporting, "number")
  assert.equal(typeof data.total_independent_opposing, "number")
})

test("AIPAC and a non-AIPAC network share the same API contract", async () => {
  const [aipac, nra] = await Promise.all([
    fetchJson("/api/influence/networks/aipac"),
    fetchJson("/api/influence/networks/nra"),
  ])
  for (const response of [aipac, nra]) {
    assert.equal(response.status, 200)
    assert.equal(typeof response.data.network_slug, "string")
    assert.ok(Array.isArray(response.data.aliases), "has aliases array")
    assert.ok(Array.isArray(response.data.committees), "has committees array")
    assert.ok(response.data.committees.length > 0, "has a verified source identity")
    assert.ok(response.data.committees.every(committee => committee.committee_id && committee.committee_name && committee.source_citation))
  }
})

// ── Senate disclosures ──

test("senate disclosures returns an explicit current coverage state", async () => {
  const { status, data } = await fetchJson("/api/senate-disclosures")
  assert.equal(status, 200)
  assert.ok([
    "missing_consent",
    "missing_filing",
    "ambiguous_identity",
    "parser_failure",
    "loaded",
  ].includes(data.coverage), `unexpected Senate coverage state: ${data.coverage}`)
  assert.ok(Array.isArray(data.reports), "reports is an array")
  assert.ok(Array.isArray(data.provenance?.sources), "has provenance sources")
  assert.ok(Array.isArray(data.provenance?.warnings), "has provenance warnings")
  if (data.coverage === "missing_consent") {
    assert.ok(
      data.provenance.warnings.includes("senate_efd_requires_explicit_operator_terms_acceptance"),
      "missing consent retains its explicit warning",
    )
  }
})
