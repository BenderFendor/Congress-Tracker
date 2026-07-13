import assert from "node:assert/strict"
import test from "node:test"
import { createRequire } from "node:module"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { feature } from "topojson-client"

import {
  buildCountyQueryUrl,
  candidateStateMatchesFips,
  isStateFips,
  isSupportedJurisdictionFips,
  normalizeCountyQuery,
  SUPPORTED_JURISDICTIONS,
} from "../lib/county-geography.mjs"
import {
  loadPreparedCountyFile,
  normalizePreparedCountyFile,
} from "../lib/county-geography-store.mjs"
import { createCountyPath } from "../lib/county-map-projection.mjs"

const require = createRequire(import.meta.url)
const countiesTopology = require("us-atlas/counties-10m.json")

test("buildCountyQueryUrl scopes TIGERweb acquisition to one state", () => {
  const url = buildCountyQueryUrl("06")
  assert.equal(url.hostname, "tigerweb.geo.census.gov")
  assert.equal(url.searchParams.get("where"), "STATE='06'")
  assert.equal(url.searchParams.get("returnGeometry"), "true")
  assert.equal(url.searchParams.get("f"), "geojson")
  assert.equal(url.searchParams.get("maxAllowableOffset"), "0.005")
})

test("normalizeCountyQuery returns named county FIPS records and rejects cross-state rows", () => {
  const payload = {
    features: [
      { properties: { STATE: "06", COUNTY: "013", NAME: "Contra Costa County" }, geometry: { type: "Polygon", coordinates: [] } },
      { properties: { STATE: "12", COUNTY: "001", NAME: "Alachua County" }, geometry: { type: "Polygon", coordinates: [] } },
      { properties: { STATE: "06", COUNTY: "001", NAME: "Alameda County" }, geometry: { type: "MultiPolygon", coordinates: [] } },
    ],
  }
  assert.deepEqual(normalizeCountyQuery(payload, "06"), [
    { fips: "06001", name: "Alameda County", geometry: { type: "MultiPolygon", coordinates: [] } },
    { fips: "06013", name: "Contra Costa County", geometry: { type: "Polygon", coordinates: [] } },
  ])
})

test("state FIPS validation rejects malformed input", () => {
  assert.equal(isStateFips("06"), true)
  assert.equal(isStateFips("6"), false)
  assert.equal(isSupportedJurisdictionFips("03"), false)
  assert.throws(() => buildCountyQueryUrl("CA"), /supported two-digit FIPS/)
  assert.throws(() => buildCountyQueryUrl("03"), /supported two-digit FIPS/)
})

test("FIPS state selection retains postal-abbreviation candidate rows", () => {
  assert.equal(candidateStateMatchesFips("CA", "06"), true)
  assert.equal(candidateStateMatchesFips(" gu ", "66"), true)
  assert.equal(candidateStateMatchesFips("06", "06"), false)
  assert.equal(candidateStateMatchesFips("TX", "06"), false)
  assert.equal(candidateStateMatchesFips(undefined, "06"), false)
  assert.equal(candidateStateMatchesFips("CA", null), true)
})

test("query construction supports representative continental, noncontiguous, and territory jurisdictions", () => {
  for (const fips of ["06", "42", "48", "36", "02", "15", "72"]) {
    assert.equal(buildCountyQueryUrl(fips).searchParams.get("where"), `STATE='${fips}'`)
  }
})

test("selector source covers 50 states, DC, and all five TIGERweb territories", () => {
  assert.equal(SUPPORTED_JURISDICTIONS.length, 56)
  assert.equal(SUPPORTED_JURISDICTIONS.filter(({ territory }) => !territory).length, 51)
  assert.equal(SUPPORTED_JURISDICTIONS.filter(({ territory }) => territory).length, 5)
  assert.equal(new Set(SUPPORTED_JURISDICTIONS.map(({ fips }) => fips)).size, 56)
  assert.deepEqual(
    SUPPORTED_JURISDICTIONS.filter(({ territory }) => territory).map(({ abbr }) => abbr),
    ["AS", "GU", "MP", "PR", "VI"],
  )
})

