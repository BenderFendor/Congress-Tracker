"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, MapPin, Users, DollarSign, Loader2, ArrowRight, Building2, Landmark } from "lucide-react"
import { getAllLegislators, Legislator } from "@/lib/services/legislators"

export default function LegislatorsPage() {
  const [members, setMembers] = useState<Legislator[]>([])
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
        const response = await getAllLegislators()
        setMembers(response)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error")
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

  const loadMore = async () => {
    if (loadingMore) return

    setLoadingMore(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    setDisplayCount(prev => prev + 12)
    setLoadingMore(false)
  }

  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore) return

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight

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
        <h3 className="font-serif text-2xl font-bold text-primary mb-4">Data Unavailable</h3>
        <p className="font-sans text-sm text-muted-foreground mb-4">
          Congress.gov API key may be invalid or expired.
        </p>
        <p className="font-mono text-xs text-muted-foreground bg-muted p-3 mb-4 text-left">
          <strong>Fix:</strong> Get a free key at{' '}
          <a href="https://api.congress.gov/sign-up" target="_blank" rel="noopener noreferrer" className="text-accent underline">
            api.congress.gov/sign-up
          </a>
          {' '}and set <code className="bg-background px-1">CONGRESS_GOV_API_KEY</code> in{' '}
          <code className="bg-background px-1">.env</code>. Then restart the backend.
        </p>
        <div className="text-[10px] font-mono text-muted-foreground bg-muted p-3 rounded text-left overflow-hidden text-ellipsis">
          {error}
        </div>
      </div>
    </div>
  )

  const states = Array.from(new Set(members.map(m => m.state))).filter(Boolean).sort()

  const filteredLegislators = members.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.state.toLowerCase().includes(searchTerm.toLowerCase())

    const currentParty = member.party.toLowerCase()
    const matchesParty = selectedParty === "all" ||
      (selectedParty === "democrat" && currentParty.includes("democrat")) ||
      (selectedParty === "republican" && currentParty.includes("republican")) ||
      (selectedParty === "independent" && (currentParty.includes("independent") || currentParty.includes("other")))

    const chamber = member.chamber.toLowerCase()
    const matchesChamber = selectedChamber === "all" ||
      (selectedChamber === "house" && chamber === "house") ||
      (selectedChamber === "senate" && chamber === "senate")

    const matchesState = selectedState === "all" || member.state.toLowerCase() === selectedState.toLowerCase()

    return matchesSearch && matchesParty && matchesChamber && matchesState
  })

  const currentLegislators = filteredLegislators.slice(0, displayCount)
  const hasMore = displayCount < filteredLegislators.length

  const withTradesCount = filteredLegislators.filter((member) => member.trade_summary?.matched).length

  const formatCurrencyCompact = (value: number) => {
    if (value <= 0) return "No filings"
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value}`
  }

  const formatParty = (party: string) => {
    if (party.toLowerCase().includes("democrat")) return "Democrat"
    if (party.toLowerCase().includes("republican")) return "Republican"
    if (party.toLowerCase().includes("independent")) return "Independent"
    return party
  }

  const getPartyColor = (party: string) => {
    const normalized = party.toLowerCase()
    if (normalized.includes("democrat")) return "text-blue-300 bg-blue-500/10 border-blue-500/30"
    if (normalized.includes("republican")) return "text-red-300 bg-red-500/10 border-red-500/30"
    return "text-stone-300 bg-stone-500/10 border-stone-500/30"
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent text-accent-foreground selection:text-foreground pb-20">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">
        <div className="mb-10 max-w-3xl">
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4">
            Congressional Directory
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
            All current members of Congress, with CapitolTrades activity layered in when a verified match exists.
          </p>
        </div>

        <div className="mb-12 animate-stagger-item delay-1">
          <div className="flex flex-col lg:flex-row gap-6 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-accent" size={20} />
              <input
                type="text"
                placeholder="Search by name or state"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-card border-2 border-border px-12 py-4 text-foreground font-mono font-bold placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <select
              value={selectedParty}
              onChange={(e) => setSelectedParty(e.target.value)}
              className="bg-card border-2 border-border px-4 py-3 text-foreground font-mono text-sm focus:border-accent outline-none appearance-none"
            >
              <option value="all">All Parties</option>
              <option value="democrat">Democrat</option>
              <option value="republican">Republican</option>
              <option value="independent">Independent</option>
            </select>

            <select
              value={selectedChamber}
              onChange={(e) => setSelectedChamber(e.target.value)}
              className="bg-card border-2 border-border px-4 py-3 text-foreground font-mono text-sm focus:border-accent outline-none appearance-none"
            >
              <option value="all">Both Chambers</option>
              <option value="house">House</option>
              <option value="senate">Senate</option>
            </select>

            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-card border-2 border-border px-4 py-3 text-foreground font-mono text-sm focus:border-accent outline-none appearance-none"
            >
              <option value="all">All States</option>
              {states.map(state => (
                <option key={state} value={state}>{state.toUpperCase()}</option>
              ))}
            </select>

            <div className="bg-card border-2 border-border px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Matched trade data</span>
              <span className="font-mono font-bold text-foreground">{withTradesCount}</span>
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-2 text-muted-foreground font-sans text-xs tracking-wide">
          <div className="w-2 h-2 bg-accent text-accent-foreground rounded-full animate-pulse"></div>
          Showing {currentLegislators.length} of {filteredLegislators.length} legislators
          {filteredLegislators.length !== members.length && (
            <span className="ml-1">({members.length} total)</span>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {currentLegislators.map((member, idx) => {
            const chamber = member.chamber === "House" ? "House" : member.chamber === "Senate" ? "Senate" : member.chamber
            const partyColorClass = getPartyColor(member.party)
            const tradeSummary = member.trade_summary
            const tradeStats = tradeSummary?.stats

            return (
              <div key={member.id} className={`relative overflow-hidden bg-card border border-border p-5 md:p-6 hover:border-accent/60 hover:shadow-xl hover:shadow-accent/5 transition-all duration-500 group animate-stagger-item hover:-translate-y-1 delay-${(idx % 5) + 1}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-accent/0 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors duration-500 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-start gap-5">
                  <div className="relative shrink-0 mx-auto md:mx-0">
                    <div className="w-24 h-24 bg-background border-2 border-border overflow-hidden grayscale-[0.8] contrast-125 group-hover:grayscale-0 group-hover:border-accent/50 transition-all duration-500 rounded-full shadow-md">
                      <img 
                        src={member.avatar} 
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-muted');
                        }}
                      />
                        <div className="hidden w-full h-full items-center justify-center bg-muted text-muted-foreground">
                          <Users size={24} />
                        </div>
                      </div>
                    <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 border ${partyColorClass} font-mono text-[10px] font-bold uppercase tracking-wider backdrop-blur-md rounded-full shadow-sm whitespace-nowrap`}>
                      {formatParty(member.party)}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 w-full mt-4 md:mt-0">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-5">
                      <div className="text-center md:text-left w-full sm:w-auto">
                        <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground leading-tight group-hover:text-accent transition-colors">
                          {member.name}
                        </h2>
                        <div className="mt-2.5 flex flex-wrap justify-center md:justify-start items-center gap-3 text-muted-foreground font-sans text-xs uppercase tracking-wide">
                          <span className="inline-flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-sm"><MapPin size={12} className="text-accent" /> {member.state}{member.district ? `-${member.district}` : ""}</span>
                          <span className="inline-flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-sm"><Landmark size={12} className="text-primary" /> {chamber}</span>
                          <span className="inline-flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-sm"><Building2 size={12} className="text-primary" /> {member.in_office ? "Active" : "Former"}</span>
                        </div>
                      </div>

                      <Link href={`/legislators/${member.id}`} className="w-12 h-12 mx-auto sm:mx-0 flex items-center justify-center bg-background border-2 border-border text-foreground group-hover:bg-accent group-hover:text-accent-foreground group-hover:border-accent transition-all duration-300 rounded-full shrink-0 shadow-sm hover:scale-110">
                        <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3.5 bg-background/50 border border-border/50 group-hover:border-border transition-colors rounded-sm hover:bg-background">
                        <div className="flex items-center justify-center md:justify-start gap-2 text-accent mb-1.5">
                          <DollarSign size={14} />
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Volume</span>
                        </div>
                        <div className="font-mono text-center md:text-left text-sm md:text-base font-bold text-foreground">
                          {formatCurrencyCompact(tradeStats?.volume || 0)}
                        </div>
                      </div>

                      <div className="p-3.5 bg-background/50 border border-border/50 group-hover:border-border transition-colors rounded-sm hover:bg-background">
                        <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground group-hover:text-primary transition-colors mb-1.5">
                          <Users size={14} />
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Trades</span>
                        </div>
                        <div className="font-mono text-center md:text-left text-sm md:text-base font-bold text-foreground">{tradeStats?.count_trades || 0}</div>
                      </div>

                      <div className="p-3.5 bg-background/50 border border-border/50 group-hover:border-border transition-colors rounded-sm hover:bg-background">
                        <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground group-hover:text-primary transition-colors mb-1.5">
                          <Building2 size={14} />
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Issuers</span>
                        </div>
                        <div className="font-mono text-center md:text-left text-sm md:text-base font-bold text-foreground">{tradeStats?.count_issuers || 0}</div>
                      </div>

                      <div className="p-3.5 bg-background/50 border border-border/50 group-hover:border-border transition-colors rounded-sm hover:bg-background">
                        <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground group-hover:text-primary transition-colors mb-1.5">
                          <Landmark size={14} />
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Match</span>
                        </div>
                        <div className="font-mono text-[11px] text-center md:text-left md:text-xs font-bold uppercase text-foreground">
                          {tradeSummary?.matched ? tradeSummary.match_confidence.replaceAll("_", " ") : "No trade data"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {loadingMore && (
          <div className="mt-12 flex justify-center">
            <div className="flex items-center gap-3 text-accent font-sans text-xs text-muted-foreground tracking-wide animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading more members...</span>
            </div>
          </div>
        )}

        {!loadingMore && hasMore && (
          <div className="mt-12 flex justify-center mb-20">
            <button
              onClick={loadMore}
              className="px-8 py-4 bg-muted border-2 border-border hover:bg-accent hover:text-accent-foreground hover:text-black hover:border-accent transition-all font-sans text-sm font-semibold tracking-wide"
            >
              Load More Members
            </button>
          </div>
        )}

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
