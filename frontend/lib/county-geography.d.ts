export type CountyGeographyRecord = {
  fips: string
  name: string
  geometry: {
    type: "Polygon" | "MultiPolygon"
    coordinates: unknown
  }
}

export type SupportedJurisdiction = {
  fips: string
  abbr: string
  name: string
  territory: boolean
}

export function isStateFips(value: string): boolean
export function isSupportedJurisdictionFips(value: string): boolean
export function candidateStateMatchesFips(
  candidateState: string | null | undefined,
  stateFips: string | null,
): boolean
export function buildCountyQueryUrl(stateFips: string): URL
export function normalizeCountyQuery(
  payload: unknown,
  stateFips: string,
): CountyGeographyRecord[]
export const COUNTY_GEOGRAPHY_SOURCE: {
  label: string
  url: string
}
export const SUPPORTED_JURISDICTIONS: SupportedJurisdiction[]
