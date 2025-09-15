"use client"

import { useState, useEffect } from "react"
import { Search, Filter, MapPin, Users, DollarSign, FileText, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface Member {
  bioguideId: string
  name: string
  state: string
  district?: number
  partyName: string
  terms: {
    item: Array<{
      chamber: string
      startYear: number
      endYear?: number
    }>
  }
  depiction?: {
    imageUrl: string
    attribution: string
  }
  sponsoredLegislation?: {
    count: number
    url: string
  }
  cosponsoredLegislation?: {
    count: number
    url: string
  }
  officialWebsiteUrl?: string
  birthYear?: number
  updateDate: string
  url: string
}

export default function LegislatorsPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedParty, setSelectedParty] = useState("all")
  const [selectedChamber, setSelectedChamber] = useState("all")
  const [selectedState, setSelectedState] = useState("all")

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        // Get multiple pages to have more members
        const fetchPage = async (offset: number = 0) => {
          const url = `https://api.congress.gov/v3/member?offset=${offset}&limit=50`
          const res = await fetch(`/api/congress-proxy?url=${encodeURIComponent(url)}`)
          if (!res.ok) throw new Error("Failed to fetch members")
          return await res.json()
        }

        // Fetch first few pages
        const [page1, page2] = await Promise.all([
          fetchPage(0),
          fetchPage(50)
        ])
        
        const allMembers = [...page1.members, ...page2.members]
        console.log("Fetched members:", allMembers.slice(0, 3)) // Debug first 3 members
        
        // Filter to only current members (those with recent terms)
        const currentYear = new Date().getFullYear()
        const currentMembers = allMembers.filter((member: Member) => {
          if (!member.terms?.item || member.terms.item.length === 0) return false
          const latestTerm = member.terms.item[member.terms.item.length - 1]
          // Consider current if term started in last 2 years and no end year or end year is current/future
          return latestTerm.startYear >= currentYear - 2 && (!latestTerm.endYear || latestTerm.endYear >= currentYear)
        })
        
        setMembers(currentMembers)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchMembers()
  }, [])

  if (loading) return <div className="p-8 text-center">Loading legislators...</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>

  const filteredLegislators = members.filter((member) => {
    const matchesSearch =
      member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.state?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const currentParty = member.partyName?.toLowerCase() || ""
    const matchesParty = selectedParty === "all" || 
      (selectedParty === "democrat" && (currentParty.includes("democrat") || currentParty === "d")) ||
      (selectedParty === "republican" && (currentParty.includes("republican") || currentParty === "r")) ||
      (selectedParty === "independent" && (currentParty.includes("independent") || currentParty === "i"))
    
    const currentTerm = member.terms?.item && member.terms.item.length > 0 
      ? member.terms.item[member.terms.item.length - 1] 
      : null
    const chamber = currentTerm?.chamber?.toLowerCase() || ""
    const matchesChamber = selectedChamber === "all" || 
      (selectedChamber === "house" && chamber.includes("house")) ||
      (selectedChamber === "senate" && chamber.includes("senate"))

    const matchesState = selectedState === "all" || member.state === selectedState

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
                <SelectItem value="Alabama">Alabama</SelectItem>
                <SelectItem value="Alaska">Alaska</SelectItem>
                <SelectItem value="Arizona">Arizona</SelectItem>
                <SelectItem value="Arkansas">Arkansas</SelectItem>
                <SelectItem value="California">California</SelectItem>
                <SelectItem value="Colorado">Colorado</SelectItem>
                <SelectItem value="Connecticut">Connecticut</SelectItem>
                <SelectItem value="Delaware">Delaware</SelectItem>
                <SelectItem value="Florida">Florida</SelectItem>
                <SelectItem value="Georgia">Georgia</SelectItem>
                <SelectItem value="Hawaii">Hawaii</SelectItem>
                <SelectItem value="Idaho">Idaho</SelectItem>
                <SelectItem value="Illinois">Illinois</SelectItem>
                <SelectItem value="Indiana">Indiana</SelectItem>
                <SelectItem value="Iowa">Iowa</SelectItem>
                <SelectItem value="Kansas">Kansas</SelectItem>
                <SelectItem value="Kentucky">Kentucky</SelectItem>
                <SelectItem value="Louisiana">Louisiana</SelectItem>
                <SelectItem value="Maine">Maine</SelectItem>
                <SelectItem value="Maryland">Maryland</SelectItem>
                <SelectItem value="Massachusetts">Massachusetts</SelectItem>
                <SelectItem value="Michigan">Michigan</SelectItem>
                <SelectItem value="Minnesota">Minnesota</SelectItem>
                <SelectItem value="Mississippi">Mississippi</SelectItem>
                <SelectItem value="Missouri">Missouri</SelectItem>
                <SelectItem value="Montana">Montana</SelectItem>
                <SelectItem value="Nebraska">Nebraska</SelectItem>
                <SelectItem value="Nevada">Nevada</SelectItem>
                <SelectItem value="New Hampshire">New Hampshire</SelectItem>
                <SelectItem value="New Jersey">New Jersey</SelectItem>
                <SelectItem value="New Mexico">New Mexico</SelectItem>
                <SelectItem value="New York">New York</SelectItem>
                <SelectItem value="North Carolina">North Carolina</SelectItem>
                <SelectItem value="North Dakota">North Dakota</SelectItem>
                <SelectItem value="Ohio">Ohio</SelectItem>
                <SelectItem value="Oklahoma">Oklahoma</SelectItem>
                <SelectItem value="Oregon">Oregon</SelectItem>
                <SelectItem value="Pennsylvania">Pennsylvania</SelectItem>
                <SelectItem value="Rhode Island">Rhode Island</SelectItem>
                <SelectItem value="South Carolina">South Carolina</SelectItem>
                <SelectItem value="South Dakota">South Dakota</SelectItem>
                <SelectItem value="Tennessee">Tennessee</SelectItem>
                <SelectItem value="Texas">Texas</SelectItem>
                <SelectItem value="Utah">Utah</SelectItem>
                <SelectItem value="Vermont">Vermont</SelectItem>
                <SelectItem value="Virginia">Virginia</SelectItem>
                <SelectItem value="Washington">Washington</SelectItem>
                <SelectItem value="West Virginia">West Virginia</SelectItem>
                <SelectItem value="Wisconsin">Wisconsin</SelectItem>
                <SelectItem value="Wyoming">Wyoming</SelectItem>
              </SelectContent>
            </Select>

            <Button className="w-full">Apply Filters</Button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-muted-foreground">
            Showing {filteredLegislators.length} of {members.length} legislators
          </p>
        </div>

        {/* Legislator Cards */}
        <div className="grid gap-6">
          {filteredLegislators.map((member) => {
            const rawPartyName = member.partyName || "Unknown"
            // Convert party names to full party names
            const getFullPartyName = (party: string) => {
              const partyLower = party.toLowerCase()
              if (partyLower.includes("democrat") || partyLower === "d") return "Democratic Party"
              if (partyLower.includes("republican") || partyLower === "r") return "Republican Party"
              if (partyLower.includes("independent") || partyLower === "i") return "Independent"
              return party
            }
            
            const currentParty = getFullPartyName(rawPartyName)
            const currentTerm = member.terms?.item && member.terms.item.length > 0 
              ? member.terms.item[member.terms.item.length - 1] 
              : null
            const chamber = currentTerm?.chamber || "Unknown"
            
            // Get party colors and styles
            const getPartyStyle = (party: string) => {
              if (party === "Democratic Party") {
                return {
                  badgeClass: "bg-blue-600 text-white hover:bg-blue-700 text-shadow-blue font-medium"
                }
              } else if (party === "Republican Party") {
                return {
                  badgeClass: "bg-red-600 text-white hover:bg-red-700 text-shadow-red font-medium"
                }
              } else {
                return {
                  badgeClass: "bg-gray-600 text-white hover:bg-gray-700 text-shadow-gray font-medium"
                }
              }
            }
            
            const partyStyle = getPartyStyle(currentParty)
            
            return (
              <Card key={member.bioguideId} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage 
                          src={member.depiction?.imageUrl || "/placeholder.svg"} 
                          alt={member.name} 
                        />
                        <AvatarFallback>
                          {member.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-xl">{member.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Badge className={partyStyle.badgeClass}>
                            {currentParty}
                          </Badge>
                          <span className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1" />
                            {member.state}{member.district ? `-${member.district}` : ""} • {chamber}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                    {member.officialWebsiteUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={member.officialWebsiteUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Profile
                        </a>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        N/A
                      </div>
                      <div className="text-sm text-muted-foreground">Campaign Finance</div>
                      <div className="text-xs text-muted-foreground mt-1">Data not available</div>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        {member.sponsoredLegislation?.count || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Bills Sponsored</div>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        {member.cosponsoredLegislation?.count || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Bills Cosponsored</div>
                    </div>

                    <div className="text-center">
                      <div className="text-sm font-medium text-foreground mb-2">Info</div>
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-xs">
                          Born: {member.birthYear || 'N/A'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Term: {currentTerm?.startYear || 'N/A'}{currentTerm?.endYear ? `-${currentTerm.endYear}` : '-Present'}
                        </Badge>
                        {member.district && (
                          <Badge variant="outline" className="text-xs">
                            District {member.district}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
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
