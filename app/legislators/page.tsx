"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Filter, MapPin, Users, DollarSign, FileText, ExternalLink, Loader2, ArrowRight, Grid } from "lucide-react"

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
  const [displayCount, setDisplayCount] = useState(12) // Initially show 12 legislators
  const [loadingMore, setLoadingMore] = useState(false)

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

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(12)
  }, [searchTerm, selectedParty, selectedChamber, selectedState])

  // Load more function
  const loadMore = async () => {
    if (loadingMore) return

    setLoadingMore(true)
    // Simulate loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500))
    setDisplayCount(prev => prev + 12)
    setLoadingMore(false)
  }

  // Infinite scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore) return

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight

      // Load more when user is within 200px of bottom
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        loadMore()
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadingMore])

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#ff4d00] border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-red-500 font-mono text-center">{error}</div>
    </div>
  )

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

  // Infinite scroll calculations
  const currentLegislators = filteredLegislators.slice(0, displayCount)
  const hasMore = displayCount < filteredLegislators.length

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#ff4d00] selection:text-white pb-20">


      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">
        {/* Search and Filters */}
        <div className="mb-12 animate-stagger-item delay-1">
          <div className="flex flex-col lg:flex-row gap-6 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#ff4d00]" size={20} />
              <input
                type="text"
                placeholder="SEARCH BY NAME, STATE, OR DISTRICT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#171717] border-2 border-white/10 px-12 py-4 text-white font-mono font-bold placeholder:text-gray-600 focus:outline-none focus:border-[#ff4d00] transition-all uppercase tracking-wider"
              />
            </div>
            <button className="flex items-center justify-center gap-2 bg-white/5 border-2 border-white/10 px-8 py-4 font-mono font-bold uppercase hover:bg-white/10 hover:border-[#ff4d00] transition-all text-[#ff4d00]">
              <Filter size={16} />
              Advanced Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <select
              value={selectedParty}
              onChange={(e) => setSelectedParty(e.target.value)}
              className="bg-[#171717] border-2 border-white/10 px-4 py-3 text-white font-mono text-sm uppercase focus:border-[#ff4d00] outline-none appearance-none"
            >
              <option value="all">All Parties</option>
              <option value="democrat">Democrat</option>
              <option value="republican">Republican</option>
              <option value="independent">Independent</option>
            </select>

            <select
              value={selectedChamber}
              onChange={(e) => setSelectedChamber(e.target.value)}
              className="bg-[#171717] border-2 border-white/10 px-4 py-3 text-white font-mono text-sm uppercase focus:border-[#ff4d00] outline-none appearance-none"
            >
              <option value="all">Both Chambers</option>
              <option value="house">House</option>
              <option value="senate">Senate</option>
            </select>

            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-[#171717] border-2 border-white/10 px-4 py-3 text-white font-mono text-sm uppercase focus:border-[#ff4d00] outline-none appearance-none"
            >
              <option value="all">All States</option>
              <option value="Alabama">Alabama</option>
              <option value="Alaska">Alaska</option>
              <option value="Arizona">Arizona</option>
              <option value="Arkansas">Arkansas</option>
              <option value="California">California</option>
              <option value="Colorado">Colorado</option>
              <option value="Connecticut">Connecticut</option>
              <option value="Delaware">Delaware</option>
              <option value="Florida">Florida</option>
              <option value="Georgia">Georgia</option>
              <option value="Hawaii">Hawaii</option>
              <option value="Idaho">Idaho</option>
              <option value="Illinois">Illinois</option>
              <option value="Indiana">Indiana</option>
              <option value="Iowa">Iowa</option>
              <option value="Kansas">Kansas</option>
              <option value="Kentucky">Kentucky</option>
              <option value="Louisiana">Louisiana</option>
              <option value="Maine">Maine</option>
              <option value="Maryland">Maryland</option>
              <option value="Massachusetts">Massachusetts</option>
              <option value="Michigan">Michigan</option>
              <option value="Minnesota">Minnesota</option>
              <option value="Mississippi">Mississippi</option>
              <option value="Missouri">Missouri</option>
              <option value="Montana">Montana</option>
              <option value="Nebraska">Nebraska</option>
              <option value="Nevada">Nevada</option>
              <option value="New Hampshire">New Hampshire</option>
              <option value="New Jersey">New Jersey</option>
              <option value="New Mexico">New Mexico</option>
              <option value="New York">New York</option>
              <option value="North Carolina">North Carolina</option>
              <option value="North Dakota">North Dakota</option>
              <option value="Ohio">Ohio</option>
              <option value="Oklahoma">Oklahoma</option>
              <option value="Oregon">Oregon</option>
              <option value="Pennsylvania">Pennsylvania</option>
              <option value="Rhode Island">Rhode Island</option>
              <option value="South Carolina">South Carolina</option>
              <option value="South Dakota">South Dakota</option>
              <option value="Tennessee">Tennessee</option>
              <option value="Texas">Texas</option>
              <option value="Utah">Utah</option>
              <option value="Vermont">Vermont</option>
              <option value="Virginia">Virginia</option>
              <option value="Washington">Washington</option>
              <option value="West Virginia">West Virginia</option>
              <option value="Wisconsin">Wisconsin</option>
              <option value="Wyoming">Wyoming</option>
            </select>

            <button className="bg-[#ff4d00] text-black font-mono font-bold uppercase hover:bg-white hover:text-black transition-all px-4 py-3">
              Apply Filters
            </button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6 flex items-center gap-2 text-gray-500 font-mono text-xs uppercase tracking-widest">
          <div className="w-2 h-2 bg-[#ff4d00] rounded-full animate-pulse"></div>
          Showing {currentLegislators.length} of {filteredLegislators.length} legislators
          {filteredLegislators.length !== members.length && (
            <span className="ml-1">({members.length} total)</span>
          )}
        </div>

        {/* Legislator Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {currentLegislators.map((member, idx) => {
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

            // Get party colors
            const getPartyColor = (party: string) => {
              if (party === "Democratic Party") return "text-blue-400 bg-blue-900/20 border-blue-500/30"
              if (party === "Republican Party") return "text-red-400 bg-red-900/20 border-red-500/30"
              return "text-gray-400 bg-gray-900/20 border-gray-500/30"
            }

            const partyColorClass = getPartyColor(currentParty)

            return (
              <div key={member.bioguideId} className={`bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-all duration-300 group animate-stagger-item delay-${(idx % 5) + 1} flex flex-col h-full`}>
                <div className="flex items-start justify-between mb-6">
                  <div className="relative">
                    <div className="w-20 h-20 bg-black border-2 border-white/10 overflow-hidden grayscale contrast-125 group-hover:grayscale-0 transition-all duration-500">
                      {member.depiction?.imageUrl ? (
                        <img
                          src={member.depiction.imageUrl}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5 text-gray-600">
                          <Users size={24} />
                        </div>
                      )}
                    </div>
                    <div className={`absolute -bottom-3 -right-3 px-2 py-1 border ${partyColorClass} font-mono text-[10px] font-black uppercase tracking-wider backdrop-blur-md`}>
                      {currentParty.split(' ')[0]}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link href={`/legislators/${member.bioguideId}`} className="w-10 h-10 flex items-center justify-center border border-white/20 text-white hover:bg-[#ff4d00] hover:text-black hover:border-[#ff4d00] transition-all">
                      <ArrowRight size={16} />
                    </Link>
                    {member.officialWebsiteUrl && (
                      <a href={member.officialWebsiteUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 flex items-center justify-center border border-white/20 text-gray-500 hover:text-white hover:border-white transition-all">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="mb-6 flex-grow">
                  <h2 className="font-serif text-xl font-bold text-white mb-2 leading-tight group-hover:text-[#ff4d00] transition-colors">
                    {member.name}
                  </h2>
                  <div className="flex items-center gap-2 text-gray-400 font-mono text-xs uppercase">
                    <MapPin size={12} />
                    <span>{member.state}{member.district ? `-${member.district}` : ""}</span>
                    <span className="text-white/20">|</span>
                    <span>{chamber}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <div className="flex items-center gap-2 text-[#ff4d00] mb-1">
                      <FileText size={12} />
                      <span className="font-mono text-[10px] font-bold uppercase">Sponsored</span>
                    </div>
                    <span className="font-mono text-lg font-bold text-white">{member.sponsoredLegislation?.count || 0}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <Users size={12} />
                      <span className="font-mono text-[10px] font-bold uppercase">Cosponsored</span>
                    </div>
                    <span className="font-mono text-lg font-bold text-white">{member.cosponsoredLegislation?.count || 0}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center font-mono text-[10px] text-gray-500 uppercase">
                  <span>Born: {member.birthYear || 'N/A'}</span>
                  <span>Term: {currentTerm?.startYear || 'N/A'}-{currentTerm?.endYear || 'Pres'}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Loading More Indicator */}
        {loadingMore && (
          <div className="mt-12 flex justify-center">
            <div className="flex items-center gap-3 text-[#ff4d00] font-mono text-xs uppercase tracking-widest animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Accessing Database...</span>
            </div>
          </div>
        )}

        {/* Load More Button (fallback for manual loading) */}
        {!loadingMore && hasMore && (
          <div className="mt-12 flex justify-center mb-20">
            <button
              onClick={loadMore}
              className="px-8 py-4 bg-white/5 border-2 border-white/10 hover:bg-[#ff4d00] hover:text-black hover:border-[#ff4d00] transition-all font-mono text-sm font-bold uppercase tracking-widest"
            >
              Load More Legislators
            </button>
          </div>
        )}

        {/* End of Results */}
        {!hasMore && filteredLegislators.length > 12 && (
          <div className="mt-12 mb-20 text-center">
            <div className="inline-block px-4 py-2 border border-white/10 bg-white/5 text-gray-500 font-mono text-xs uppercase tracking-widest">
              End of Directory
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
