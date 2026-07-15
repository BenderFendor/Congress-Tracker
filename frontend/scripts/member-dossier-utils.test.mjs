import assert from "node:assert/strict"
import test from "node:test"

import {
  memberTabHref,
  nextMemberTab,
  normalizeMemberTab,
} from "../lib/member-dossier-state.mjs"
import {
  buildDownloadFilename,
  sanitizeFilename,
  serializeCsv,
} from "../lib/download-utils.mjs"

test("member dossier tabs reject unknown URL state", () => {
  assert.equal(normalizeMemberTab("votes"), "votes")
  assert.equal(normalizeMemberTab("donations"), "funding")
  assert.equal(normalizeMemberTab("voting"), "votes")
  assert.equal(normalizeMemberTab("unknown"), "overview")
  assert.equal(normalizeMemberTab(null), "overview")
})

test("member dossier keyboard navigation wraps and supports boundaries", () => {
  assert.equal(nextMemberTab("overview", "ArrowLeft"), "biography")
  assert.equal(nextMemberTab("biography", "ArrowRight"), "overview")
  assert.equal(nextMemberTab("trades", "Home"), "overview")
  assert.equal(nextMemberTab("trades", "End"), "biography")
})

test("member dossier URLs remain shareable without duplicate tab params", () => {
  assert.equal(memberTabHref("/legislators/A000001?tab=votes", "funding"), "/legislators/A000001?tab=funding")
  assert.equal(memberTabHref("/legislators/A000001?tab=votes", "overview"), "/legislators/A000001")
})

test("download filenames are stable and filesystem safe", () => {
  const date = new Date("2026-07-14T12:00:00Z")
  assert.equal(sanitizeFilename("Rep. José / Smith"), "rep.-jose-smith")
  assert.equal(buildDownloadFilename("Rep. José / Smith", ".CSV", date), "rep.-jose-smith-2026-07-14.csv")
})

test("CSV serialization preserves columns and escapes quotes and newlines", () => {
  const csv = serializeCsv([
    { type: "member", name: 'Jane "JJ" Doe', note: "line one\nline two" },
    { type: "vote", name: "Jane Doe", result: "Passed" },
  ])
  assert.equal(
    csv,
    'type,name,note,result\nmember,"Jane ""JJ"" Doe","line one\nline two",\nvote,Jane Doe,,Passed',
  )
})
