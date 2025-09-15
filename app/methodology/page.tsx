import { ArrowLeft, BarChart3, GitBranch, Target, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <a href="/" className="flex items-center">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </a>
              </Button>
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">Methodology</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Introduction */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-6">Our Methodology</h2>
          <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
            We employ rigorous data collection, processing, and analysis methods to ensure accuracy 
            and transparency in government accountability tracking.
          </p>
        </div>

        {/* Data Collection */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-foreground mb-6">Data Collection Process</h3>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <GitBranch className="h-6 w-6 text-primary" />
                  <CardTitle>Automated Data Pipeline</CardTitle>
                </div>
                <CardDescription>
                  How we collect and process government data in real-time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">1</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">API Integration</h4>
                      <p className="text-sm text-muted-foreground">
                        Direct connections to official government APIs (Congress.gov, Senate Lobbying Disclosure) 
                        ensure we receive data as soon as it's officially published.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">2</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Data Validation</h4>
                      <p className="text-sm text-muted-foreground">
                        Each data point is validated against multiple sources and checked for consistency. 
                        Automated quality checks flag potential errors for manual review.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">3</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Data Enrichment</h4>
                      <p className="text-sm text-muted-foreground">
                        Raw data is enhanced with additional context, standardized formatting, 
                        and cross-references to related information for comprehensive analysis.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">4</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Real-time Updates</h4>
                      <p className="text-sm text-muted-foreground">
                        Changes are immediately reflected in our system, providing users with 
                        the most current information available.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Analysis Methods */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-foreground mb-6">Analysis Methods</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Target className="h-6 w-6 text-primary" />
                  <CardTitle>Financial Analysis</CardTitle>
                </div>
                <CardDescription>
                  How we track and analyze financial relationships
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Campaign Contributions</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Aggregate donations by industry, company, and time period</li>
                      <li>• Calculate contribution patterns and trends</li>
                      <li>• Identify top donors and recipients</li>
                      <li>• Track PAC and individual contribution sources</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Stock Trading Analysis</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Monitor disclosure timing compliance</li>
                      <li>• Calculate portfolio performance and returns</li>
                      <li>• Identify potential conflicts of interest</li>
                      <li>• Track unusual trading patterns</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  <CardTitle>Legislative Analysis</CardTitle>
                </div>
                <CardDescription>
                  Tracking legislative activity and influence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Bill Tracking</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Monitor bill progression through Congress</li>
                      <li>• Analyze voting patterns and party alignment</li>
                      <li>• Track amendments and committee activity</li>
                      <li>• Identify sponsor and co-sponsor relationships</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Lobbying Impact</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Correlate lobbying spending with legislative outcomes</li>
                      <li>• Map lobbyist-legislator interactions</li>
                      <li>• Track issue area focus and spending patterns</li>
                      <li>• Analyze firm and client relationships</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Transparency Standards */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-foreground mb-6">Transparency Standards</h3>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Our Commitments</CardTitle>
                <CardDescription>
                  Standards we maintain for data accuracy and transparency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Data Integrity</h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li>• All data sources are clearly documented</li>
                      <li>• Original sources are always linked</li>
                      <li>• Data processing methods are transparent</li>
                      <li>• Corrections and updates are publicly logged</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-3">Bias Prevention</h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li>• Non-partisan approach to data presentation</li>
                      <li>• Equal treatment of all political parties</li>
                      <li>• Context provided for all statistical claims</li>
                      <li>• Multiple perspectives included in analysis</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Limitations */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
              <CardTitle>Limitations & Caveats</CardTitle>
            </div>
            <CardDescription>
              Important limitations to consider when interpreting our analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h4 className="font-semibold text-orange-800 mb-2">Reporting Delays</h4>
                <p className="text-sm text-orange-700">
                  Government data may be delayed due to filing requirements, processing times, 
                  or compliance issues. We clearly indicate when data may be incomplete.
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Correlation vs. Causation</h4>
                <p className="text-sm text-blue-700">
                  Statistical relationships shown in our analysis indicate correlation, not 
                  necessarily causation. Users should consider multiple factors when drawing conclusions.
                </p>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-semibold text-purple-800 mb-2">Data Interpretation</h4>
                <p className="text-sm text-purple-700">
                  Government data can be complex and context-dependent. We encourage users to 
                  review original sources and consider multiple data points before making judgments.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
