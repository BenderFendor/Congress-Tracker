import { readFile } from "node:fs/promises"
import path from "node:path"

import {
  COUNTY_GEOGRAPHY_SOURCE,
  isSupportedJurisdictionFips,
  normalizeCountyQuery,
} from "./county-geography.mjs"

export const MAX_PREPARED_COUNTY_BYTES = 5_000_000

export function preparedCountyFilePath(stateFips, root = process.cwd()) {
  if (!isSupportedJurisdictionFips(stateFips)) {
    throw new TypeError("state must be a supported two-digit FIPS code")
  }
  return path.join(root, "public", "data", "county-geography", `${stateFips}.json`)
}

export function normalizePreparedCountyFile(payload, stateFips) {
  if (!payload || typeof payload !== "object") {
    throw new TypeError("prepared county file must be an object")
  }
  if (
    typeof payload.prepared_at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(payload.prepared_at)
  ) {
    throw new TypeError("prepared county file is missing a valid prepared_at timestamp")
  }
  if (payload.state !== stateFips) {
    throw new TypeError("prepared county file state does not match the requested state")
  }
  if (
    payload.source?.url !== COUNTY_GEOGRAPHY_SOURCE.url ||
    payload.source?.label !== COUNTY_GEOGRAPHY_SOURCE.label
  ) {
    throw new TypeError("prepared county file is missing canonical source provenance")
  }

  const data = normalizeCountyQuery({ features: payload.data }, stateFips)
  if (data.length !== payload.data.length) {
    throw new TypeError("prepared county file contains invalid, duplicate, or cross-state rows")
  }
  return { data, preparedAt: payload.prepared_at }
}

export async function loadPreparedCountyFile(stateFips, options = {}) {
  const filePath = preparedCountyFilePath(stateFips, options.root)
  const raw = await readFile(filePath, { encoding: "utf8" })
  if (Buffer.byteLength(raw) > (options.maxBytes ?? MAX_PREPARED_COUNTY_BYTES)) {
    throw new RangeError("prepared county file exceeds the size limit")
  }
  return normalizePreparedCountyFile(JSON.parse(raw), stateFips)
}
