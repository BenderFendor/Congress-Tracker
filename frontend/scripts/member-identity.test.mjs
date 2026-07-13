import assert from "node:assert/strict"
import test from "node:test"
import {
  canonicalBioguideId,
  isUsablePortraitUrl,
  memberInitials,
  memberPortraitCandidates,
} from "../lib/member-identity.mjs"

test("rejects Congress API metadata URLs as portraits", () => {
  assert.equal(isUsablePortraitUrl("https://api.congress.gov/v3/member/A000371?format=json"), false)
  assert.equal(isUsablePortraitUrl("https://example.test/member.json"), false)
})

test("orders valid supplied portraits before the official Bioguide fallback", () => {
  assert.deepEqual(memberPortraitCandidates({
    bioguideId: "a000371",
    suppliedUrls: [
      "https://api.congress.gov/v3/member/A000371?format=json",
      "https://example.test/member.jpg",
    ],
  }), [
    "https://example.test/member.jpg",
    "https://bioguide.congress.gov/bioguide/photo/A/A000371.jpg",
  ])
})

test("normalizes canonical identifiers and provides a deterministic initials fallback", () => {
  assert.equal(canonicalBioguideId(" a000371 "), "A000371")
  assert.equal(canonicalBioguideId("not-an-id"), "")
  assert.equal(memberInitials("Alma S. Adams"), "AS")
  assert.equal(memberInitials(""), "?")
})
