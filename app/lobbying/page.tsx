"use client"

import { useState } from "react"
import { Search, Filter, Building2, DollarSign, Users, FileText, TrendingUp, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

// Mock data for lobbying organizations
const mockLobbyingOrgs = [
  {
    id: 1,
    name: "American Petroleum Institute",
    type: "Trade Association",
    industry: "Energy",
    totalSpending: 8900000,
    quarterlySpending: 2200000,
    billsTargeted: 23,
    legislatorsContacted: 89,
    topIssues: ["Climate Policy", "Energy Infrastructure", "Tax Policy"],
    recentActivity: [
      { bill: "Clean Energy Innovation Act", position: "Oppose", spending: 540000 },
      { bill: "Infrastructure Investment Act", position: "Support", spending: 890000 },
    ],
    topRecipients: [
      { name: "Ted Cruz", party: "Republican", state: "TX", amount: 125000 },
      { name: "Joe Manchin", party: "Democrat", state: "WV", amount: 98000 },
    ],
  },
  {
    id: 2,
    name: "Pharmaceutical Research and Manufacturers",
    type: "Trade Association",
    industry: "Healthcare",
    totalSpending: 12400000,
    quarterlySpending: 3100000,
    billsTargeted: 34,
    legislatorsContacted: 156,
    topIssues: ["Drug Pricing", "FDA Regulation", "Healthcare Reform"],
    recentActivity: [
      { bill: "Healthcare Access Act", position: "Oppose", spending: 1200000 },
      { bill: "Medicare Expansion Bill", position: "Oppose", spending: 890000 },
    ],
    topRecipients: [
      { name: "Mitch McConnell", party: "Republican", state: "KY", amount: 189000 },
      { name: "Chuck Schumer", party: "Democrat", state: "NY", amount: 145000 },
    ],
  },
  {
    id: 3,
    name: "Tech Industry Coalition",
    type: "Industry Group",
    industry: "Technology",
    totalSpending: 15600000,
    quarterlySpending: 3900000,
    billsTargeted: 45,
    legislatorsContacted: 203,
    topIssues: ["Data Privacy", "Antitrust", "AI Regulation"],
    recentActivity: [
      { bill: "Digital Privacy Act", position: "Support", spending: 2100000 },
      { bill: "AI Safety Standards", position: "Support", spending: 1800000 },
    ],
    topRecipients: [
      { name: "Alexandria Ocasio-Cortez", party: "Democrat", state: "NY", amount: 89000 },
      { name: "Marco Rubio", party: "Republican", state: "FL", amount: 76000 },
    ],
  },
  {
    id: 4,
    name: "Financial Services Roundtable",
    type: "Trade Association",
    industry: "Finance",
    totalSpending: 9800000,
    quarterlySpending: 2450000,
    billsTargeted: 28,
    legislatorsContacted: 134,
    topIssues: ["Banking Regulation", "Tax Reform", "Cryptocurrency"],
    recentActivity: [
      { bill: "Banking Reform Act", position: "Oppose", spending: 1500000 },
      { bill: "Crypto Regulation Bill", position: "Support", spending: 980000 },
    ],
    topRecipients: [
      { name: "Elizabeth Warren", party: "Democrat", state: "MA", amount: 0 },
      { name: "Pat Toomey", party: "Republican", state: "PA", amount: 156000 },
    ],
  },
]

export default function LobbyingPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedIndustry, setSelectedIndustry] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [sortBy, setSortBy] = useState("spending")

  const filteredOrgs = mockLobbyingOrgs.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.industry.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesIndustry = selectedIndustry === "all" || org.industry.toLowerCase() === selectedIndustry.toLowerCase()
    const matchesType = selectedType === "all" || org.type.toLowerCase().includes(selectedType.toLowerCase())

    return matchesSearch && matchesIndustry && matchesType
  })

  const getIndustryColor = (industry: string) => {
    switch (industry.toLowerCase()) {
      case "energy":
        return "bg-orange-500"
      case "healthcare":
        return "bg-blue-500"
      case "technology":
        return "bg-purple-500"
      case "finance":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
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
            Search by corporation or lobbying firm to discover which politicians they donate to and which bills they're
            actively trying to influence. Track the flow of money and political pressure.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                placeholder="Search organizations, companies, or lobbying firms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="lg:w-auto bg-transparent">
              <Filter className="h-4 w-4 mr-2" />
              Advanced Filters
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
              <SelectTrigger>
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                <SelectItem value="energy">Energy</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Organization Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="trade">Trade Association</SelectItem>
                <SelectItem value="industry">Industry Group</SelectItem>
                <SelectItem value="corporation">Corporation</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spending">Total Spending</SelectItem>
                <SelectItem value="bills">Bills Targeted</SelectItem>
                <SelectItem value="legislators">Legislators Contacted</SelectItem>
                <SelectItem value="recent">Recent Activity</SelectItem>
              </SelectContent>
            </Select>

            <Button className="w-full">Apply Filters</Button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-muted-foreground">
            Showing {filteredOrgs.length} of {mockLobbyingOrgs.length} lobbying organizations
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
                      <div className={`w-4 h-4 rounded-full ${getIndustryColor(org.industry)}`} />
                      <Badge variant="outline">{org.type}</Badge>
                      <Badge variant="secondary">{org.industry}</Badge>
                    </div>
                    <CardTitle className="text-xl mb-2">{org.name}</CardTitle>
                    <CardDescription className="flex items-center gap-4 text-base">
                      <span>Targeting {org.billsTargeted} bills</span>
                      <span>•</span>
                      <span>Contacted {org.legislatorsContacted} legislators</span>
                    </CardDescription>

                    <div className="mt-4">
                      <div className="text-sm font-medium mb-2">Top Issues:</div>
                      <div className="flex flex-wrap gap-2">
                        {org.topIssues.map((issue, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {issue}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary">${(org.totalSpending / 1000000).toFixed(1)}M</div>
                    <div className="text-sm text-muted-foreground">Total Spending</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ${(org.quarterlySpending / 1000).toFixed(0)}K this quarter
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary">{org.billsTargeted}</div>
                    <div className="text-sm text-muted-foreground">Bills Targeted</div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary">{org.legislatorsContacted}</div>
                    <div className="text-sm text-muted-foreground">Legislators Contacted</div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary">{org.recentActivity.length}</div>
                    <div className="text-sm text-muted-foreground">Recent Actions</div>
                  </div>
                </div>

                {/* Recent Activity & Top Recipients */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Recent Lobbying Activity</h4>
                    <div className="space-y-3">
                      {org.recentActivity.map((activity, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border border-border rounded-lg"
                        >
                          <div>
                            <div className="font-medium text-sm">{activity.bill}</div>
                            <Badge
                              variant={activity.position === "Support" ? "default" : "destructive"}
                              className="mt-1 text-xs"
                            >
                              {activity.position}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-primary">${(activity.spending / 1000).toFixed(0)}K</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Top Donation Recipients</h4>
                    <div className="space-y-3">
                      {org.topRecipients.map((recipient, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border border-border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {recipient.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">{recipient.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {recipient.party} • {recipient.state}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-primary">
                              {recipient.amount > 0 ? `$${(recipient.amount / 1000).toFixed(0)}K` : "$0"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Load More */}
        <div className="text-center mt-8">
          <Button variant="outline" size="lg">
            Load More Organizations
          </Button>
        </div>
      </div>
    </div>
  )
}
