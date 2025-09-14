"use client"

import { useState } from "react"
import { ArrowLeft, Building2, DollarSign, FileText, Users, TrendingUp, ExternalLink, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"

// Mock data for detailed organization profile
const mockOrganization = {
  id: 1,
  name: "American Petroleum Institute",
  type: "Trade Association",
  industry: "Energy",
  founded: "1919",
  headquarters: "Washington, D.C.",
  description:
    "The American Petroleum Institute is the main U.S. trade association for the oil and gas industry, representing over 600 corporate members involved in production, refinement, distribution, and other aspects of the petroleum industry.",
  totalSpending: 8900000,
  quarterlySpending: 2200000,
  yearOverYearChange: 12.5,
  billsTargeted: 23,
  legislatorsContacted: 89,
  topIssues: ["Climate Policy", "Energy Infrastructure", "Tax Policy", "Environmental Regulation"],
  lobbyingHistory: [
    { quarter: "Q1 2024", spending: 2100000, bills: 18, legislators: 76 },
    { quarter: "Q4 2023", spending: 2400000, bills: 21, legislators: 82 },
    { quarter: "Q3 2023", spending: 1900000, bills: 15, legislators: 71 },
    { quarter: "Q2 2023", spending: 2200000, bills: 19, legislators: 78 },
  ],
  targetedBills: [
    {
      bill: "Clean Energy Innovation Act",
      position: "Oppose",
      spending: 540000,
      status: "Committee Review",
      lastAction: "2024-03-20",
    },
    {
      bill: "Infrastructure Investment Act",
      position: "Support",
      spending: 890000,
      status: "Passed House",
      lastAction: "2024-02-15",
    },
    {
      bill: "Carbon Tax Implementation",
      position: "Oppose",
      spending: 720000,
      status: "Senate Review",
      lastAction: "2024-01-30",
    },
  ],
  donationRecipients: [
    {
      name: "Ted Cruz",
      party: "Republican",
      state: "TX",
      chamber: "Senate",
      amount: 125000,
      avatar: "/ted-cruz-portrait.png",
      committees: ["Energy and Natural Resources"],
    },
    {
      name: "Joe Manchin",
      party: "Democrat",
      state: "WV",
      chamber: "Senate",
      amount: 98000,
      avatar: "/placeholder.svg?key=manchin",
      committees: ["Energy and Natural Resources"],
    },
    {
      name: "Lisa Murkowski",
      party: "Republican",
      state: "AK",
      chamber: "Senate",
      amount: 87000,
      avatar: "/placeholder.svg?key=murkowski",
      committees: ["Energy and Natural Resources"],
    },
  ],
  keyLobbyists: [
    { name: "Michael Johnson", title: "Senior Vice President", experience: "15 years" },
    { name: "Sarah Williams", title: "Director of Government Affairs", experience: "12 years" },
    { name: "Robert Chen", title: "Policy Advisor", experience: "8 years" },
  ],
}

export default function OrganizationProfilePage() {
  const [activeTab, setActiveTab] = useState("overview")

  const getPositionColor = (position: string) => {
    return position === "Support" ? "default" : "destructive"
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Search
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-semibold text-foreground">Organization Profile</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="w-20 h-20 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building2 className="h-10 w-10 text-primary" />
              </div>

              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                  <div>
                    <CardTitle className="text-3xl mb-2">{mockOrganization.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-lg">
                      <Badge variant="outline">{mockOrganization.type}</Badge>
                      <Badge variant="secondary">{mockOrganization.industry}</Badge>
                      <span>•</span>
                      <span>Founded {mockOrganization.founded}</span>
                      <span>•</span>
                      <span>{mockOrganization.headquarters}</span>
                    </CardDescription>
                  </div>
                  <Button>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Official Website
                  </Button>
                </div>

                <p className="text-muted-foreground mb-4">{mockOrganization.description}</p>

                <div className="flex flex-wrap gap-2">
                  {mockOrganization.topIssues.map((issue, index) => (
                    <Badge key={index} variant="outline">
                      {issue}
                    </Badge>
                  ))}
                </div>
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
                Total Spending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ${(mockOrganization.totalSpending / 1000000).toFixed(1)}M
              </div>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-500">+{mockOrganization.yearOverYearChange}% YoY</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <FileText className="h-4 w-4 mr-2 text-primary" />
                Bills Targeted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{mockOrganization.billsTargeted}</div>
              <p className="text-xs text-muted-foreground">This quarter</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Users className="h-4 w-4 mr-2 text-primary" />
                Legislators Contacted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{mockOrganization.legislatorsContacted}</div>
              <p className="text-xs text-muted-foreground">Across both chambers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-primary" />
                Quarterly Spending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ${(mockOrganization.quarterlySpending / 1000).toFixed(0)}K
              </div>
              <Progress value={75} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Detailed Information Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bills">Targeted Bills</TabsTrigger>
            <TabsTrigger value="donations">Political Donations</TabsTrigger>
            <TabsTrigger value="history">Lobbying History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Lobbying Focus</CardTitle>
                    <CardDescription>Top bills being targeted this quarter</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mockOrganization.targetedBills.slice(0, 3).map((bill, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{bill.bill}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={getPositionColor(bill.position)} className="text-xs">
                                {bill.position}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{bill.status}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-primary">${(bill.spending / 1000).toFixed(0)}K</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Key Lobbyists</CardTitle>
                    <CardDescription>Primary representatives for this organization</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mockOrganization.keyLobbyists.map((lobbyist, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{lobbyist.name}</div>
                            <div className="text-sm text-muted-foreground">{lobbyist.title}</div>
                          </div>
                          <div className="text-sm text-muted-foreground">{lobbyist.experience}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top Donation Recipients</CardTitle>
                  <CardDescription>Legislators receiving the most contributions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockOrganization.donationRecipients.slice(0, 3).map((recipient, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={recipient.avatar || "/placeholder.svg"} alt={recipient.name} />
                            <AvatarFallback>
                              {recipient.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{recipient.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {recipient.party} • {recipient.state} • {recipient.chamber}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{recipient.committees.join(", ")}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-primary">${(recipient.amount / 1000).toFixed(0)}K</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="bills" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Targeted Legislation</CardTitle>
                <CardDescription>Bills this organization is actively lobbying</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {mockOrganization.targetedBills.map((bill, index) => (
                    <div key={index} className="p-4 border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-lg">{bill.bill}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={getPositionColor(bill.position)}>{bill.position}</Badge>
                            <Badge variant="outline">{bill.status}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-primary">${(bill.spending / 1000).toFixed(0)}K</div>
                          <div className="text-sm text-muted-foreground">Spent</div>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-2" />
                        Last Action: {bill.lastAction}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="donations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Political Contributions</CardTitle>
                <CardDescription>Campaign donations to legislators and committees</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {mockOrganization.donationRecipients.map((recipient, index) => (
                    <div key={index} className="p-4 border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={recipient.avatar || "/placeholder.svg"} alt={recipient.name} />
                            <AvatarFallback>
                              {recipient.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-lg">{recipient.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {recipient.party} • {recipient.state} • {recipient.chamber}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            ${(recipient.amount / 1000).toFixed(0)}K
                          </div>
                          <div className="text-sm text-muted-foreground">Total contributions</div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong>Committees:</strong> {recipient.committees.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Quarterly Lobbying Activity</CardTitle>
                <CardDescription>Historical spending and activity trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockOrganization.lobbyingHistory.map((period, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <div className="font-medium">{period.quarter}</div>
                        <div className="text-sm text-muted-foreground">
                          {period.bills} bills • {period.legislators} legislators
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-primary">${(period.spending / 1000000).toFixed(1)}M</div>
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
