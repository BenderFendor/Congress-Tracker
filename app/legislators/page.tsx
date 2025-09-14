"use client"

import { useState } from "react"
import { Search, Filter, MapPin, Users, DollarSign, FileText, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Mock data for demonstration
const mockLegislators = [
  {
    id: 1,
    name: "Alexandria Ocasio-Cortez",
    party: "Democrat",
    state: "NY",
    district: "14th",
    chamber: "House",
    avatar: "/aoc.jpg",
    totalDonations: 8500000,
    topDonor: "ActBlue",
    billsSponsored: 23,
    votingScore: 95,
    committees: ["Financial Services", "Oversight and Reform"],
  },
  {
    id: 2,
    name: "Ted Cruz",
    party: "Republican",
    state: "TX",
    district: null,
    chamber: "Senate",
    avatar: "/ted-cruz-portrait.png",
    totalDonations: 12300000,
    topDonor: "Club for Growth",
    billsSponsored: 47,
    votingScore: 88,
    committees: ["Judiciary", "Commerce, Science, and Transportation"],
  },
  {
    id: 3,
    name: "Nancy Pelosi",
    party: "Democrat",
    state: "CA",
    district: "11th",
    chamber: "House",
    avatar: "/nancy-pelosi-speaker.png",
    totalDonations: 15600000,
    topDonor: "EMILY's List",
    billsSponsored: 156,
    votingScore: 92,
    committees: ["Speaker of the House"],
  },
  {
    id: 4,
    name: "Mitch McConnell",
    party: "Republican",
    state: "KY",
    district: null,
    chamber: "Senate",
    avatar: "/mitch-mcconnell.jpg",
    totalDonations: 18900000,
    topDonor: "Senate Leadership Fund",
    billsSponsored: 89,
    votingScore: 85,
    committees: ["Senate Majority Leader"],
  },
]

export default function LegislatorsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedParty, setSelectedParty] = useState("all")
  const [selectedChamber, setSelectedChamber] = useState("all")
  const [selectedState, setSelectedState] = useState("all")

  const filteredLegislators = mockLegislators.filter((legislator) => {
    const matchesSearch =
      legislator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      legislator.state.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesParty = selectedParty === "all" || legislator.party.toLowerCase() === selectedParty
    const matchesChamber = selectedChamber === "all" || legislator.chamber.toLowerCase() === selectedChamber
    const matchesState = selectedState === "all" || legislator.state === selectedState

    return matchesSearch && matchesParty && matchesChamber && matchesState
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Legislator Search</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Home
              </a>
              <a href="/bills" className="text-muted-foreground hover:text-foreground transition-colors">
                Bills
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
                placeholder="Search by name, state, or district..."
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
            <Select value={selectedParty} onValueChange={setSelectedParty}>
              <SelectTrigger>
                <SelectValue placeholder="Party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Parties</SelectItem>
                <SelectItem value="democrat">Democrat</SelectItem>
                <SelectItem value="republican">Republican</SelectItem>
                <SelectItem value="independent">Independent</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedChamber} onValueChange={setSelectedChamber}>
              <SelectTrigger>
                <SelectValue placeholder="Chamber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Both Chambers</SelectItem>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="senate">Senate</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger>
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="CA">California</SelectItem>
                <SelectItem value="TX">Texas</SelectItem>
                <SelectItem value="NY">New York</SelectItem>
                <SelectItem value="KY">Kentucky</SelectItem>
              </SelectContent>
            </Select>

            <Button className="w-full">Apply Filters</Button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-muted-foreground">
            Showing {filteredLegislators.length} of {mockLegislators.length} legislators
          </p>
        </div>

        {/* Legislator Cards */}
        <div className="grid gap-6">
          {filteredLegislators.map((legislator) => (
            <Card key={legislator.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={legislator.avatar || "/placeholder.svg"} alt={legislator.name} />
                      <AvatarFallback>
                        {legislator.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-xl">{legislator.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant={legislator.party === "Democrat" ? "default" : "secondary"}>
                          {legislator.party}
                        </Badge>
                        <span className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {legislator.state}
                          {legislator.district && `-${legislator.district}`} • {legislator.chamber}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Profile
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      ${(legislator.totalDonations / 1000000).toFixed(1)}M
                    </div>
                    <div className="text-sm text-muted-foreground">Total Donations</div>
                    <div className="text-xs text-muted-foreground mt-1">Top: {legislator.topDonor}</div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary">{legislator.billsSponsored}</div>
                    <div className="text-sm text-muted-foreground">Bills Sponsored</div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-primary">{legislator.votingScore}%</div>
                    <div className="text-sm text-muted-foreground">Voting Score</div>
                  </div>

                  <div className="text-center">
                    <div className="text-sm font-medium text-foreground mb-2">Committees</div>
                    <div className="space-y-1">
                      {legislator.committees.slice(0, 2).map((committee, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {committee}
                        </Badge>
                      ))}
                      {legislator.committees.length > 2 && (
                        <div className="text-xs text-muted-foreground">+{legislator.committees.length - 2} more</div>
                      )}
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
            Load More Legislators
          </Button>
        </div>
      </div>
    </div>
  )
}
