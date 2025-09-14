"use client"

import { useState } from "react"
import { Search, Filter, FileText, Calendar, Users, DollarSign, TrendingUp, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Mock data for bills
const mockBills = [
  {
    id: 1,
    number: "H.R. 1234",
    title: "Clean Energy Innovation Act",
    summary:
      "A comprehensive bill to accelerate clean energy research, development, and deployment while creating jobs in the renewable energy sector.",
    status: "Committee Review",
    introduced: "2024-03-15",
    sponsor: {
      name: "Alexandria Ocasio-Cortez",
      party: "Democrat",
      state: "NY",
      avatar: "/aoc.jpg",
    },
    cosponsors: 47,
    lobbyingSpend: 2400000,
    topLobbyists: ["Clean Energy Coalition", "Solar Power Association"],
    relatedDonations: 890000,
    category: "Environment",
    lastAction: "Referred to Committee on Energy and Commerce",
  },
  {
    id: 2,
    number: "S. 567",
    title: "Healthcare Access and Affordability Act",
    summary:
      "Legislation aimed at reducing prescription drug costs and expanding healthcare coverage for underserved communities.",
    status: "Passed Senate",
    introduced: "2024-02-20",
    sponsor: {
      name: "Bernie Sanders",
      party: "Independent",
      state: "VT",
      avatar: "/placeholder.svg?key=bernie",
    },
    cosponsors: 23,
    lobbyingSpend: 5600000,
    topLobbyists: ["Pharmaceutical Research", "Healthcare Alliance"],
    relatedDonations: 1200000,
    category: "Healthcare",
    lastAction: "Passed Senate 67-33",
  },
  {
    id: 3,
    number: "H.R. 2890",
    title: "Infrastructure Investment and Jobs Act",
    summary:
      "A bipartisan infrastructure package focusing on roads, bridges, broadband, and public transportation improvements.",
    status: "Signed into Law",
    introduced: "2024-01-10",
    sponsor: {
      name: "Nancy Pelosi",
      party: "Democrat",
      state: "CA",
      avatar: "/nancy-pelosi-speaker.png",
    },
    cosponsors: 156,
    lobbyingSpend: 8900000,
    topLobbyists: ["Construction Industry", "Transportation Alliance"],
    relatedDonations: 2100000,
    category: "Infrastructure",
    lastAction: "Signed by President",
  },
  {
    id: 4,
    number: "S. 445",
    title: "Tax Reform and Simplification Act",
    summary: "Comprehensive tax reform legislation aimed at simplifying the tax code and reducing corporate tax rates.",
    status: "House Review",
    introduced: "2024-04-05",
    sponsor: {
      name: "Ted Cruz",
      party: "Republican",
      state: "TX",
      avatar: "/ted-cruz-portrait.png",
    },
    cosponsors: 34,
    lobbyingSpend: 12300000,
    topLobbyists: ["Business Roundtable", "Tax Reform Coalition"],
    relatedDonations: 3400000,
    category: "Tax Policy",
    lastAction: "Referred to House Ways and Means Committee",
  },
]

export default function BillsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [sortBy, setSortBy] = useState("recent")

  const filteredBills = mockBills.filter((bill) => {
    const matchesSearch =
      bill.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.sponsor.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === "all" || bill.status.toLowerCase().includes(selectedStatus.toLowerCase())
    const matchesCategory = selectedCategory === "all" || bill.category.toLowerCase() === selectedCategory.toLowerCase()

    return matchesSearch && matchesStatus && matchesCategory
  })

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "signed into law":
        return "default"
      case "passed senate":
      case "passed house":
        return "secondary"
      case "committee review":
      case "house review":
        return "outline"
      default:
        return "outline"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Bill Explorer</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Home
              </a>
              <a href="/legislators" className="text-muted-foreground hover:text-foreground transition-colors">
                Legislators
              </a>
              <a href="/lobbying" className="text-muted-foreground hover:text-foreground transition-colors">
                Lobbying
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                placeholder="Search bills by title, number, or sponsor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="lg:w-auto bg-transparent">
              <Filter className="h-4 w-4 mr-2" />
              Advanced Search
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="committee">Committee Review</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="signed">Signed into Law</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="environment">Environment</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="infrastructure">Infrastructure</SelectItem>
                <SelectItem value="tax policy">Tax Policy</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="lobbying">Lobbying Spend</SelectItem>
                <SelectItem value="cosponsors">Most Cosponsors</SelectItem>
                <SelectItem value="donations">Related Donations</SelectItem>
              </SelectContent>
            </Select>

            <Button className="w-full">Apply Filters</Button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-muted-foreground">
            Showing {filteredBills.length} of {mockBills.length} bills
          </p>
        </div>

        {/* Bill Cards */}
        <div className="grid gap-6">
          {filteredBills.map((bill) => (
            <Card key={bill.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className="font-mono">
                        {bill.number}
                      </Badge>
                      <Badge variant={getStatusColor(bill.status)}>{bill.status}</Badge>
                      <Badge variant="secondary">{bill.category}</Badge>
                    </div>
                    <CardTitle className="text-xl mb-2">{bill.title}</CardTitle>
                    <CardDescription className="text-base mb-4">{bill.summary}</CardDescription>

                    {/* Sponsor Info */}
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={bill.sponsor.avatar || "/placeholder.svg"} alt={bill.sponsor.name} />
                        <AvatarFallback>
                          {bill.sponsor.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">Sponsored by {bill.sponsor.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {bill.sponsor.party} • {bill.sponsor.state} • {bill.cosponsors} cosponsors
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          Introduced {bill.introduced}
                        </span>
                        <span>Last Action: {bill.lastAction}</span>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary">${(bill.lobbyingSpend / 1000000).toFixed(1)}M</div>
                    <div className="text-sm text-muted-foreground">Lobbying Spend</div>
                    <div className="text-xs text-muted-foreground mt-1">Top: {bill.topLobbyists[0]}</div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary">{bill.cosponsors}</div>
                    <div className="text-sm text-muted-foreground">Cosponsors</div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary">${(bill.relatedDonations / 1000).toFixed(0)}K</div>
                    <div className="text-sm text-muted-foreground">Related Donations</div>
                  </div>

                  <div className="text-center">
                    <div className="text-sm font-medium text-foreground mb-2">Top Lobbyists</div>
                    <div className="space-y-1">
                      {bill.topLobbyists.slice(0, 2).map((lobbyist, index) => (
                        <Badge key={index} variant="outline" className="text-xs block">
                          {lobbyist}
                        </Badge>
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
            Load More Bills
          </Button>
        </div>
      </div>
    </div>
  )
}
