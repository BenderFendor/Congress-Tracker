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
      member.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member._stateId?.toLowerCase().includes(searchTerm.toLowerCase())

    const currentParty = member.party?.toLowerCase() || ""
    const matchesParty = selectedParty === "all" ||
      (selectedParty === "democrat" && currentParty === "democrat") ||
      (selectedParty === "republican" && currentParty === "republican") ||
      (selectedParty === "independent" && currentParty === "other")

    const chamber = member.chamber?.toLowerCase() || ""
    const matchesChamber = selectedChamber === "all" ||
      (selectedChamber === "house" && chamber === "house") ||
      (selectedChamber === "senate" && chamber === "senate")

    const matchesState = selectedState === "all" || member._stateId === selectedState

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
              {/* Add state options here if needed, or dynamically generate */}
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
            const currentParty = member.party === "democrat" ? "Democratic Party" : member.party === "republican" ? "Republican Party" : "Independent"
            const chamber = member.chamber === "house" ? "House" : "Senate"

            // Get party colors
            const getPartyColor = (party: string) => {
              if (party === "Democratic Party") return "text-blue-400 bg-blue-900/20 border-blue-500/30"
              if (party === "Republican Party") return "text-red-400 bg-red-900/20 border-red-500/30"
              return "text-gray-400 bg-gray-900/20 border-gray-500/30"
            }

            const partyColorClass = getPartyColor(currentParty)

            return (
              <div key={member._politicianId} className={`bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-all duration-300 group animate-stagger-item delay-${(idx % 5) + 1} flex flex-col h-full`}>
                <div className="flex items-start justify-between mb-6">
                  <div className="relative">
                    <div className="w-20 h-20 bg-black border-2 border-white/10 overflow-hidden grayscale contrast-125 group-hover:grayscale-0 transition-all duration-500">
                      <div className="w-full h-full flex items-center justify-center bg-white/5 text-gray-600">
                        <Users size={24} />
                      </div>
                    </div>
                    <div className={`absolute -bottom-3 -right-3 px-2 py-1 border ${partyColorClass} font-mono text-[10px] font-black uppercase tracking-wider backdrop-blur-md`}>
                      {currentParty.split(' ')[0]}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link href={`/legislators/${member._politicianId}`} className="w-10 h-10 flex items-center justify-center border border-white/20 text-white hover:bg-[#ff4d00] hover:text-black hover:border-[#ff4d00] transition-all">
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>

                <div className="mb-6 flex-grow">
                  <h2 className="font-serif text-xl font-bold text-white mb-2 leading-tight group-hover:text-[#ff4d00] transition-colors">
                    {member.full_name}
                  </h2>
                  <div className="flex items-center gap-2 text-gray-400 font-mono text-xs uppercase">
                    <MapPin size={12} />
                    <span>{member._stateId}</span>
                    <span className="text-white/20">|</span>
                    <span>{chamber}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <div className="flex items-center gap-2 text-[#ff4d00] mb-1">
                      <DollarSign size={12} />
                      <span className="font-mono text-[10px] font-bold uppercase">Volume</span>
                    </div>
                    <span className="font-mono text-lg font-bold text-white">${(member.stats.volume / 1000000).toFixed(1)}M</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-gray-400 mb-1">
                      <FileText size={12} />
                      <span className="font-mono text-[10px] font-bold uppercase">Trades</span>
                    </div>
                    <span className="font-mono text-lg font-bold text-white">{member.stats.count_trades}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center font-mono text-[10px] text-gray-500 uppercase">
                  <span>Issuers: {member.stats.count_issuers}</span>
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
