import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { Topology, GeometryCollection } from "topojson-specification"
import * as topojson from "topojson-client"
import type { FECandidate } from "@/lib/services/fec"
import { SUPPORTED_JURISDICTIONS } from "@/lib/county-geography.mjs"

export type StateFips = string
export type CountyFips = string

// 50 states, DC, and the five territories supported by both TIGERweb and us-atlas.
export const STATE_FIPS_TABLE: Record<StateFips, { abbr: string; name: string }> =
  Object.fromEntries(
    SUPPORTED_JURISDICTIONS.map(({ fips, abbr, name }) => [fips, { abbr, name }]),
  )

export const FIPS_BY_ABBR: Record<string, StateFips> = Object.entries(STATE_FIPS_TABLE).reduce(
  (acc, [fips, meta]) => {
    acc[meta.abbr] = fips
    return acc
  },
  {} as Record<string, StateFips>,
)

export const STATE_ABBR_BY_FIPS: Record<StateFips, string> = Object.entries(STATE_FIPS_TABLE).reduce(
  (acc, [fips, meta]) => {
    acc[fips] = meta.abbr
    return acc
  },
  {} as Record<StateFips, string>,
)

export const STATE_NAME_BY_FIPS: Record<StateFips, string> = Object.entries(STATE_FIPS_TABLE).reduce(
  (acc, [fips, meta]) => {
    acc[fips] = meta.name
    return acc
  },
  {} as Record<StateFips, string>,
)

export type Office = "H" | "S" | "P"

export const OFFICE_LABELS: Record<Office, string> = {
  H: "U.S. House",
  S: "U.S. Senate",
  P: "U.S. President",
}

export const ALL_OFFICES: ReadonlyArray<Office> = ["H", "S", "P"]

export type Metric = "candidates" | "incumbents" | "open-seats"

export const METRIC_LABELS: Record<Metric, string> = {
  candidates: "Candidate rows",
  incumbents: "Incumbents running",
  "open-seats": "Open-seat filings",
}

export const ALL_METRICS: ReadonlyArray<Metric> = ["candidates", "incumbents", "open-seats"]

export type View = "national" | "state" | "county"

export const VIEW_LABELS: Record<View, string> = {
  national: "United States",
  state: "State",
  county: "County",
}

export const ALL_VIEWS: ReadonlyArray<View> = ["national", "state", "county"]

export type PartyBucket = "democratic" | "republican" | "independent" | "other"

export type StateAggregate = {
  fips: StateFips
  abbr: string
  name: string
  total: number
  democratic: number
  republican: number
  independent: number
  other: number
  incumbents: number
  challengers: number
  open: number
  unknownStatus: number
  districts: Map<string, DistrictAggregate>
}

export type DistrictAggregate = {
  district: string
  total: number
  democratic: number
  republican: number
  independent: number
  other: number
  incumbents: number
  challengers: number
  open: number
}

export type CountyAggregate = {
  fips: CountyFips
  stateFips: StateFips
  abbr: string
  stateAbbr: string
  name: string
  total: number
  democratic: number
  republican: number
  independent: number
  other: number
}

function classifyParty(party: string | undefined): PartyBucket {
  if (!party) return "other"
  const normalized = party.trim().toUpperCase()
  if (["D", "DEM", "DFL"].includes(normalized) || normalized.includes("DEMOCRAT")) {
    return "democratic"
  }
  if (["R", "REP", "GOP"].includes(normalized) || normalized.includes("REPUBLICAN")) {
    return "republican"
  }
  if (
    ["I", "IND", "NPA"].includes(normalized) ||
    normalized.includes("INDEPENDENT") ||
    normalized.includes("NONPARTISAN")
  ) {
    return "independent"
  }
  return "other"
}

function classifyStatus(
  status: FECandidate["status"],
): "incumbent" | "challenger" | "open" | "unknown" {
  if (status === "incumbent") return "incumbent"
  if (status === "challenger") return "challenger"
  if (status === "open") return "open"
  if (status === "primary") return "challenger"
  return "unknown"
}

function abbrToFips(abbr: string | undefined): StateFips | null {
  if (!abbr || abbr.length !== 2) return null
  return FIPS_BY_ABBR[abbr.toUpperCase()] ?? null
}

export function aggregateCandidates(candidates: FECandidate[]): Map<StateFips, StateAggregate> {
  const map = new Map<StateFips, StateAggregate>()
  for (const cand of candidates) {
    const fips = abbrToFips(cand.state)
    if (!fips) continue
    const meta = STATE_FIPS_TABLE[fips]
    let row = map.get(fips)
    if (!row) {
      row = {
        fips,
        abbr: meta.abbr,
        name: meta.name,
        total: 0,
        democratic: 0,
        republican: 0,
        independent: 0,
        other: 0,
        incumbents: 0,
        challengers: 0,
        open: 0,
        unknownStatus: 0,
        districts: new Map<string, DistrictAggregate>(),
      }
      map.set(fips, row)
    }
    row.total += 1
    const party = classifyParty(cand.party)
    row[party] += 1
    const status = classifyStatus(cand.status)
    if (status === "incumbent") row.incumbents += 1
    else if (status === "challenger") row.challengers += 1
    else if (status === "open") row.open += 1
    else row.unknownStatus += 1
    const districtKey = cand.district && cand.district.length > 0 ? cand.district : "00"
    let district = row.districts.get(districtKey)
    if (!district) {
      district = {
        district: districtKey,
        total: 0,
        democratic: 0,
        republican: 0,
        independent: 0,
        other: 0,
        incumbents: 0,
        challengers: 0,
        open: 0,
      }
      row.districts.set(districtKey, district)
    }
    district.total += 1
    district[party] += 1
    if (status === "incumbent") district.incumbents += 1
    else if (status === "challenger") district.challengers += 1
    else if (status === "open") district.open += 1
  }
  return map
}

export function metricValue(row: StateAggregate | undefined, metric: Metric): number {
  if (!row) return 0
  if (metric === "candidates") return row.total
  if (metric === "incumbents") return row.incumbents
  return row.open
}

export type UsAtlasTopology = Topology<{
  states: GeometryCollection<{ name: string }>
  counties: GeometryCollection<{ name: string }>
  nation: GeometryCollection
}>

export type StateFeature = Feature<Geometry, { name?: string }>
export type CountyFeature = Feature<Geometry, { name?: string }>

export function topologyToStateFeatures(topology: UsAtlasTopology): StateFeature[] {
  const collection = topojson.feature(
    topology,
    topology.objects.states,
  ) as FeatureCollection<Geometry, { name?: string }>
  return collection.features
}

export function topologyToCountyFeatures(topology: UsAtlasTopology): CountyFeature[] {
  const collection = topojson.feature(
    topology,
    topology.objects.counties,
  ) as FeatureCollection<Geometry, { name?: string }>
  return collection.features
}

export function countiesInState(counties: CountyFeature[], stateFips: StateFips): CountyFeature[] {
  return counties.filter((c) => String(c.id ?? "").slice(0, 2) === stateFips)
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function avatarClassForParty(party: string | undefined): "dem" | "rep" | "ind" {
  const bucket = classifyParty(party)
  if (bucket === "democratic") return "dem"
  if (bucket === "republican") return "rep"
  return "ind"
}

export function isOfficeInCandidate(candidate: FECandidate, office: Office): boolean {
  return candidate.office_sought === office
}
