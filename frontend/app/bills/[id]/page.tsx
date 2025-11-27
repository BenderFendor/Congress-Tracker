"use client"

import { useState } from "react"
import { ArrowLeft, FileText, Calendar, Users, DollarSign, TrendingUp, ExternalLink, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock data for detailed bill information
const mockBill = {
  id: 1,
  number: "H.R. 1234",
  title: "Clean Energy Innovation Act",
  fullTitle:
    "A bill to accelerate clean energy research, development, and deployment, create jobs in the renewable energy sector, and establish a national clean energy standard.",
  summary:
    "This comprehensive legislation aims to position the United States as a global leader in clean energy technology while creating millions of jobs and reducing greenhouse gas emissions by 50% by 2030.",
  status: "Committee Review",
  introduced: "2024-03-15",
  lastAction: "Referred to Committee on Energy and Commerce",
  category: "Environment",
  sponsor: {
    name: "Alexandria Ocasio-Cortez",
    party: "Democrat",
    state: "NY",
    district: "14th",
    avatar: "/aoc.jpg",
  },
  cosponsors: [
    { name: "Bernie Sanders", party: "Independent", state: "VT" },
    { name: "Elizabeth Warren", party: "Democrat", state: "MA" },
    { name: "Ed Markey", party: "Democrat", state: "MA" },
  ],
  totalCosponsors: 47,
  lobbyingData: {
    totalSpend: 2400000,
    organizations: [
      { name: "Clean Energy Coalition", spend: 850000, position: "Support" },
      { name: "Solar Power Association", spend: 620000, position: "Support" },
      { name: "American Petroleum Institute", spend: 540000, position: "Oppose" },
      { name: "Coal Industry Alliance", spend: 390000, position: "Oppose" },
    ],
  },
  relatedDonations: {
    total: 890000,
    toSponsor: 340000,
    toCosponsors: 550000,
    topDonors: [
      { name: "NextGen Climate Action", amount: 180000 },
      { name: "League of Conservation Voters", amount: 160000 },
      { name: "Sierra Club", amount: 140000 },
    ],
  },
  timeline: [
    { date: "2024-03-15", action: "Introduced in House", status: "completed" },
    { date: "2024-03-16", action: "Referred to Committee on Energy and Commerce", status: "completed" },
    { date: "2024-03-20", action: "Subcommittee hearings scheduled", status: "current" },
    { date: "TBD", action: "Committee markup", status: "pending" },
    { date: "TBD", action: "House floor vote", status: "pending" },
  ],
  keyProvisions: [
    "Establishes a national clean energy standard requiring 100% clean electricity by 2035",
    "Creates a $50 billion clean energy innovation fund for research and development",
    "Provides tax incentives for renewable energy projects and energy storage",
    "Invests $25 billion in clean energy workforce training programs",
  ],
}

export default function BillDetailPage() {
  const [activeTab, setActiveTab] = useState("overview")

  const getTimelineStatus = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-primary"
      case "current":
        return "bg-secondary"
      case "pending":
        return "bg-muted"
      default:
        return "bg-muted"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Bills
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-semibold text-foreground">Bill Details</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Bill Header */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant="outline" className="font-mono text-lg px-3 py-1">
                    {mockBill.number}
                  </Badge>
                  <Badge variant="default">{mockBill.status}</Badge>
                  <Badge variant="secondary">{mockBill.category}</Badge>
                </div>

                <CardTitle className="text-3xl mb-4">{mockBill.title}</CardTitle>
                <CardDescription className="text-lg mb-6">{mockBill.fullTitle}</CardDescription>

                <p className="text-muted-foreground mb-6">{mockBill.summary}</p>

                {/* Sponsor and Date Info */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={mockBill.sponsor.avatar || "/placeholder.svg"} alt={mockBill.sponsor.name} />
                      <AvatarFallback>
                        {mockBill.sponsor.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">Sponsored by {mockBill.sponsor.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {mockBill.sponsor.party} • {mockBill.sponsor.state}-{mockBill.sponsor.district}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      Introduced {mockBill.introduced}
                    </div>
                    <div className="mt-1">{mockBill.totalCosponsors} cosponsors</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Congress.gov
                </Button>
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Full Text (PDF)
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-primary" />
                Lobbying Spend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ${(mockBill.lobbyingData.totalSpend / 1000000).toFixed(1)}M
              </div>
              <p className="text-xs text-muted-foreground">
                {mockBill.lobbyingData.organizations.length} organizations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Users className="h-4 w-4 mr-2 text-primary" />
                Congressional Support
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{mockBill.totalCosponsors}</div>
              <p className="text-xs text-muted-foreground">Cosponsors</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-primary" />
                Related Donations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ${(mockBill.relatedDonations.total / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-muted-foreground">To sponsor & cosponsors</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Building2 className="h-4 w-4 mr-2 text-primary" />
                Industry Interest
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">High</div>
              <p className="text-xs text-muted-foreground">Based on lobbying activity</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Information Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="lobbying">Lobbying</TabsTrigger>
            <TabsTrigger value="finance">Campaign Finance</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Key Provisions</CardTitle>
                  <CardDescription>Main components of this legislation</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {mockBill.keyProvisions.map((provision, index) => (
                      <li key={index} className="flex items-start">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0" />
                        <span>{provision}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Cosponsors</CardTitle>
                  <CardDescription>Key supporters of this legislation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockBill.cosponsors.slice(0, 3).map((cosponsor, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{cosponsor.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {cosponsor.party} • {cosponsor.state}
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          View Profile
                        </Button>
                      </div>
                    ))}
                    <div className="text-sm text-muted-foreground text-center pt-2">
                      +{mockBill.totalCosponsors - 3} more cosponsors
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="lobbying" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Lobbying Activity</CardTitle>
                <CardDescription>Organizations spending money to influence this bill</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {mockBill.lobbyingData.organizations.map((org, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <div className="font-medium text-lg">{org.name}</div>
                        <Badge variant={org.position === "Support" ? "default" : "destructive"} className="mt-1">
                          {org.position}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-primary">${(org.spend / 1000).toFixed(0)}K</div>
                        <div className="text-sm text-muted-foreground">
                          {((org.spend / mockBill.lobbyingData.totalSpend) * 100).toFixed(1)}% of total
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="finance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Related Campaign Contributions</CardTitle>
                <CardDescription>Donations to sponsor and cosponsors from interested parties</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-border rounded-lg">
                      <div className="text-sm font-medium text-muted-foreground">To Sponsor</div>
                      <div className="text-2xl font-bold text-primary">
                        ${(mockBill.relatedDonations.toSponsor / 1000).toFixed(0)}K
                      </div>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <div className="text-sm font-medium text-muted-foreground">To Cosponsors</div>
                      <div className="text-2xl font-bold text-primary">
                        ${(mockBill.relatedDonations.toCosponsors / 1000).toFixed(0)}K
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-4">Top Contributing Organizations</h4>
                    <div className="space-y-3">
                      {mockBill.relatedDonations.topDonors.map((donor, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="font-medium">{donor.name}</div>
                          <div className="text-primary font-bold">${(donor.amount / 1000).toFixed(0)}K</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Legislative Timeline</CardTitle>
                <CardDescription>Progress of this bill through Congress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {mockBill.timeline.map((item, index) => (
                    <div key={index} className="flex items-start space-x-4">
                      <div className={`w-4 h-4 rounded-full mt-1 ${getTimelineStatus(item.status)}`} />
                      <div className="flex-1">
                        <div className="font-medium">{item.action}</div>
                        <div className="text-sm text-muted-foreground">{item.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
