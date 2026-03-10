"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Filter, MapPin, Users, DollarSign, FileText, ExternalLink, Loader2, ArrowRight, Grid } from "lucide-react"
import { fetchPoliticians, Politician } from "@/lib/api"

export default function LegislatorsPage() {
  const [members, setMembers] = useState<Politician[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedParty, setSelectedParty] = useState("all")
  const [selectedChamber, setSelectedChamber] = useState("all")
  const [selectedState, setSelectedState] = useState("all")
  const [displayCount, setDisplayCount] = useState(12)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetchPoliticians()
        setMembers(response.data)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  if (error) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-8">
      <div className="bg-card border border-border p-8 max-w-md text-center shadow-sm">
        <h3 className="font-serif text-2xl font-bold text-primary mb-4">Database Offline</h3>
        <p className="font-sans text-sm text-muted-foreground mb-6">
          The legislator database is currently being integrated and is not accessible.
          Please check back later for live congressional data.
        </p>
        <div className="text-[10px] font-mono text-muted-foreground bg-muted p-3 rounded text-left overflow-hidden text-ellipsis">
          System: {error}
        </div>
      </div>
    </div>
  )

  const states = Array.from(new Set(members.map(m => m._stateId))).filter(Boolean).sort()

  const filteredLegislators = members.filter((member) => {
    const matchesSearch =
      member.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member._stateId?.toLowerCase().includes(searchTerm.toLowerCase())

    const currentParty = member.party?.toLowerCase() || ""
    const matchesParty = selectedParty === "all" ||
      (selectedParty === "democrat" && currentParty === "democrat") ||
      (selectedParty === "republican" && currentParty === "republican") ||
      (selectedParty === "independent" && (currentParty === "other" || currentParty === "independent"))

    const chamber = member.chamber?.toLowerCase() || ""
    const matchesChamber = selectedChamber === "all" ||
      (selectedChamber === "house" && chamber === "house") ||
      (selectedChamber === "senate" && chamber === "senate")

    const matchesState = selectedState === "all" || member._stateId?.toLowerCase() === selectedState.toLowerCase()

    return matchesSearch && matchesParty && matchesChamber && matchesState
  })

  // Infinite scroll calculations
  const currentLegislators = filteredLegislators.slice(0, displayCount)
  const hasMore = displayCount < filteredLegislators.length

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent text-accent-foreground selection:text-foreground pb-20">


      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">
        {/* Search and Filters */}
        <div className="mb-12 animate-stagger-item delay-1">
          <div className="flex flex-col lg:flex-row gap-6 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-accent" size={20} />
              <input
                type="text"
                placeholder="SEARCH BY NAME, STATE, OR DISTRICT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-card border-2 border-border px-12 py-4 text-foreground font-mono font-bold placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-all uppercase tracking-wider"
              />
            </div>
            <button className="flex items-center justify-center gap-2 bg-muted border-2 border-border px-8 py-4 font-mono font-bold uppercase hover:bg-muted/50 hover:border-accent transition-all text-accent">
              <Filter size={16} />
              Advanced Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <select
              value={selectedParty}
              onChange={(e) => setSelectedParty(e.target.value)}
              className="bg-card border-2 border-border px-4 py-3 text-foreground font-mono text-sm uppercase focus:border-accent outline-none appearance-none"
            >
              <option value="all">All Parties</option>
              <option value="democrat">Democrat</option>
              <option value="republican">Republican</option>
              <option value="independent">Independent</option>
            </select>

            <select
              value={selectedChamber}
              onChange={(e) => setSelectedChamber(e.target.value)}
              className="bg-card border-2 border-border px-4 py-3 text-foreground font-mono text-sm uppercase focus:border-accent outline-none appearance-none"
            >
              <option value="all">Both Chambers</option>
              <option value="house">House</option>
              <option value="senate">Senate</option>
            </select>

            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-card border-2 border-border px-4 py-3 text-foreground font-mono text-sm uppercase focus:border-accent outline-none appearance-none"
            >
              <option value="all">All States</option>
              {states.map(state => (
                <option key={state} value={state}>{state.toUpperCase()}</option>
              ))}
            </select>

            <button className="bg-accent text-accent-foreground text-black font-mono font-bold uppercase hover:bg-card hover:text-black transition-all px-4 py-3">
              Apply Filters
            </button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6 flex items-center gap-2 text-muted-foreground font-sans text-xs text-muted-foreground tracking-wide">
          <div className="w-2 h-2 bg-accent text-accent-foreground rounded-full animate-pulse"></div>
          Showing {currentLegislators.length} of {filteredLegislators.length} legislators
          {filteredLegislators.length !== members.length && (
            <span className="ml-1">({members.length} total)</span>
          )}
        </div>

        {/* Legislator Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {currentLegislators.map((member, idx) => {
            const currentParty = member.party === "democrat" ? "Democratic Party" : member.party === "republican" ? "Republican Party" : "Independent"
            const chamber = (member.chamber || "house") === "house" ? "House" : "Senate"
            const avatarUrl = `https://theunitedstates.io/images/congress/225x275/${member._politicianId}.jpg`

            // Get party colors
            const getPartyColor = (party: string) => {
              if (party === "Democratic Party") return "text-blue-400 bg-blue-900/20 border-blue-500/30"
              if (party === "Republican Party") return "text-red-400 bg-red-900/20 border-red-500/30"
              return "text-muted-foreground bg-gray-900/20 border-gray-500/30"
            }

            const partyColorClass = getPartyColor(currentParty)

            return (
              <div key={member._politicianId} className={`bg-card border-2 border-border p-6 hover:border-accent/50 transition-all duration-300 group animate-stagger-item delay-${(idx % 5) + 1} flex flex-col h-full`}>
                <div className="flex items-start justify-between mb-6">
                  <div className="relative">
                    <div className="w-20 h-20 bg-background border-2 border-border overflow-hidden grayscale contrast-125 group-hover:grayscale-0 transition-all duration-500">
                      <img 
                        src={avatarUrl} 
                        alt={member.full_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-muted');
                        }}
                      />
                      <div className="hidden w-full h-full items-center justify-center bg-muted text-muted-foreground">
                        <Users size={24} />
                      </div>
                    </div>
                    <div className={`absolute -bottom-3 -right-3 px-2 py-1 border ${partyColorClass} font-mono text-[10px] font-bold uppercase tracking-wider backdrop-blur-md`}>
                      {currentParty.split(' ')[0]}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link href={`/legislators/${member._politicianId}`} className="w-10 h-10 flex items-center justify-center border border-border text-foreground hover:bg-accent hover:text-accent-foreground hover:text-black hover:border-accent transition-all">
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>

                <div className="mb-6 flex-grow">
                  <h2 className="font-serif text-xl font-bold text-foreground mb-2 leading-tight group-hover:text-accent transition-colors">
                    {member.full_name}
                  </h2>
                  <div className="flex items-center gap-2 text-muted-foreground font-sans text-xs text-muted-foreground">
                    <MapPin size={12} />
                    <span>{member._stateId?.toUpperCase() || "N/A"}</span>
                    <span className="text-foreground/20">|</span>
                    <span>{chamber}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <div className="flex items-center gap-2 text-accent mb-1">
                      <DollarSign size={12} />
                      <span className="font-mono text-[10px] font-bold uppercase">Volume</span>
                    </div>
                    <span className="font-mono text-lg font-bold text-foreground">${((member.stats.volume || 0) / 1000000).toFixed(1)}M</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <FileText size={12} />
                      <span className="font-mono text-[10px] font-bold uppercase">Trades</span>
                    </div>
                    <span className="font-mono text-lg font-bold text-foreground">{member.stats.count_trades || 0}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center font-mono text-[10px] text-muted-foreground uppercase">
                  <span>Issuers: {member.stats.count_issuers || 0}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Loading More Indicator */}
        {loadingMore && (
          <div className="mt-12 flex justify-center">
            <div className="flex items-center gap-3 text-accent font-sans text-xs text-muted-foreground tracking-wide animate-pulse">
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
              className="px-8 py-4 bg-muted border-2 border-border hover:bg-accent hover:text-accent-foreground hover:text-black hover:border-accent transition-all font-sans text-sm font-semibold tracking-wide"
            >
              Load More Legislators
            </button>
          </div>
        )}

        {/* End of Results */}
        {!hasMore && filteredLegislators.length > 12 && (
          <div className="mt-12 mb-20 text-center">
            <div className="inline-block px-4 py-2 border border-border bg-muted text-muted-foreground font-sans text-xs text-muted-foreground tracking-wide">
              End of Directory
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
