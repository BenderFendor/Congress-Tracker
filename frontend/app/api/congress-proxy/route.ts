import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from "@/lib/tracing"

// Only available on the server
const API_KEY = process.env.CONGRESS_GOV_API_KEY
  || process.env.CONGRESS_API_KEY
  || process.env.NEXT_PUBLIC_CONGRESS_GOV_API_KEY
  || process.env.NEXT_PUBLIC_CONGRESS_API_KEY

const log = createLogger("CongressProxyApi")

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  // Allow requests to official Congress API and Senate Lobbying Disclosure API
  const isCongressAPI = url.startsWith('https://api.congress.gov/v3/')
  const isLobbyingAPI = url.startsWith('https://lda.senate.gov/api/v1/')

  if (!isCongressAPI && !isLobbyingAPI) {
    return NextResponse.json({ error: 'Invalid API url' }, { status: 400 })
  }

  const headers: Record<string, string> = { 'Accept': 'application/json' }

  // Handle Congress API - requires API key via X-Api-Key header
  if (isCongressAPI) {
    if (API_KEY) {
      headers['X-Api-Key'] = API_KEY
    } else {
      log.warn('Congress.gov API key not configured')
    }
  }

  try {
    const apiRes = await fetch(url, { headers })
    const data = await apiRes.json()
    return NextResponse.json(data, { status: apiRes.status })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 })
  }
}
