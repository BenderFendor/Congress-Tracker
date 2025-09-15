"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Building2, DollarSign, Users, FileText, TrendingUp, ExternalLink, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  TopSpender,
  TopLobbyingFirm,
  Industry,
  LobbyistRecipient,
  parseTopSpenders,
  parseTopLobbyingFirms,
  parseIndustries,
  parseLobbyistRecipients,
  formatCurrency
} from "@/lib/csvUtils"

interface Registrant {
  id: number
  name: string
  description?: string
  address_1?: string
  address_2?: string
  city?: string
  state?: string
  state_display?: string
  zip?: string
  country?: string
  country_display?: string
  contact_name?: string
  contact_telephone?: string
  url: string
  dt_updated: string
}

interface Filing {
  filing_uuid: string
  filing_type: string
  filing_type_display: string
  filing_year: number
  filing_period: string
  filing_period_display: string
  dt_posted: string
  registrant: Registrant
  client?: {
    id: number
    name: string
    state?: string
    country?: string
  }
  lobbying_activities?: Array<{
    general_issue_area: string
    general_issue_area_display: string
    description?: string
    house_of_representatives: boolean
    senate: boolean
  }>
  income?: number
  expenses?: number
  url: string
}

// Get the current year for filtering recent data
const currentYear = new Date().getFullYear()

