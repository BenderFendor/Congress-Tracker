import { NextRequest, NextResponse } from 'next/server'

// Only available on the server
const API_KEY = process.env.CONGRESS_API_KEY || process.env.NEXT_PUBLIC_CONGRESS_API_KEY

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  // Only allow requests to the official Congress API
  if (!url.startsWith('https://api.congress.gov/v3/')) {
    return NextResponse.json({ error: 'Invalid API url' }, { status: 400 })
  }

  // Append the API key
  const apiUrl = url.includes('api_key=') ? url : `${url}${url.includes('?') ? '&' : '?'}api_key=${API_KEY}`

  try {
    const apiRes = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
    const data = await apiRes.json()
    return NextResponse.json(data, { status: apiRes.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
