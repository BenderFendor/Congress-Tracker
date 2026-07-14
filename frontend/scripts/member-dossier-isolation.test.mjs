import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { createMemberDossierRequest, isAbortError } from "../lib/member-dossier-request.mjs"

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8")
}

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

test("the refactored dossier resets every resource and aborts stale requests", async () => {
  const hook = await source("components/dossiers/member/use-member-dossier.ts")

  for (const resource of ["profile", "funding", "votes", "legislation", "trades", "relationships", "disclosures"]) {
    assert.match(hook, new RegExp(`${resource}: idleResource\\(\\)`))
  }
  assert.match(hook, /profileRequest\.current\?\.abort\(\)/)
  assert.match(hook, /for \(const controller of Object\.values\(requests\.current\)\) controller\?\.abort\(\)/)
  assert.match(hook, /memberIdRef\.current !== requestedMember/)
  assert.match(hook, /getLegislator\(requestedMember, controller\.signal\)/)
  assert.match(hook, /getMemberFunding\(bioguideId, undefined, signal\)/)
  assert.match(hook, /getMemberVotes\(bioguideId, 119, signal\)/)
  assert.match(hook, /getMemberLegislation\(bioguideId, \{ limit: 25 \}, signal\)/)
  assert.match(hook, /getRelationships\(\{ subjectKey: `member:\$\{bioguideId\}`/)
  assert.match(hook, /getMemberDisclosures\(bioguideId, signal\)/)
  assert.match(hook, /return \(\) => controller\.abort\(\)/)
})

test("optional trade failure cannot turn a loaded member profile into not found", async () => {
  const service = await source("lib/services/legislators.ts")
  assert.match(service, /Trade history unavailable; continuing with the member profile/)
  assert.match(service, /name === "AbortError"\) throw error/)
  assert.match(service, /return mapLegislator\(memberData, recentTrades, tradeCoverage\)/)
})

test("member trades remain member-keyed, paginated, and coverage-honest", async () => {
  const service = await source("lib/services/stocks.ts")
  const legislators = await source("lib/services/legislators.ts")
  const hook = await source("components/dossiers/member/use-member-dossier.ts")
  const financial = await source("components/dossiers/member/member-financial.tsx")
  const dossier = await source("components/dossiers/member/member-dossier.tsx")

  assert.match(service, /\/api\/members\/\$\{encodeURIComponent\(memberId\)\}\/trades/)
  assert.doesNotMatch(service, /getIntelTrades\(200[^]*\.filter\(/)
  assert.match(legislators, /response\.coverage\.status/)
  assert.match(legislators, /response\.coverage\.excluded_date_anomalies/)
  assert.match(hook, /getTradesByMemberId\(bioguideId, 100, Math\.max\(0, offset\), signal\)/)
  assert.match(financial, /trades\.coverage\.message/)
  assert.match(financial, /highest_conflict_severity/)
  assert.match(financial, /conflict_flag_count/)
  assert.match(financial, /contextual evidence rather than proof of misconduct/)
  assert.match(dossier, /Missing channels are not factual zeroes/)
  assert.doesNotMatch(financial, /Standard Filing/)
})

test("member tabs expose keyboard, URL, and mobile-scroll contracts", async () => {
  const tabs = await source("components/dossiers/member/member-dossier-ui.tsx")
  const state = await source("lib/member-dossier-state.mjs")
  const hook = await source("components/dossiers/member/use-member-dossier.ts")

  assert.match(tabs, /role="tablist"/)
  assert.match(tabs, /role="tab"/)
  assert.match(tabs, /aria-selected=\{activeTab === tab\.id\}/)
  assert.match(tabs, /aria-controls=\{`member-panel-/)
  assert.match(tabs, /role="tabpanel"/)
  assert.match(tabs, /overflow-x-auto/)
  assert.match(tabs, /scrollIntoView/)
  assert.match(state, /"ArrowLeft"/)
  assert.match(state, /"ArrowRight"/)
  assert.match(state, /url\.searchParams\.set\("tab"/)
  assert.match(hook, /window\.addEventListener\("popstate"/)
  assert.match(hook, /window\.history\.pushState/)
})

test("trade navigation replaces pages instead of concatenating stale records", async () => {
  const hook = await source("components/dossiers/member/use-member-dossier.ts")
  const financial = await source("components/dossiers/member/member-financial.tsx")

  assert.match(hook, /getTradesByMemberId\(bioguideId, 100, Math\.max\(0, offset\), signal\)/)
  assert.match(hook, /setter\(\{ status: "loaded", data, error: null \}\)/)
  assert.doesNotMatch(hook, /trades:\s*\[\.\.\./)
  assert.match(financial, /disabled=\{loading \|\| trades\.offset === 0\}/)
  assert.match(financial, /disabled=\{loading \|\| !trades\.coverage\.has_more\}/)
  assert.match(financial, />Previous</)
  assert.match(financial, />Next</)
})

test("member legislation retains official links, coverage state, and independent pagination", async () => {
  const service = await source("lib/services/legislators.ts")
  const hook = await source("components/dossiers/member/use-member-dossier.ts")
  const legislative = await source("components/dossiers/member/member-legislative.tsx")

  assert.match(service, /related_items:/)
  assert.match(service, /sponsorOffset/)
  assert.match(service, /cosponsorOffset/)
  assert.match(service, /relatedOffset/)
  assert.match(service, /coverage_scope: "all_history"/)
  assert.match(service, /coverage:/)
  assert.match(hook, /sponsorOffset: section === "sponsor"/)
  assert.match(hook, /cosponsorOffset: section === "cosponsor"/)
  assert.match(hook, /relatedOffset: section === "related_items"/)
  assert.match(legislative, /legislation\.latest_attempt/)
  assert.match(legislative, /legislation\.pagination\.sponsor/)
  assert.match(legislative, /legislation\.pagination\.cosponsor/)
  assert.match(legislative, /legislation\.pagination\.related_items/)
  assert.match(legislative, /href=\{`\/bills\/\$\{bill\.bill_id\}`\}/)
  assert.match(legislative, /item\.source_url/)
  assert.match(legislative, /No rows are loaded on this page/)
  assert.doesNotMatch(legislative, /line-clamp-3/)
})
