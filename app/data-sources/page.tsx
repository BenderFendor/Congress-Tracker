import { ArrowLeft, Database, ExternalLink, Shield, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function DataSourcesPage() {
  return (
    <div className="min-h-screen bg-background">


      <div className="container mx-auto px-4 py-8">
        {/* Introduction */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-6">Our Data Sources</h2>
          <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
            We aggregate data from official government sources and trusted institutions to provide
            comprehensive insights into congressional activity and political influence.
          </p>
        </div>

        {/* Primary Sources */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-foreground mb-6">Primary Government Sources</h3>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Shield className="h-6 w-6 text-green-600" />
                    <CardTitle>Congress.gov API</CardTitle>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Official
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://api.congress.gov/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Source
                    </a>
                  </Button>
                </div>
                <CardDescription>
                  Library of Congress official API for legislative information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Data Provided:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Congressional member information and biographies</li>
                      <li>• Bill texts, summaries, and legislative histories</li>
                      <li>• Voting records and roll call votes</li>
                      <li>• Committee assignments and hearing schedules</li>
                      <li>• Congressional reports and documents</li>
                    </ul>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Updated: Real-time</span>
                    </div>
                    <Badge variant="secondary">Free API</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Shield className="h-6 w-6 text-green-600" />
                    <CardTitle>Senate Lobbying Disclosure</CardTitle>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Official
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://lda.senate.gov/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Source
                    </a>
                  </Button>
                </div>
                <CardDescription>
                  Senate Office of Public Records lobbying database
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Data Provided:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Lobbying disclosure filings (LD-1, LD-2)</li>
                      <li>• Registered lobbyists and firms</li>
                      <li>• Client information and spending amounts</li>
                      <li>• Issue areas and government contacts</li>
                      <li>• Contribution reports (LD-203)</li>
                    </ul>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Updated: Quarterly</span>
                    </div>
                    <Badge variant="secondary">Public Access</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Shield className="h-6 w-6 text-blue-600" />
                    <CardTitle>OpenSecrets.org</CardTitle>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Non-Profit
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://www.opensecrets.org/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Source
                    </a>
                  </Button>
                </div>
                <CardDescription>
                  Center for Responsive Politics campaign finance data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Data Provided:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Campaign contribution records</li>
                      <li>• Industry and sector analysis</li>
                      <li>• Top donors and recipients</li>
                      <li>• Lobbying spending by client and firm</li>
                      <li>• Personal financial disclosures</li>
                    </ul>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Updated: Daily</span>
                    </div>
                    <Badge variant="secondary">CSV Downloads</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Data Processing */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-foreground mb-6">Data Processing & Quality</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Validation</CardTitle>
                <CardDescription>
                  Our approach to ensuring data accuracy and reliability
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                    <span>Cross-reference multiple sources for verification</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                    <span>Automated data quality checks and validation</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                    <span>Regular audits against official records</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                    <span>User reporting system for data corrections</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Update Frequency</CardTitle>
                <CardDescription>
                  How often different datasets are refreshed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Congressional Votes</span>
                    <Badge variant="outline">Real-time</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Bill Information</span>
                    <Badge variant="outline">Daily</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Lobbying Filings</span>
                    <Badge variant="outline">Weekly</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Campaign Finance</span>
                    <Badge variant="outline">Monthly</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Financial Disclosures</span>
                    <Badge variant="outline">Annually</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Data Limitations */}
        <Card>
          <CardHeader>
            <CardTitle>Data Limitations & Disclaimers</CardTitle>
            <CardDescription>
              Important considerations when interpreting our data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Reporting Delays</h4>
                <p className="text-muted-foreground">
                  Some data may be delayed due to official filing requirements. Stock trades must be
                  disclosed within 45 days, lobbying reports are filed quarterly.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Data Completeness</h4>
                <p className="text-muted-foreground">
                  Not all officials may file required disclosures on time. We clearly mark when data
                  is incomplete or overdue.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Historical Accuracy</h4>
                <p className="text-muted-foreground">
                  Older records may have different reporting standards or requirements. We note
                  these differences where applicable.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
