import type { Feature, FeatureCollection, Geometry } from "geojson"
import type { Topology, GeometryCollection } from "topojson-specification"
import * as topojson from "topojson-client"
import type { FECandidate } from "@/lib/services/fec"

export type StateFips = string
export type CountyFips = string

// 50 states + DC. FIPS code -> { abbr, name }.
export const STATE_FIPS_TABLE: Record<StateFips, { abbr: string; name: string }> = {
  "01": { abbr: "AL", name: "Alabama" },
  "02": { abbr: "AK", name: "Alaska" },
  "04": { abbr: "AZ", name: "Arizona" },
  "05": { abbr: "AR", name: "Arkansas" },
  "06": { abbr: "CA", name: "California" },
  "08": { abbr: "CO", name: "Colorado" },
  "09": { abbr: "CT", name: "Connecticut" },
  "10": { abbr: "DE", name: "Delaware" },
  "11": { abbr: "DC", name: "District of Columbia" },
  "12": { abbr: "FL", name: "Florida" },
  "13": { abbr: "GA", name: "Georgia" },
  "15": { abbr: "HI", name: "Hawaii" },
  "16": { abbr: "ID", name: "Idaho" },
  "17": { abbr: "IL", name: "Illinois" },
  "18": { abbr: "IN", name: "Indiana" },
  "19": { abbr: "IA", name: "Iowa" },
  "20": { abbr: "KS", name: "Kansas" },
  "21": { abbr: "KY", name: "Kentucky" },
  "22": { abbr: "LA", name: "Louisiana" },
  "23": { abbr: "ME", name: "Maine" },
  "24": { abbr: "MD", name: "Maryland" },
  "25": { abbr: "MA", name: "Massachusetts" },
  "26": { abbr: "MI", name: "Michigan" },
  "27": { abbr: "MN", name: "Minnesota" },
  "28": { abbr: "MS", name: "Mississippi" },
  "29": { abbr: "MO", name: "Missouri" },
  "30": { abbr: "MT", name: "Montana" },
  "31": { abbr: "NE", name: "Nebraska" },
  "32": { abbr: "NV", name: "Nevada" },
  "33": { abbr: "NH", name: "New Hampshire" },
  "34": { abbr: "NJ", name: "New Jersey" },
  "35": { abbr: "NM", name: "New Mexico" },
  "36": { abbr: "NY", name: "New York" },
  "37": { abbr: "NC", name: "North Carolina" },
  "38": { abbr: "ND", name: "North Dakota" },
  "39": { abbr: "OH", name: "Ohio" },
  "40": { abbr: "OK", name: "Oklahoma" },
  "41": { abbr: "OR", name: "Oregon" },
  "42": { abbr: "PA", name: "Pennsylvania" },
  "44": { abbr: "RI", name: "Rhode Island" },
  "45": { abbr: "SC", name: "South Carolina" },
  "46": { abbr: "SD", name: "South Dakota" },
  "47": { abbr: "TN", name: "Tennessee" },
  "48": { abbr: "TX", name: "Texas" },
  "49": { abbr: "UT", name: "Utah" },
  "50": { abbr: "VT", name: "Vermont" },
  "51": { abbr: "VA", name: "Virginia" },
  "53": { abbr: "WA", name: "Washington" },
  "54": { abbr: "WV", name: "West Virginia" },
  "55": { abbr: "WI", name: "Wisconsin" },
  "56": { abbr: "WY", name: "Wyoming" },
}

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

export type Metric = "rating" | "candidates" | "incumbents" | "open-seats"

export const METRIC_LABELS: Record<Metric, string> = {
  rating: "Party lean",
  candidates: "Candidate rows",
  incumbents: "Incumbents running",
  "open-seats": "Open-seat filings",
}

export const ALL_METRICS: ReadonlyArray<Metric> = ["rating", "candidates", "incumbents", "open-seats"]

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
  const lower = party.toLowerCase()
  if (lower.includes("democrat")) return "democratic"
  if (lower.includes("republican")) return "republican"
  if (lower.includes("independent") || lower.includes("nonpartisan")) return "independent"
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

export function partyLean(row: StateAggregate | DistrictAggregate | undefined): number {
  if (!row || row.total === 0) return 0
  return (row.democratic - row.republican) / row.total
}

export type RatingLabel =
  | "Safe D"
  | "Likely D"
  | "Lean D"
  | "Tilt D"
  | "Toss-up"
  | "Tilt R"
  | "Lean R"
  | "Likely R"
  | "Safe R"
  | "No data"

export function ratingLabel(row: StateAggregate | DistrictAggregate | undefined): RatingLabel {
  if (!row || row.total === 0) return "No data"
  const lean = partyLean(row)
  if (lean >= 0.55) return "Safe D"
  if (lean >= 0.35) return "Likely D"
  if (lean >= 0.18) return "Lean D"
  if (lean >= 0.07) return "Tilt D"
  if (lean > -0.07) return "Toss-up"
  if (lean > -0.18) return "Tilt R"
  if (lean > -0.35) return "Lean R"
  if (lean > -0.55) return "Likely R"
  return "Safe R"
}

export function pillClassForRating(rating: RatingLabel): "dem" | "rep" | "toss" | "neutral" {
  if (rating === "No data") return "neutral"
  if (rating === "Toss-up") return "toss"
  if (rating.endsWith("D")) return "dem"
  if (rating.endsWith("R")) return "rep"
  return "neutral"
}

export function metricValue(row: StateAggregate | undefined, metric: Metric): number {
  if (!row) return 0
  if (metric === "rating") return Math.abs(partyLean(row))
  if (metric === "candidates") return row.total
  if (metric === "incumbents") return row.incumbents
  return row.open
}

export function competitivenessScore(row: StateAggregate | undefined): number {
  if (!row || row.total === 0) return Number.POSITIVE_INFINITY
  const lean = Math.abs(partyLean(row))
  return lean + (row.total < 3 ? 0.25 : 0)
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
