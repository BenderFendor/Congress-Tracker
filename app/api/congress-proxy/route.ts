import { NextRequest, NextResponse } from 'next/server'

// Only available on the server
const API_KEY = process.env.CONGRESS_API_KEY || process.env.NEXT_PUBLIC_CONGRESS_API_KEY

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

  let apiUrl = url
  let headers: Record<string, string> = { 'Accept': 'application/json' }

  // Handle Congress API - requires API key
  if (isCongressAPI) {
    apiUrl = url.includes('api_key=') ? url : `${url}${url.includes('?') ? '&' : '?'}api_key=${API_KEY}`
  }
  
  // Handle Lobbying API - different auth mechanism if needed
  if (isLobbyingAPI) {
    // The Senate Lobbying API is public and doesn't require authentication for basic access
    // If API key is needed for higher rate limits, it would go in Authorization header
    // headers['Authorization'] = 'Token your_token_here'
  }

  try {
    const apiRes = await fetch(apiUrl, { headers })
    const data = await apiRes.json()
    return NextResponse.json(data, { status: apiRes.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