export default function LobbyingPage() {
  const [filings, setFilings] = useState<Filing[]>([])
  const [registrants, setRegistrants] = useState<Registrant[]>([])
  const [topSpenders, setTopSpenders] = useState<TopSpender[]>([])
  const [topFirms, setTopFirms] = useState<TopLobbyingFirm[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [recipients, setRecipients] = useState<LobbyistRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedYear, setSelectedYear] = useState(currentYear.toString())
  const [selectedPeriod, setSelectedPeriod] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [activeTab, setActiveTab] = useState("filings")

  useEffect(() => {
    const fetchLobbyingData = async () => {
      try {
        setLoading(true)
        
        // Fetch API data and CSV data in parallel
        const [
          filingsResponse,
          registrantsResponse,
          topSpendersResponse,
          topFirmsResponse,
          industriesResponse,
          recipients2024Response,
          recipients2022Response
        ] = await Promise.all([
          // API data
          fetch(`/api/congress-proxy?url=${encodeURIComponent(`https://lda.senate.gov/api/v1/filings/?filing_year=${currentYear}&page_size=25&ordering=-dt_posted`)}`),
          fetch(`/api/congress-proxy?url=${encodeURIComponent(`https://lda.senate.gov/api/v1/registrants/?page_size=25`)}`),
          // CSV data
          fetch('/data/Top Spenders.csv'),
          fetch('/data/Top Lobbying Firms.csv'),
          fetch('/data/Industries.csv'),
          fetch('/data/Top Recipients of Contributions from Lobbyists, 2024 Cycle.csv'),
          fetch('/data/Top Recipients of Contributions from Lobbyists, 2022 Cycle.csv')
        ])
        
        // Process API data
        const filingsData = await filingsResponse.json()
        const registrantsData = await registrantsResponse.json()
        
        // Process CSV data
        const topSpendersText = await topSpendersResponse.text()
        const topFirmsText = await topFirmsResponse.text()
        const industriesText = await industriesResponse.text()
        const recipients2024Text = await recipients2024Response.text()
        const recipients2022Text = await recipients2022Response.text()
        
        // Parse CSV data
        const parsedTopSpenders = parseTopSpenders(topSpendersText)
        const parsedTopFirms = parseTopLobbyingFirms(topFirmsText)
        const parsedIndustries = parseIndustries(industriesText)
        const parsedRecipients2024 = parseLobbyistRecipients(recipients2024Text, '2024')
        const parsedRecipients2022 = parseLobbyistRecipients(recipients2022Text, '2022')
        
        console.log("Lobbying data loaded:", {
          filings: filingsData.results?.length || 0,
          registrants: registrantsData.results?.length || 0,
          topSpenders: parsedTopSpenders.length,
          topFirms: parsedTopFirms.length,
          industries: parsedIndustries.length,
          recipients: parsedRecipients2024.length + parsedRecipients2022.length
        })
        
        // Set state
        setFilings(filingsData.results || [])
        setRegistrants(registrantsData.results || [])
        setTopSpenders(parsedTopSpenders)
        setTopFirms(parsedTopFirms)
        setIndustries(parsedIndustries)
        setRecipients([...parsedRecipients2024, ...parsedRecipients2022])
      } catch (e: any) {
        console.error("Lobbying data fetch error:", e)
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchLobbyingData()
  }, [])

  if (loading) return <div className="p-8 text-center">Loading lobbying data...</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>

  // Group filings by registrant for better display
  const registrantFilings = new Map<number, Filing[]>()
  filings.forEach(filing => {
    const registrantId = filing.registrant.id
    if (!registrantFilings.has(registrantId)) {
      registrantFilings.set(registrantId, [])
    }
    registrantFilings.get(registrantId)?.push(filing)
  })

  // Create combined data for display
  const lobbyingOrganizations = Array.from(registrantFilings.entries()).map(([registrantId, orgFilings]) => {
    const registrant = orgFilings[0].registrant
    const totalIncome = orgFilings.reduce((sum, filing) => sum + (filing.income || 0), 0)
    const totalExpenses = orgFilings.reduce((sum, filing) => sum + (filing.expenses || 0), 0)
    const uniqueClients = new Set(orgFilings.map(f => f.client?.name).filter(Boolean))
    const allIssues = new Set(
      orgFilings.flatMap(f => 
        f.lobbying_activities?.map(a => a.general_issue_area_display).filter(Boolean) || []
      )
    )
    
    return {
      id: registrantId,
      registrant,
      filings: orgFilings,
      totalIncome,
      totalExpenses,
      clientCount: uniqueClients.size,
      issueAreas: Array.from(allIssues).slice(0, 5), // Top 5 issues
      mostRecentFiling: orgFilings[0]
    }
  })

  const filteredOrgs = lobbyingOrganizations.filter((org) => {
    const matchesSearch = 
      org.registrant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.issueAreas.some(issue => issue && issue.toLowerCase().includes(searchTerm.toLowerCase()))
    
    return matchesSearch
  })

  const getIssueColor = (issue: string) => {
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", 
      "bg-red-500", "bg-yellow-500", "bg-pink-500", "bg-indigo-500"
    ]
    if (!issue || typeof issue !== 'string') {
      return colors[0] // Default to first color
    }
    const index = issue.length % colors.length
    return colors[index]
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Lobbying Search</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Home
              </a>
              <a href="/legislators" className="text-muted-foreground hover:text-foreground transition-colors">
                Legislators
              </a>
              <a href="/bills" className="text-muted-foreground hover:text-foreground transition-colors">
                Bills
              </a>
              <a href="/visualizations" className="text-muted-foreground hover:text-foreground transition-colors">
                Visualizations
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-4">Lobbying Organizations & Influence</h2>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Comprehensive lobbying data from Senate filings and historical spending records. Track the flow of money and political influence.
          </p>
        </div>

        {/* Data Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="filings">Recent Filings</TabsTrigger>
            <TabsTrigger value="spenders">Top Spenders</TabsTrigger>
            <TabsTrigger value="firms">Top Firms</TabsTrigger>
            <TabsTrigger value="industries">Industries</TabsTrigger>
            <TabsTrigger value="recipients">Recipients</TabsTrigger>
          </TabsList>

          {/* Recent Filings Tab */}
          <TabsContent value="filings" className="space-y-6">
            {/* Search and Filters for Filings */}
            <div className="mb-6">
              <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                  <Input
                    placeholder="Search lobbying organizations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filing Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
                    <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1}</SelectItem>
                    <SelectItem value={(currentYear - 2).toString()}>{currentYear - 2}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filing Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    <SelectItem value="first_quarter">Q1</SelectItem>
                    <SelectItem value="second_quarter">Q2</SelectItem>
                    <SelectItem value="third_quarter">Q3</SelectItem>
                    <SelectItem value="fourth_quarter">Q4</SelectItem>
                  </SelectContent>
                </Select>

                <Button className="w-full" onClick={() => window.location.reload()}>Refresh Data</Button>
              </div>

              <p className="text-muted-foreground mt-4">
                Showing {filteredOrgs.length} lobbying organizations with {filings.length} recent filings
              </p>
            </div>

            {/* Organization Cards */}
            <div className="grid gap-6">
              {filteredOrgs.map((org) => (
                <Card key={org.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-4 h-4 rounded-full bg-primary" />
                          <Badge variant="outline">Registrant</Badge>
                          <Badge variant="secondary">{org.registrant.state_display || "Federal"}</Badge>
                        </div>
                        <CardTitle className="text-xl mb-2">{org.registrant.name}</CardTitle>
                        <CardDescription className="flex items-center gap-4 text-base">
                          <span>{org.filings.length} filings this year</span>
                          <span>•</span>
                          <span>{org.clientCount} clients</span>
                        </CardDescription>

                        <div className="mt-4">
                          <div className="text-sm font-medium mb-2">Issue Areas:</div>
                          <div className="flex flex-wrap gap-2">
                            {org.issueAreas.map((issue, index) => (
                              <Badge 
                                key={index} 
                                variant="outline" 
                                className={`text-xs text-white ${getIssueColor(issue)}`}
                              >
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Button variant="outline" size="sm" asChild>
                        <a href={org.registrant.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Details
                        </a>
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          <DollarSign className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {org.totalIncome > 0 ? formatCurrency(org.totalIncome) : 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Income</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Expenses: {org.totalExpenses > 0 ? formatCurrency(org.totalExpenses) : 'N/A'}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-2xl font-bold text-primary">{org.filings.length}</div>
                        <div className="text-sm text-muted-foreground">Filings</div>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-2xl font-bold text-primary">{org.clientCount}</div>
                        <div className="text-sm text-muted-foreground">Clients</div>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-2xl font-bold text-primary">{org.issueAreas.length}</div>
                        <div className="text-sm text-muted-foreground">Issue Areas</div>
                      </div>
                    </div>

                    {/* Recent Filings */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-3">Recent Filings</h4>
                        <div className="space-y-3">
                          {org.filings.slice(0, 3).map((filing, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 border border-border rounded-lg"
                            >
                              <div>
                                <div className="font-medium text-sm">
                                  {filing.filing_type_display} - {filing.filing_period_display}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {new Date(filing.dt_posted).toLocaleDateString()}
                                </div>
                                {filing.client && (
                                  <Badge variant="outline" className="mt-1 text-xs">
                                    Client: {filing.client.name}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-primary">
                                  {filing.income ? formatCurrency(filing.income) : 'N/A'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-3">Organization Info</h4>
                        <div className="space-y-3">
                          <div className="p-3 border border-border rounded-lg">
                            <div className="text-sm font-medium">Contact</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {org.registrant.contact_name || 'Not specified'}
                            </div>
                            {org.registrant.contact_telephone && (
                              <div className="text-xs text-muted-foreground">
                                {org.registrant.contact_telephone}
                              </div>
                            )}
                          </div>
                          
                          <div className="p-3 border border-border rounded-lg">
                            <div className="text-sm font-medium">Address</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {org.registrant.address_1 || 'Not specified'}
                              {org.registrant.city && (
                                <>
                                  <br />
                                  {org.registrant.city}, {org.registrant.state_display} {org.registrant.zip}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Top Spenders Tab */}
          <TabsContent value="spenders" className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Top Lobbying Spenders (All Time)</h3>
              </div>
              {topSpenders.slice(0, 20).map((spender, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">#{index + 1}</span>
                      </div>
                      <h4 className="font-medium">{spender.client}</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-primary">{formatCurrency(spender.totalSpent)}</div>
                      <div className="text-xs text-muted-foreground">Total Spent</div>
                    </div>
                  </div>
                  <Progress 
                    value={(spender.totalSpent / topSpenders[0]?.totalSpent) * 100} 
                    className="h-2"
                  />
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Top Lobbying Firms Tab */}
          <TabsContent value="firms" className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Top Lobbying Firms by Income</h3>
              </div>
              {topFirms.slice(0, 20).map((firm, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-secondary">#{index + 1}</span>
                      </div>
                      <h4 className="font-medium">{firm.firm}</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-secondary">{formatCurrency(firm.totalIncome)}</div>
                      <div className="text-xs text-muted-foreground">Total Income</div>
                    </div>
                  </div>
                  <Progress 
                    value={(firm.totalIncome / topFirms[0]?.totalIncome) * 100} 
                    className="h-2"
                  />
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Industries Tab */}
          <TabsContent value="industries" className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Top Industries by Lobbying Spending</h3>
              </div>
              {industries.slice(0, 20).map((industry, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getIssueColor(industry.name)}`}>
                        <span className="text-sm font-bold text-white">#{index + 1}</span>
                      </div>
                      <h4 className="font-medium">{industry.name}</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-primary">{formatCurrency(industry.total)}</div>
                      <div className="text-xs text-muted-foreground">Total Spending</div>
                    </div>
                  </div>
                  <Progress 
                    value={(industry.total / industries[0]?.total) * 100} 
                    className="h-2"
                  />
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Recipients Tab */}
          <TabsContent value="recipients" className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Top Recipients of Lobbyist Contributions</h3>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-4">2024 Election Cycle</h4>
                  {recipients.filter(r => r.cycle === '2024').slice(0, 10).map((recipient, index) => (
                    <Card key={index} className="p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {recipient.recipient
                                .split(" ")
                                .map((n) => n[0])
                                .join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{recipient.recipient}</div>
                            <div className="text-xs text-muted-foreground">
                              Including family: {formatCurrency(recipient.fromLobbyistsFamily)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary">{formatCurrency(recipient.fromLobbyists)}</div>
                          <div className="text-xs text-muted-foreground">From Lobbyists</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div>
                  <h4 className="font-medium mb-4">2022 Election Cycle</h4>
                  {recipients.filter(r => r.cycle === '2022').slice(0, 10).map((recipient, index) => (
                    <Card key={index} className="p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {recipient.recipient
                                .split(" ")
                                .map((n) => n[0])
                                .join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">{recipient.recipient}</div>
                            <div className="text-xs text-muted-foreground">
                              Including family: {formatCurrency(recipient.fromLobbyistsFamily)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary">{formatCurrency(recipient.fromLobbyists)}</div>
                          <div className="text-xs text-muted-foreground">From Lobbyists</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
