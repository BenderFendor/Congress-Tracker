"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Building2, Search, ChevronDown, Check, X, Scale, LoaderCircle, ArrowUpDown } from "lucide-react"
import { ArchivePage, DataState } from "@/components/ui/archive-ui"
import { CompactMasthead } from "@/components/ui/mockup-visuals"
import { getAllLegislators, type Legislator } from "@/lib/services/legislators"
import { LegislatorCard } from "@/components/ui/legislator-card"

export default function LegislatorsPage() {
  // Visual thesis: an editorial public-record directory with portraits as the evidence anchor.
  const [members, setMembers] = useState<Legislator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedParty, setSelectedParty] = useState("all")
  const [selectedChamber, setSelectedChamber] = useState("all")
  const [selectedState, setSelectedState] = useState("all")
  const [matchOnly, setMatchOnly] = useState(false)
  const [sortBy, setSortBy] = useState("name")
  const [displayCount, setDisplayCount] = useState(12)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const loadMoreRef = useRef<HTMLDivElement>(null)

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

  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      if (sortBy === "state") {
        return a.state.localeCompare(b.state) || a.chamber.localeCompare(b.chamber) || String(a.district).localeCompare(String(b.district), undefined, { numeric: true }) || a.name.localeCompare(b.name)
      }
      if (sortBy === "party") return a.party.localeCompare(b.party) || a.name.localeCompare(b.name)
      if (sortBy === "chamber") return a.chamber.localeCompare(b.chamber) || a.name.localeCompare(b.name)
      if (sortBy === "age-asc" || sortBy === "age-desc") {
        const aAge = a.age ?? null
        const bAge = b.age ?? null
        if (aAge == null && bAge == null) return a.name.localeCompare(b.name)
        if (aAge == null) return 1
        if (bAge == null) return -1
        return (sortBy === "age-asc" ? aAge - bAge : bAge - aAge) || a.name.localeCompare(b.name)
      }
      return a.name.localeCompare(b.name)
    })
  }, [filteredMembers, sortBy])
  const visibleMembers = sortedMembers.slice(0, displayCount)
  const senateCount = members.filter((member) => member.chamber.toLowerCase() === "senate").length
  const houseCount = members.filter((member) => member.chamber.toLowerCase() === "house").length
  const matchedTradeCount = members.filter((member) => member.trade_summary?.matched).length
  const ageSummary = useMemo(() => {
    const ages = members.map((member) => member.age).filter((age): age is number => age != null && Number.isFinite(age)).sort((a, b) => a - b)
    if (ages.length === 0) return { average: null, median: null, measured: 0 }
    const middle = Math.floor(ages.length / 2)
    const median = ages.length % 2 === 0 ? (ages[middle - 1] + ages[middle]) / 2 : ages[middle]
    return {
      average: ages.reduce((sum, age) => sum + age, 0) / ages.length,
      median,
      measured: ages.length,
    }
  }, [members])
  const comparisonMembers = compareIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is Legislator => Boolean(member))

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel || displayCount >= filteredMembers.length) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setDisplayCount((count) => Math.min(count + 12, filteredMembers.length))
      },
      { rootMargin: "500px 0px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [displayCount, filteredMembers.length])

  function toggleComparison(memberId: string) {
    setCompareIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : current.length < 4
          ? [...current, memberId]
          : current,
    )
  }

  return (
    <ArchivePage>
      <CompactMasthead
        eyebrow="Canonical congressional directory"
        title="Legislator"
        accent="index."
        description="Filter current members by chamber, party, state, and verified disclosure matches. Missing source rows remain visible as coverage gaps."
      />

      {/* Filter Section */}
      <section className="sticky top-[4.5rem] z-30 border-y border-border bg-background/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto max-w-[106rem]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                aria-label="Search legislators"
                placeholder="Search legislators..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setDisplayCount(12) }}
                className="h-10 w-full rounded-full border border-border bg-muted/30 pl-10 pr-4 text-sm focus:border-accent focus:bg-card focus:outline-none transition-all"
              />
            </div>

            {/* Pill Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="group relative">
                <select
                  aria-label="Filter by party"
                  value={selectedParty}
                  onChange={(e) => { setSelectedParty(e.target.value); setDisplayCount(12) }}
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
                <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <select
                  aria-label="Sort legislators"
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setDisplayCount(12) }}
                  className="h-9 cursor-pointer appearance-none rounded-full border border-border bg-card pl-8 pr-9 text-xs font-semibold text-foreground transition-all hover:border-accent focus:outline-none"
                >
                  <option value="name">Name A–Z</option>
                  <option value="state">State and district</option>
                  <option value="party">Party</option>
                  <option value="chamber">Chamber</option>
                  <option value="age-asc">Age · youngest first</option>
                  <option value="age-desc">Age · oldest first</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              </div>

              <div className="group relative">
                <select
                  aria-label="Filter by chamber"
                  value={selectedChamber}
                  onChange={(e) => { setSelectedChamber(e.target.value); setDisplayCount(12) }}
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
                  aria-label="Filter by state"
                  value={selectedState}
                  onChange={(e) => { setSelectedState(e.target.value); setDisplayCount(12) }}
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
                onClick={() => { setMatchOnly(!matchOnly); setDisplayCount(12) }}
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
          <div>
            <section className="member-directory-summary" aria-label="Directory summary">
              <div className="member-summary-label"><Building2 size={14} /><span>Directory summary</span></div>
              <div><strong>{members.length || "0"}</strong><span>Members</span></div>
              <div><strong>{houseCount}</strong><span>House</span></div>
              <div><strong>{senateCount}</strong><span>Senate</span></div>
              <div><strong>{ageSummary.average == null ? "—" : ageSummary.average.toFixed(1)}</strong><span>Average age</span></div>
              <div><strong>{ageSummary.median == null ? "—" : ageSummary.median.toFixed(1)}</strong><span>Median age</span></div>
              <div><strong className="text-accent">{matchedTradeCount}</strong><span>Matched trades</span></div>
              <p>Age measured for {ageSummary.measured} members · sorting applies to the full directory before cards are progressively displayed.</p>
            </section>

            <div>
              {loading ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-64 animate-pulse rounded-xl bg-muted/40" />
                  ))}
                </div>
              ) : error ? (
                <DataState
                  kind="error"
                  title="Legislator directory unavailable"
                  description={`${error}. No empty directory is shown because an API failure is not a zero-member result.`}
                />
              ) : (
                <>
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      Showing {visibleMembers.length} of {filteredMembers.length} legislators
                    </div>
                  </div>

                  {comparisonMembers.length > 0 ? (
                    <section className="member-compare-tray" aria-label="Member comparison">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="archive-panel-kicker flex items-center gap-2"><Scale size={14} /> Comparison desk · {comparisonMembers.length} of 4</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {comparisonMembers.map((member) => (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => toggleComparison(member.id)}
                                className="member-compare-chip"
                                aria-label={`Remove ${member.name} from comparison`}
                              >
                                {member.name} <X size={12} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <button type="button" className="member-compare-clear" onClick={() => setCompareIds([])}>
                          Clear comparison
                        </button>
                      </div>
                      {comparisonMembers.length >= 2 ? (
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full min-w-[36rem] text-left text-sm">
                            <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-2">Member</th><th>Party</th><th>State</th><th>Chamber</th><th>Disclosure match</th></tr></thead>
                            <tbody>{comparisonMembers.map((member) => (
                              <tr key={member.id} className="border-b border-border/70"><th className="py-3 font-semibold">{member.name}</th><td>{member.party}</td><td>{member.state}</td><td>{member.chamber}</td><td>{member.trade_summary?.matched ? "Matched" : "Not linked"}</td></tr>
                            ))}</tbody>
                          </table>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  <div className="member-directory-grid">
                    {visibleMembers.map((member) => (
                      <div key={member.id} className="relative">
                        <label className={`member-compare-toggle ${compareIds.includes(member.id) ? "selected" : ""}`}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--accent)]"
                            checked={compareIds.includes(member.id)}
                            onChange={() => toggleComparison(member.id)}
                            disabled={!compareIds.includes(member.id) && compareIds.length >= 4}
                          />
                          {compareIds.includes(member.id) ? <Check size={13} /> : <Scale size={13} />}
                          {compareIds.includes(member.id) ? "Added" : "Compare"}
                        </label>
                        <LegislatorCard member={member} />
                      </div>
                    ))}
                  </div>

                  <div ref={loadMoreRef} className="member-load-sentinel" aria-live="polite">
                    {displayCount < filteredMembers.length ? <><LoaderCircle className="animate-spin" size={15} /> Loading more members</> : `All ${filteredMembers.length} matching members loaded`}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </ArchivePage>
  )
}
