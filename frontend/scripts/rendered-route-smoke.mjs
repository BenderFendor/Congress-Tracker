import assert from "node:assert/strict"

const baseUrl = process.env.FRONTEND_URL || "http://127.0.0.1:3099"

const routes = [
  ["search guidance", "/search", ["Start with a record or subject", "Search records"]],
  ["member loading", "/legislators/A000370", ["animate-spin"]],
  ["FEC receipts failure", "/fec/receipts?cycle=2026", ["Receipts unavailable"]],
  ["FEC disbursements failure", "/fec/disbursements?cycle=2026", ["Disbursements unavailable"]],
  ["portfolio loading", "/portfolio", ["Transaction ledger", "animate-spin"]],
  ["net-worth failure", "/networth", ["Snapshot service unavailable"]],
  ["lobbying loading", "/lobbying", ["Loading lobbying filings"]],
  ["influence loading", "/influence", ["Loading network identities"]],
  ["bills loading", "/bills", ["Bill results", "animate-spin"]],
  ["organization loading", "/organizations/C00546358", ["Loading organization evidence"]],
]

for (const [name, path, expected] of routes) {
  const response = await fetch(`${baseUrl}${path}`)
  const html = await response.text()
  assert.equal(response.status, 200, `${name} route returns HTTP 200`)
  assert.ok(html.length > 1_000, `${name} route renders a non-blank document`)
  for (const marker of expected) {
    assert.ok(html.includes(marker), `${name} renders ${JSON.stringify(marker)}`)
  }
  process.stdout.write(`ok - ${name}\n`)
}
