import { NextResponse } from "next/server"
import {
  COUNTY_GEOGRAPHY_SOURCE,
  isSupportedJurisdictionFips,
} from "@/lib/county-geography.mjs"
import { loadPreparedCountyFile } from "@/lib/county-geography-store.mjs"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const state = new URL(request.url).searchParams.get("state") ?? ""
  if (!isSupportedJurisdictionFips(state)) {
    return NextResponse.json(
      { error: "state must be a supported two-digit FIPS code" },
      { status: 400 },
    )
  }

  try {
    const { data: counties, preparedAt } = await loadPreparedCountyFile(state)
    return NextResponse.json({
      data: counties,
      meta: {
        state,
        coverage: counties.length > 0 ? "geometry_and_names" : "unavailable",
        results_coverage: "not_loaded",
        source: COUNTY_GEOGRAPHY_SOURCE,
        prepared_at: preparedAt,
      },
    }, { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } })
  } catch (error) {
    console.error("Prepared county geography unavailable", { state, error })
    return NextResponse.json(
      {
        error: "Prepared county geography is unavailable for this jurisdiction",
      },
      { status: 503 },
    )
  }
}
