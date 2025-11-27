import { ArrowLeft, Code, Database, Key, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">


      <div className="container mx-auto px-4 py-8">
        {/* Introduction */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-6">Congress Accountability Tracker API</h2>
          <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
            Access comprehensive government accountability data through our RESTful API. Get real-time information
            about congressional activities, lobbying efforts, and legislative processes.
          </p>
        </div>

        {/* API Endpoints */}
        <div className="grid gap-8 mb-12">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Database className="h-6 w-6 text-primary" />
                <CardTitle>Available Endpoints</CardTitle>
              </div>
              <CardDescription>
                All API endpoints return JSON data and support standard HTTP methods
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Congress Members</h3>
                    <Badge variant="secondary">GET</Badge>
                  </div>
                  <code className="text-sm bg-muted p-2 rounded block mb-2">
                    https://api.congress.gov/v3/member
                  </code>
                  <p className="text-sm text-muted-foreground">
                    Retrieve information about current and former members of Congress
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Bills & Legislation</h3>
                    <Badge variant="secondary">GET</Badge>
                  </div>
                  <code className="text-sm bg-muted p-2 rounded block mb-2">
                    https://api.congress.gov/v3/bill
                  </code>
                  <p className="text-sm text-muted-foreground">
                    Access comprehensive bill information, voting records, and legislative history
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Lobbying Data</h3>
                    <Badge variant="secondary">GET</Badge>
                  </div>
                  <code className="text-sm bg-muted p-2 rounded block mb-2">
                    https://lda.senate.gov/api/v1/filings/
                  </code>
                  <p className="text-sm text-muted-foreground">
                    Lobbying disclosure filings, registrants, and contribution data
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Key className="h-6 w-6 text-primary" />
                <CardTitle>Authentication</CardTitle>
              </div>
              <CardDescription>
                API key requirements and rate limiting information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Congress API</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Requires API key from <a href="https://api.congress.gov/" className="text-primary hover:underline">api.congress.gov</a>
                  </p>
                  <code className="text-sm bg-muted p-2 rounded block">
                    ?api_key=YOUR_API_KEY
                  </code>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Senate Lobbying API</h3>
                  <p className="text-sm text-muted-foreground">
                    Public access available. Registration recommended for higher rate limits.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Rate Limits</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Congress API: 5,000 requests per hour</li>
                    <li>• Lobbying API: 15 requests per minute (anonymous)</li>
                    <li>• Lobbying API: 120 requests per minute (authenticated)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <LinkIcon className="h-6 w-6 text-primary" />
                <CardTitle>External Resources</CardTitle>
              </div>
              <CardDescription>
                Official API documentation and registration links
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">Congress.gov API</h3>
                    <p className="text-sm text-muted-foreground">Official legislative data API</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://api.congress.gov/" target="_blank" rel="noopener noreferrer">
                      Visit Site
                    </a>
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">Senate Lobbying Disclosure</h3>
                    <p className="text-sm text-muted-foreground">Lobbying registration and disclosure data</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://lda.senate.gov/" target="_blank" rel="noopener noreferrer">
                      Visit Site
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Example Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Example Usage</CardTitle>
            <CardDescription>
              Sample requests and responses for common use cases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Get Current House Members</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm">
                    curl -X GET "https://api.congress.gov/v3/member/house/current?api_key=YOUR_KEY&format=json"
                  </code>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Search Bills by Keyword</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm">
                    curl -X GET "https://api.congress.gov/v3/bill?q=healthcare&api_key=YOUR_KEY&format=json"
                  </code>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Get Recent Lobbying Filings</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <code className="text-sm">
                    curl -X GET "https://lda.senate.gov/api/v1/filings/?filing_year=2024&page_size=25"
                  </code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
