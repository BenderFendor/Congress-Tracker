import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8")
}

test("candidate service uses one exact FEC identifier and official committee links", async () => {
  const service = await source("lib/services/candidates.ts")
  assert.match(service, /\/api\/elections\/candidates\/\$\{encodeURIComponent\(candidateId\)\}/)
  assert.match(service, /committee\.is_principal/)
  assert.match(service, /committeeId: committee\.committee_id/)
  assert.match(service, /getFecReceipts\(query\)/)
  assert.match(service, /getFecDisbursements\(query\)/)
  assert.doesNotMatch(service, /getLegislator|getMember|bioguide|name similarity/i)
})

test("candidate dossier keeps receipts and disbursements separate", async () => {
  const dossier = await source("components/dossiers/candidate/candidate-dossier.tsx")
  assert.match(dossier, /title="Itemized receipts"/)
  assert.match(dossier, /title="Operating disbursements"/)
  assert.match(dossier, /This channel is not presented as zero/)
  assert.match(dossier, /exact FEC candidate ID/)
  assert.match(dossier, /does not attach congressional records through candidate-name similarity/)
  assert.match(dossier, /EvidenceDownloadMenu/)
})

test("candidate route remains thin and directory navigation uses candidate IDs", async () => {
  const route = await source("app/candidates/[id]/page.tsx")
  const directory = await source("app/candidates/page.tsx")
  assert.ok(route.split("\n").length <= 10)
  assert.match(route, /CandidateDossier/)
  assert.match(directory, /href=\{`\/candidates\/\$\{encodeURIComponent\(candidate\.candidate_id\)\}`\}/)
})

test("backend route is exact-ID, cycle-bounded, and does not name-link members", async () => {
  const route = await source("../backend/crates/intel_backend/src/routes/candidates.rs")
  assert.match(route, /WHERE candidate_id = \$1/)
  assert.match(route, /fec_candidate_committees/)
  assert.match(route, /committee_designation = 'P'/)
  assert.match(route, /cycle must be an even FEC election year/)
  assert.match(route, /source_runs/)
  assert.match(route, /candidate_coverage_status/)
  assert.match(route, /loaded_empty/)
  assert.match(route, /coverage is not terminal/)
  assert.match(route, /never resolves a congressional Member by name/)
  assert.doesNotMatch(route, /members\.first_name|members\.last_name|ILIKE.*candidate/i)
})
