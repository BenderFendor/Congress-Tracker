import { NextResponse } from "next/server"
import {
  buildCountyQueryUrl,
  COUNTY_GEOGRAPHY_SOURCE,
  isSupportedJurisdictionFips,
  normalizeCountyQuery,
} from "@/lib/county-geography.mjs"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const state = new URL(request.url).searchParams.get("state") ?? ""
  if (!isSupportedJurisdictionFips(state)) {
    return NextResponse.json(
      { error: "state must be a supported two-digit FIPS code" },
      { status: 400 },
    )
  }

  const sourceRequest = buildCountyQueryUrl(state)
  try {
    const response = await fetch(sourceRequest, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
    if (!response.ok) {
      return NextResponse.json(
        { error: `Census TIGERweb returned ${response.status}` },
        { status: 502 },
      )
    }

    const payload: unknown = await response.json()
    const counties = normalizeCountyQuery(payload, state)
    return NextResponse.json({
      data: counties,
      meta: {
        state,
        coverage: counties.length > 0 ? "geometry_and_names" : "unavailable",
        results_coverage: "not_loaded",
        source: COUNTY_GEOGRAPHY_SOURCE,
        retrieved_at: new Date().toISOString(),
        cache_seconds: 60 * 60 * 24 * 30,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "County geography request failed",
      },
      { status: 502 },
    )
  }
}
