#!/usr/bin/env node
// Operator-only preparation command. Fetches Census county geometry and writes
// deterministic per-jurisdiction artifacts consumed by the read-only public API.
import { mkdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  buildCountyQueryUrl,
  COUNTY_GEOGRAPHY_SOURCE,
  normalizeCountyQuery,
  SUPPORTED_JURISDICTIONS,
} from "../lib/county-geography.mjs"

function usage() {
  return "Usage: node scripts/prepare-county-geography.mjs [--state FIPS] [--prepared-at ISO_TIMESTAMP]"
}

function parseArgs(argv) {
  const options = { state: null, preparedAt: new Date().toISOString() }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--help") return { help: true }
    if (arg === "--state") options.state = argv[++index]
    else if (arg === "--prepared-at") options.preparedAt = argv[++index]
    else throw new TypeError(`Unknown argument: ${arg}`)
  }
  if (Number.isNaN(Date.parse(options.preparedAt))) {
    throw new TypeError("--prepared-at must be an ISO timestamp")
  }
  return options
}

async function prepareJurisdiction(jurisdiction, preparedAt, outputDirectory) {
  const response = await fetch(buildCountyQueryUrl(jurisdiction.fips), {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`TIGERweb ${jurisdiction.fips} returned ${response.status}`)
  }
  const data = normalizeCountyQuery(await response.json(), jurisdiction.fips)
  if (data.length === 0) throw new Error(`TIGERweb ${jurisdiction.fips} returned no counties`)

  const target = path.join(outputDirectory, `${jurisdiction.fips}.json`)
  const temporary = `${target}.tmp`
  const body = `${JSON.stringify({
    state: jurisdiction.fips,
    prepared_at: preparedAt,
    source: COUNTY_GEOGRAPHY_SOURCE,
    data: data.map(({ fips, name, geometry }) => ({
      properties: { STATE: fips.slice(0, 2), COUNTY: fips.slice(2), NAME: name },
      geometry,
    })),
  })}\n`
  await writeFile(temporary, body, "utf8")
  await rename(temporary, target)
  process.stdout.write(`${jurisdiction.fips} ${jurisdiction.abbr}: ${data.length}\n`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(`${usage()}\n`)
    return
  }
  const jurisdictions = options.state
    ? SUPPORTED_JURISDICTIONS.filter(({ fips }) => fips === options.state)
    : SUPPORTED_JURISDICTIONS
  if (jurisdictions.length === 0) throw new TypeError("--state must be a supported FIPS code")

  const outputDirectory = path.join(process.cwd(), "public", "data", "county-geography")
  await mkdir(outputDirectory, { recursive: true })
  for (const jurisdiction of jurisdictions) {
    await prepareJurisdiction(jurisdiction, options.preparedAt, outputDirectory)
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${usage()}\n`)
  process.exitCode = 1
})
