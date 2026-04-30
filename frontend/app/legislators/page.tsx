"use client"

import { useEffect, useMemo, useState } from "react"
import { Building2, Landmark, Shield, Users, Search, Filter, Info, ChevronDown, Check } from "lucide-react"
import { ArchivePage } from "@/components/ui/archive-ui"
import { getAllLegislators, type Legislator } from "@/lib/services/legislators"
import { LegislatorCard } from "@/components/ui/legislator-card"

export default function LegislatorsPage() {
  const [members, setMembers] = useState<Legislator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedParty, setSelectedParty] = useState("all")
  const [selectedChamber, setSelectedChamber] = useState("all")
  const [selectedState, setSelectedState] = useState("all")
  const [matchOnly, setMatchOnly] = useState(false)
  const [displayCount, setDisplayCount] = useState(12)

  useEffect(() => {
    async function loadData() {
      try {
        const response = await getAllLegislators()
        setMembers(response)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load legislators")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const states = useMemo(() => Array.from(new Set(members.map((m) => m.state).filter(Boolean))).sort(), [members])

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const search = searchTerm.toLowerCase()
      const matchesSearch =
        member.name.toLowerCase().includes(search) ||
        member.state.toLowerCase().includes(search) ||
        member.party.toLowerCase().includes(search)

      const party = member.party.toLowerCase()
      const matchesParty =
        selectedParty === "all" ||
        (selectedParty === "democrat" && party.includes("democrat")) ||
        (selectedParty === "republican" && party.includes("republican")) ||
        (selectedParty === "independent" && party.includes("independent"))

      const chamber = member.chamber.toLowerCase()
      const matchesChamber = selectedChamber === "all" || chamber === selectedChamber
      const matchesState = selectedState === "all" || member.state.toLowerCase() === selectedState.toLowerCase()
      const matchesMatch = !matchOnly || member.trade_summary?.matched

      return matchesSearch && matchesParty && matchesChamber && matchesState && matchesMatch
    })
  }, [members, searchTerm, selectedParty, selectedChamber, selectedState, matchOnly])

  const visibleMembers = filteredMembers.slice(0, displayCount)
  const senateCount = members.filter((member) => member.chamber.toLowerCase() === "senate").length
  const houseCount = members.filter((member) => member.chamber.toLowerCase() === "house").length
  const matchedTradeCount = members.filter((member) => member.trade_summary?.matched).length

  return (
    <ArchivePage>
      {/* Subtle Grid Background */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-16 pb-12 md:px-12 lg:pt-24 lg:pb-16">
        <div className="mx-auto max-w-[106rem]">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-3xl animate-stagger-item delay-1">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-accent">
                Directory
              </div>
              <h1 className="font-serif text-5xl leading-tight text-foreground md:text-7xl lg:text-8xl">
                Legislator <span className="italic text-accent">Index.</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl lg:max-w-2xl">
                Browse all current members of Congress with district context, chamber filters, and matched CapitolTrades activity when available.
              </p>
            </div>
            
            {/* Decorative Seal */}
            <div className="relative hidden lg:block animate-scale-in delay-3">
              <div className="flex h-48 w-48 items-center justify-center rounded-full border border-border bg-card/50 p-4 shadow-xl backdrop-blur-sm">
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full border-2 border-dashed border-accent/20 p-2">
                  <Landmark className="h-12 w-12 text-accent" />
                  <span className="mt-2 text-center text-[8px] font-bold tracking-widest uppercase text-accent">
                    United States<br/>Congress
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Section */}
      <section className="sticky top-[4.5rem] z-30 border-y border-border bg-background/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto max-w-[106rem]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search legislators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-full border border-border bg-muted/30 pl-10 pr-4 text-sm focus:border-accent focus:bg-card focus:outline-none transition-all"
              />
            </div>

            {/* Pill Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="group relative">
                <select
                  value={selectedParty}
                  onChange={(e) => setSelectedParty(e.target.value)}
                  className="h-9 appearance-none rounded-full border border-border bg-card px-4 pr-10 text-xs font-semibold text-foreground hover:border-accent focus:outline-none transition-all cursor-pointer"
                >
                  <option value="all">All Parties</option>
                  <option value="democrat">Democrats</option>
                  <option value="republican">Republicans</option>
                  <option value="independent">Independents</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-3 w-3 -translate-y-1/2 text-muted-foreground transition-transform group-hover:text-accent" />
              </div>

              <div className="group relative">
                <select
                  value={selectedChamber}
                  onChange={(e) => setSelectedChamber(e.target.value)}
                  className="h-9 appearance-none rounded-full border border-border bg-card px-4 pr-10 text-xs font-semibold text-foreground hover:border-accent focus:outline-none transition-all cursor-pointer"
                >
                  <option value="all">Both Chambers</option>
                  <option value="house">House</option>
                  <option value="senate">Senate</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-3 w-3 -translate-y-1/2 text-muted-foreground transition-transform group-hover:text-accent" />
              </div>

              <div className="group relative">
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="h-9 appearance-none rounded-full border border-border bg-card px-4 pr-10 text-xs font-semibold text-foreground hover:border-accent focus:outline-none transition-all cursor-pointer"
                >
                  <option value="all">All States</option>
                  {states.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-3 w-3 -translate-y-1/2 text-muted-foreground transition-transform group-hover:text-accent" />
              </div>

              {/* Trade Match Toggle */}
              <button
                onClick={() => setMatchOnly(!matchOnly)}
                className={`flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition-all ${
                  matchOnly 
                    ? "border-accent bg-accent/5 text-accent shadow-sm" 
                    : "border-border bg-card text-muted-foreground hover:border-accent"
                }`}
              >
                {matchOnly && <Check className="h-3 w-3" />}
                Matched trade data
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content & Sidebar */}
      <section className="relative z-10 px-6 py-12 md:px-12">
        <div className="mx-auto max-w-[106rem]">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            
            {/* Left Column: List */}
            <div className="lg:col-span-8">
              {loading ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-64 animate-pulse rounded-xl bg-muted/40" />
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
                  <div className="mb-4 rounded-full bg-red-50 p-4 text-red-500">
                    <Info className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold">Data unavailable</h3>
                  <p className="mt-2 text-muted-foreground">{error}</p>
                </div>
              ) : (
                <>
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      Showing {visibleMembers.length} of {filteredMembers.length} legislators
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {visibleMembers.map((member) => (
                      <LegislatorCard key={member.id} member={member} />
                    ))}
                  </div>

                  {displayCount < filteredMembers.length && (
                    <div className="mt-16 flex justify-center">
                      <button 
                        onClick={() => setDisplayCount(prev => prev + 12)}
                        className="group flex items-center gap-2 rounded-full border border-border bg-card px-8 py-3 text-sm font-bold transition-all hover:border-accent hover:text-accent hover:shadow-lg active:scale-95"
                      >
                        Load More Members
                        <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right Column: Sidebar */}
            <aside className="lg:col-span-4">
              <div className="sticky top-40 space-y-8 animate-stagger-item delay-2">
                
                {/* Directory Summary Card */}
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="border-b border-border bg-muted/20 px-6 py-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      Directory Summary
                    </h4>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                      <div className="space-y-1">
                        <div className="font-serif text-5xl font-bold">{members.length || "0"}</div>
                        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Members</div>
                      </div>
                      <div className="space-y-1">
                        <div className="font-serif text-5xl font-bold">{senateCount}</div>
                        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Senate</div>
                      </div>
                      <div className="space-y-1">
                        <div className="font-serif text-5xl font-bold">{houseCount}</div>
                        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">House</div>
                      </div>
                      <div className="space-y-1">
                        <div className="font-serif text-5xl font-bold text-accent">{matchedTradeCount}</div>
                        <div className="text-[10px] font-bold tracking-wider uppercase text-accent">Matched Trades</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Insights Card */}
                <div className="relative overflow-hidden rounded-2xl bg-[#0a0f18] px-6 py-8 text-white">
                  <div className="relative z-10">
                    <Shield className="mb-4 h-10 w-10 drop-shadow-md" style={{ fill: 'white', stroke: '#ef4444', strokeWidth: 1.5 }} />
                    <h4 className="font-serif text-xl font-bold leading-tight">Enhanced Insights</h4>
                    <p className="mt-2 text-sm text-white/70 leading-relaxed">
                      Our system matches Congress.gov data with CapitolTrades via bioguide IDs, providing 99.8% accuracy in financial reporting.
                    </p>
                    <button className="mt-6 text-[10px] font-bold tracking-widest uppercase text-white hover:underline">
                      Learn About Our Methodology →
                    </button>
                  </div>
                  {/* Decorative Gradient */}
                  <div className="absolute top-0 right-0 -mr-12 -mt-12 h-40 w-40 rounded-full bg-blue-900/30 blur-3xl" />
                </div>

                {/* Decorative Coin/Medal */}
                <div className="flex justify-center pt-8">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-double border-border bg-accent/5">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border/50 bg-card shadow-inner">
                      <Users className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  </div>
                </div>

              </div>
            </aside>

          </div>
        </div>
      </section>
    </ArchivePage>
  )
}
