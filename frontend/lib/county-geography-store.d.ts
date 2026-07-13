import type { CountyGeographyRecord } from "./county-geography.mjs"

export const MAX_PREPARED_COUNTY_BYTES: number
export function preparedCountyFilePath(stateFips: string, root?: string): string
export function normalizePreparedCountyFile(
  payload: unknown,
  stateFips: string,
): { data: CountyGeographyRecord[]; preparedAt: string }
export function loadPreparedCountyFile(
  stateFips: string,
  options?: { root?: string; maxBytes?: number },
): Promise<{ data: CountyGeographyRecord[]; preparedAt: string }>
