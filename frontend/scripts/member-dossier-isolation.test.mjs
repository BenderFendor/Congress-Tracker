import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { createMemberDossierRequest, isAbortError } from "../lib/member-dossier-request.mjs"

test("a superseded member request cannot commit a stale response", () => {
  const visibleMembers = []
  const first = createMemberDossierRequest("A000001")
  first.cancel()
  const second = createMemberDossierRequest("B000002")

  assert.equal(first.commit("A000001", () => visibleMembers.push("A000001")), false)
  assert.equal(second.commit("B000002", () => visibleMembers.push("B000002")), true)
  assert.deepEqual(visibleMembers, ["B000002"])
  assert.equal(first.signal.aborted, true)
  assert.equal(second.signal.aborted, false)
})

test("a response keyed to a different member cannot commit", () => {
  const request = createMemberDossierRequest("A000001")
  let visibleMember = null

  assert.equal(request.commit("B000002", () => { visibleMember = "B000002" }), false)
  assert.equal(visibleMember, null)
})

test("abort failures are distinguishable from real request failures", () => {
  assert.equal(isAbortError(new DOMException("superseded", "AbortError")), true)
  assert.equal(isAbortError(new Error("network unavailable")), false)
})

test("the dossier clears every member section and propagates one request signal", async () => {
  const source = await readFile(new URL("../app/legislators/[id]/page.tsx", import.meta.url), "utf8")
  const clearedState = [
    "setLegislator(null)",
    "setFunding(null)",
    "setVotes([])",
    "setVoteEvidence(null)",
    "setSponsoredBills([])",
    "setCosponsoredBills([])",
    "setRelationships([])",
    "setDisclosures(null)",
  ]

  for (const reset of clearedState) assert.match(source, new RegExp(reset.replace(/[()[\]]/g, "\\$&")))
  assert.match(source, /getLegislator\(request\.memberId, request\.signal\)/)
  assert.match(source, /getMemberFunding\(bioguideId, undefined, request\.signal\)/)
  assert.match(source, /getMemberVotes\(bioguideId, 119, request\.signal\)/)
  assert.match(source, /getMemberLegislation\(bioguideId, 119, request\.signal\)/)
  assert.match(source, /getRelationships\([^]*request\.signal\)/)
  assert.match(source, /getMemberDisclosures\(bioguideId, request\.signal\)/)
  assert.match(source, /return \(\) => request\.cancel\(\)/)
})

test("optional trade failure cannot turn a loaded member profile into not found", async () => {
  const source = await readFile(new URL("../lib/services/legislators.ts", import.meta.url), "utf8")
  assert.match(source, /Trade history unavailable; continuing with the member profile/)
  assert.match(source, /name === "AbortError"\) throw error/)
  assert.match(source, /return mapLegislator\(memberData, recentTrades\)/)
})