test("normalization remains state-scoped across representative jurisdictions", () => {
  const cases = [
    ["42", "001", "Adams County"],
    ["48", "201", "Harris County"],
    ["36", "061", "New York County"],
    ["02", "020", "Anchorage Municipality"],
    ["15", "003", "Honolulu County"],
  ]
  for (const [state, county, name] of cases) {
    assert.deepEqual(
      normalizeCountyQuery({ features: [{ properties: { STATE: state, COUNTY: county, NAME: name }, geometry: { type: "Polygon", coordinates: [] } }] }, state),
      [{ fips: `${state}${county}`, name, geometry: { type: "Polygon", coordinates: [] } }],
    )
  }
})

test("every supported jurisdiction has renderable county geometry or projection proof", () => {
  const bundledCounties = feature(
    countiesTopology,
    countiesTopology.objects.counties,
  ).features
  const territoryCenters = new Map([
    ["60", [-170.7, -14.3]],
    ["66", [144.8, 13.5]],
    ["69", [145.7, 15.2]],
    ["72", [-66.4, 18.2]],
    ["78", [-64.8, 18.3]],
  ])

  for (const jurisdiction of SUPPORTED_JURISDICTIONS) {
    let geometries = bundledCounties.filter(
      (county) => String(county.id ?? "").slice(0, 2) === jurisdiction.fips,
    )
    if (geometries.length === 0) {
      const center = territoryCenters.get(jurisdiction.fips)
      assert.ok(center, `${jurisdiction.abbr} needs bundled county geometry or a projection fixture`)
      const [longitude, latitude] = center
      geometries = [{
        type: "Feature",
        id: `${jurisdiction.fips}001`,
        properties: { name: `${jurisdiction.name} projection fixture` },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [longitude - 0.1, latitude - 0.1],
            [longitude + 0.1, latitude - 0.1],
            [longitude + 0.1, latitude + 0.1],
            [longitude - 0.1, latitude + 0.1],
            [longitude - 0.1, latitude - 0.1],
          ]],
        },
      }]
    }
    const path = createCountyPath(geometries, 960, 620)
    assert.ok(
      geometries.every((geometry) => Boolean(path(geometry))),
      `${jurisdiction.abbr} county geometry must render a non-empty SVG path`,
    )
  }
})

test("checked-in county artifacts cover every supported jurisdiction with provenance", async () => {
  for (const jurisdiction of SUPPORTED_JURISDICTIONS) {
    const { data, preparedAt } = await loadPreparedCountyFile(jurisdiction.fips)
    assert.ok(data.length > 0, `${jurisdiction.abbr} must have prepared county rows`)
    assert.match(preparedAt, /^2026-07-12T/)
    assert.ok(data.every(({ fips }) => fips.startsWith(jurisdiction.fips)))
  }
})

test("prepared county loader rejects oversized and cross-state artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "county-geography-"))
  const directory = path.join(root, "public", "data", "county-geography")
  await mkdir(directory, { recursive: true })
  const canonical = JSON.parse(
    await readFile(path.join(process.cwd(), "public", "data", "county-geography", "06.json"), "utf8"),
  )
  await writeFile(path.join(directory, "06.json"), JSON.stringify(canonical), "utf8")
  await assert.rejects(
    loadPreparedCountyFile("06", { root, maxBytes: 10 }),
    /exceeds the size limit/,
  )
  assert.throws(
    () => normalizePreparedCountyFile({ ...canonical, state: "12" }, "06"),
    /state does not match/,
  )
  assert.throws(
    () => normalizePreparedCountyFile({ ...canonical, source: null }, "06"),
    /source provenance/,
  )
  await rm(root, { recursive: true, force: true })
})

test("public county API reads prepared data without provider calls or writes", async () => {
  const routeSource = await readFile(
    path.join(process.cwd(), "app", "api", "elections", "counties", "route.ts"),
    "utf8",
  )
  assert.match(routeSource, /loadPreparedCountyFile/)
  assert.doesNotMatch(routeSource, /\bfetch\s*\(/)
  assert.doesNotMatch(routeSource, /writeFile|rename|mkdir/)
  assert.doesNotMatch(routeSource, /new Date\(/)
})
