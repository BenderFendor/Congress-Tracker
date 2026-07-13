const TIGERWEB_COUNTY_QUERY =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query"

// Census state-equivalent FIPS jurisdictions represented by both TIGERweb's
// State_County layer and the bundled us-atlas county topology.
const JURISDICTION_ROWS = /** @type {Array<[string, string, string, boolean]>} */ ([
  ["01", "AL", "Alabama", false], ["02", "AK", "Alaska", false],
  ["04", "AZ", "Arizona", false], ["05", "AR", "Arkansas", false],
  ["06", "CA", "California", false], ["08", "CO", "Colorado", false],
  ["09", "CT", "Connecticut", false], ["10", "DE", "Delaware", false],
  ["11", "DC", "District of Columbia", false], ["12", "FL", "Florida", false],
  ["13", "GA", "Georgia", false], ["15", "HI", "Hawaii", false],
  ["16", "ID", "Idaho", false], ["17", "IL", "Illinois", false],
  ["18", "IN", "Indiana", false], ["19", "IA", "Iowa", false],
  ["20", "KS", "Kansas", false], ["21", "KY", "Kentucky", false],
  ["22", "LA", "Louisiana", false], ["23", "ME", "Maine", false],
  ["24", "MD", "Maryland", false], ["25", "MA", "Massachusetts", false],
  ["26", "MI", "Michigan", false], ["27", "MN", "Minnesota", false],
  ["28", "MS", "Mississippi", false], ["29", "MO", "Missouri", false],
  ["30", "MT", "Montana", false], ["31", "NE", "Nebraska", false],
  ["32", "NV", "Nevada", false], ["33", "NH", "New Hampshire", false],
  ["34", "NJ", "New Jersey", false], ["35", "NM", "New Mexico", false],
  ["36", "NY", "New York", false], ["37", "NC", "North Carolina", false],
  ["38", "ND", "North Dakota", false], ["39", "OH", "Ohio", false],
  ["40", "OK", "Oklahoma", false], ["41", "OR", "Oregon", false],
  ["42", "PA", "Pennsylvania", false], ["44", "RI", "Rhode Island", false],
  ["45", "SC", "South Carolina", false], ["46", "SD", "South Dakota", false],
  ["47", "TN", "Tennessee", false], ["48", "TX", "Texas", false],
  ["49", "UT", "Utah", false], ["50", "VT", "Vermont", false],
  ["51", "VA", "Virginia", false], ["53", "WA", "Washington", false],
  ["54", "WV", "West Virginia", false], ["55", "WI", "Wisconsin", false],
  ["56", "WY", "Wyoming", false],
  ["60", "AS", "American Samoa", true], ["66", "GU", "Guam", true],
  ["69", "MP", "Northern Mariana Islands", true], ["72", "PR", "Puerto Rico", true],
  ["78", "VI", "U.S. Virgin Islands", true],
])

export const SUPPORTED_JURISDICTIONS = JURISDICTION_ROWS.map(
  ([fips, abbr, name, territory]) => ({ fips, abbr, name, territory }),
)

const SUPPORTED_FIPS = new Set(SUPPORTED_JURISDICTIONS.map(({ fips }) => fips))
const ABBR_BY_FIPS = new Map(SUPPORTED_JURISDICTIONS.map(({ fips, abbr }) => [fips, abbr]))

export function isStateFips(value) {
  return /^\d{2}$/.test(value)
}

export function isSupportedJurisdictionFips(value) {
  return isStateFips(value) && SUPPORTED_FIPS.has(value)
}

export function candidateStateMatchesFips(candidateState, stateFips) {
  if (!stateFips) return true
  const abbreviation = ABBR_BY_FIPS.get(stateFips)
  return Boolean(abbreviation && candidateState?.trim().toUpperCase() === abbreviation)
}

export function buildCountyQueryUrl(stateFips) {
  if (!isSupportedJurisdictionFips(stateFips)) {
    throw new TypeError("state must be a supported two-digit FIPS code")
  }

  const url = new URL(TIGERWEB_COUNTY_QUERY)
  url.searchParams.set("where", `STATE='${stateFips}'`)
  url.searchParams.set("outFields", "STATE,COUNTY,NAME,BASENAME")
  url.searchParams.set("orderByFields", "NAME ASC")
  url.searchParams.set("returnGeometry", "true")
  url.searchParams.set("outSR", "4326")
  url.searchParams.set("geometryPrecision", "4")
  url.searchParams.set("maxAllowableOffset", "0.005")
  url.searchParams.set("f", "geojson")
  return url
}

export function normalizeCountyQuery(payload, stateFips) {
  if (!isSupportedJurisdictionFips(stateFips)) {
    throw new TypeError("state must be a supported two-digit FIPS code")
  }
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.features)) {
    throw new TypeError("TIGERweb response did not contain a features array")
  }

  const counties = []
  const seen = new Set()
  for (const feature of payload.features) {
    const attributes = feature?.properties ?? feature?.attributes
    const state = String(attributes?.STATE ?? "")
    const county = String(attributes?.COUNTY ?? "")
    const name = String(attributes?.NAME ?? "").trim()
    const geometry = feature?.geometry
    if (
      state !== stateFips ||
      !/^\d{3}$/.test(county) ||
      !name ||
      !geometry ||
      !["Polygon", "MultiPolygon"].includes(geometry.type)
    ) continue
    const fips = `${state}${county}`
    if (seen.has(fips)) continue
    seen.add(fips)
    counties.push({ fips, name, geometry })
  }

  return counties.sort((left, right) => left.name.localeCompare(right.name))
}

export const COUNTY_GEOGRAPHY_SOURCE = {
  label: "U.S. Census Bureau TIGERweb State and County layer",
  url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer",
}
