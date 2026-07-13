import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const helperSource = await readFile(
  new URL("../components/elections/election-map-helpers.ts", import.meta.url),
  "utf8",
)
const mapSource = await readFile(
  new URL("../components/elections/election-map.tsx", import.meta.url),
  "utf8",
)

test("election metrics expose filing activity without invented race ratings", () => {
  assert.match(helperSource, /type Metric = "candidates" \| "incumbents" \| "open-seats"/)
  assert.doesNotMatch(helperSource, /ratingLabel|partyLean|competitivenessScore/)
  assert.doesNotMatch(mapSource, /Most competitive state races|Party lean|Toss-up|Safe D|Safe R/)
  assert.match(mapSource, /not vote share, election results, competitiveness, or a forecast/)
})

test("common FEC party codes are classified explicitly", () => {
  assert.match(helperSource, /\["D", "DEM", "DFL"\]/)
  assert.match(helperSource, /\["R", "REP", "GOP"\]/)
  assert.match(helperSource, /\["I", "IND", "NPA"\]/)
})
