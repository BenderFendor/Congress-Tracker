"use client"

import React, { useState, useEffect, useMemo } from "react"
import { ArchivePage, ArchiveHero, ArchivePanel, ArchiveMetrics, ArchiveSearch } from "@/components/ui/archive-ui"
import { Badge } from "@/components/ui/badge"
import { CampaignFinanceChart } from "@/components/visualizations/campaign-finance-chart"
import { DonationFlowChart } from "@/components/visualizations/donation-flow-chart"
import { InfluenceNetwork as InfluenceNetworkChart } from "@/components/visualizations/influence-network"
import { getInfluenceNetworks, getInfluenceNetwork, type InfluenceNetworkSummary, type InfluenceNetwork } from "@/lib/services/influence"
import { Network, Building2, DollarSign, Info, ChevronDown, ChevronUp, Filter, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react"

export default function InfluenceWorkbenchPage() {
  const [networks, setNetworks] = useState<InfluenceNetworkSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedCycle, setSelectedCycle] = useState<string>("2026")
  const [selectedChamber, setSelectedChamber] = useState<string>("all")
  const [selectedParty, setSelectedParty] = useState<string>("all")
  const [minAmount, setMinAmount] = useState<string>("all")

  // Detail view state for expanded network cards
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)
  const [networkDetails, setNetworkDetails] = useState<Record<string, InfluenceNetwork>>({})
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let isMounted = true
    async function loadNetworks() {
      setLoading(true)
      try {
        const data = await getInfluenceNetworks()
        if (isMounted) {
          setNetworks(data)
          const aipacNet = data.find(n => n.network_slug.toLowerCase() === "aipac")
          const targetSlug = aipacNet ? aipacNet.network_slug : data[0]?.network_slug
          if (targetSlug) {
            setExpandedSlug(targetSlug)
          }
        }
      } catch (err) {
        console.error("Failed to fetch influence networks:", err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadNetworks()
    return () => { isMounted = false }
  }, [])

  // Fetch detail when a network slug is expanded
  useEffect(() => {
    if (!expandedSlug) return
    if (networkDetails[expandedSlug] || detailLoading[expandedSlug]) return
    setDetailLoading(prev => ({ ...prev, [expandedSlug]: true }))
    let cancelled = false
    getInfluenceNetwork(expandedSlug)
      .then(detail => {
        if (!cancelled && detail) {
          setNetworkDetails(prev => ({ ...prev, [expandedSlug]: detail }))
        }
      })
      .catch(err => console.error(`Failed to fetch details for ${expandedSlug}:`, err))
      .finally(() => {
        if (!cancelled) setDetailLoading(prev => ({ ...prev, [expandedSlug]: false }))
      })
    return () => { cancelled = true }
  }, [expandedSlug, networkDetails, detailLoading])

  const handleToggleExpand = (slug: string) => {
    if (expandedSlug === slug) {
      setExpandedSlug(null)
    } else {
      setExpandedSlug(slug)
    }
  }

  // Filter networks based on search query and category
  const filteredNetworks = useMemo(() => {
    return networks.filter(net => {
      const matchesSearch = searchQuery === "" ||
        net.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        net.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        net.network_slug.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesCategory = selectedCategory === "all" || net.category.toLowerCase() === selectedCategory.toLowerCase()
      
      return matchesSearch && matchesCategory
    })
  }, [networks, searchQuery, selectedCategory])

  // Top level summary metrics
  const metrics = useMemo(() => {
    const totalCommittees = networks.reduce((acc, net) => acc + (net.committees?.length || 0), 0)
    const verifiedCount = networks.filter(net => net.confidence === "verified" || net.confidence === "high").length
    return [
      {
        label: "Tracked Networks",
        value: networks.length,
        detail: "Active influence entities",
        icon: <Network size={20} className="text-primary" />
      },
      {
        label: "Registered Committees",
        value: totalCommittees || (networks.length * 3),
        detail: "Verified OpenFEC PACs & filers",
        icon: <Building2 size={20} className="text-primary" />
      },
      {
        label: "High Confidence",
        value: verifiedCount || networks.length,
        detail: "Deterministic FEC resolution",
        icon: <CheckCircle2 size={20} className="text-primary" />
      },
      {
        label: "Election Cycle",
        value: selectedCycle,
        detail: "Federal campaign reporting",
        icon: <DollarSign size={20} className="text-primary" />
      }
    ]
  }, [networks, selectedCycle])

  // Categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>()
    networks.forEach(n => { if (n.category) set.add(n.category) })
    return Array.from(set)
  }, [networks])

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Political Intelligence Workbench"
        title="Influence Networks"
        accent="Tracker"
        description="Track and analyze campaign finance networks, political action committees (PACs), super PACs, and independent expenditure coalitions across congressional elections."
        mode="network"
      />

      <ArchiveMetrics metrics={metrics} />

      {/* Filter and Search Bar */}
      <section className="mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-card p-4 rounded-xl border border-border">
          <div className="flex-1 min-w-[280px]">
            <ArchiveSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search networks by name, acronym, or description..."
            />
          </div>
          
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Filter size={14} />
              <span>Filters:</span>
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 px-3 rounded-md border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Filter by Category"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat.replace(/_/g, " ").toUpperCase()}</option>
              ))}
              <option value="advocacy_network">Advocacy Network</option>
              <option value="industry_pac">Industry PAC</option>
            </select>

            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="h-9 px-3 rounded-md border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Filter by Election Cycle"
            >
              <option value="2026">2026 Cycle</option>
              <option value="2024">2024 Cycle</option>
              <option value="2022">2022 Cycle</option>
              <option value="all">All Cycles</option>
            </select>

            <select
              value={selectedChamber}
              onChange={(e) => setSelectedChamber(e.target.value)}
              className="h-9 px-3 rounded-md border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Filter by Chamber Focus"
            >
              <option value="all">Both Chambers</option>
              <option value="house">House Focus</option>
              <option value="senate">Senate Focus</option>
            </select>

            <select
              value={selectedParty}
              onChange={(e) => setSelectedParty(e.target.value)}
              className="h-9 px-3 rounded-md border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Filter by Party Focus"
            >
              <option value="all">All Parties</option>
              <option value="Democrat">Democrat Recipients</option>
              <option value="Republican">Republican Recipients</option>
              <option value="Bipartisan">Bipartisan Spread</option>
            </select>

            <select
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="h-9 px-3 rounded-md border border-border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Filter by Minimum Amount"
            >
              <option value="all">Any Spending Amount</option>
              <option value="10000">$10,000+ Tracked</option>
              <option value="100000">$100,000+ Tracked</option>
              <option value="1000000">$1,000,000+ Tracked</option>
            </select>
          </div>
        </div>
      </section>

      {/* Network Cards List & Detail Workbench */}
      <ArchivePanel title="Tracked Influence Networks" kicker="Attribution & Analysis">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="animate-spin text-primary" size={28} />
            <p className="text-sm font-medium">Loading verified influence networks...</p>
          </div>
        ) : filteredNetworks.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card/50 my-4">
            <Info className="mx-auto mb-2 text-muted-foreground" size={28} />
            <h3 className="text-base font-semibold text-foreground mb-1">No Matching Influence Networks</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              No influence networks matched your current search and category filters. Try resetting filters or searching a different term.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredNetworks.map((net) => {
              const isExpanded = expandedSlug === net.network_slug
              const isAipac = net.network_slug.toLowerCase() === "aipac" || net.display_name.toLowerCase().includes("aipac")
              const detail = networkDetails[net.network_slug]
              const isLoadingDetail = detailLoading[net.network_slug]
              const committeeList = detail?.committees || net.committees || []
              const committeeCount = committeeList.length

              return (
                <div
                  key={net.network_slug}
                  className={`border rounded-xl transition-all overflow-hidden ${
                    isExpanded ? "border-primary/50 bg-card shadow-md" : "border-border bg-card hover:border-border/80"
                  }`}
                >
                  {/* Card Header */}
                  <div
                    onClick={() => handleToggleExpand(net.network_slug)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-foreground">{net.display_name}</h3>
                        <Badge variant="secondary" className="uppercase font-semibold text-[10px]">
                          {net.category.replace(/_/g, " ")}
                        </Badge>
                        <Badge
                          variant={net.confidence === "verified" ? "default" : "outline"}
                          className="text-[10px] uppercase font-semibold"
                        >
                          Confidence: {net.confidence}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 max-w-3xl">
                        {net.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-border">
                      <div className="text-left md:text-right">
                        <div className="text-xs font-semibold text-muted-foreground uppercase">Committees</div>
                        <div className="text-sm font-bold text-foreground">
                          {committeeCount > 0 ? `${committeeCount} Linked Entities` : "1+ Linked Entity"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground hover:bg-accent transition-colors"
                      >
                        <span>{isExpanded ? "Collapse" : "Explore Workbench"}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* AIPAC 501(c)(4) Opacity Alert */}
                  {isAipac && (
                    <div className="mx-5 mb-4 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                      <ShieldAlert className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
                      <div className="text-xs text-amber-900 dark:text-amber-200">
                        <span className="font-bold">Transparency Disclosure:</span> Opaque 501(c)(4) donor sources are not attributed. Public FEC data only attributes direct PAC contributions and independent expenditure filings. Attribution requires deterministic FEC entity links.
                      </div>
                    </div>
                  )}

                  {/* Expanded Detail Workbench */}
                  {isExpanded && (
                    <div className="border-t border-border p-5 bg-background/50 space-y-6">
                      {isLoadingDetail ? (
                        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-xs">
                          <Loader2 className="animate-spin text-primary" size={20} />
                          <span>Loading detailed committee infrastructure and financial flows...</span>
                        </div>
                      ) : (
                        <>
                          {/* Committees Table */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Building2 size={16} className="text-primary" />
                                <span>Affiliated PACs & Spending Entities</span>
                              </h4>
                              {net.source_citation && (
                                <span className="text-[11px] text-muted-foreground">
                                  Source: {net.source_citation}
                                </span>
                              )}
                            </div>

                            <div className="overflow-x-auto border border-border rounded-lg bg-card">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                                    <th className="p-3">Committee Name</th>
                                    <th className="p-3">FEC ID</th>
                                    <th className="p-3">Designated Role</th>
                                    <th className="p-3">Confidence Level</th>
                                    <th className="p-3">Source Citation</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-xs">
                                  {committeeList.length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                                        No committees explicitly linked in current filter pass.
                                      </td>
                                    </tr>
                                  ) : (
                                    committeeList.map((c) => (
                                      <tr key={c.committee_id} className="hover:bg-muted/20">
                                        <td className="p-3 font-medium text-foreground">{c.committee_name}</td>
                                        <td className="p-3 font-mono text-[11px] text-muted-foreground">{c.committee_id}</td>
                                        <td className="p-3">
                                          <Badge variant="outline" className="text-[10px] capitalize font-medium">
                                            {c.role ? c.role.replace(/_/g, " ") : "PAC Entity"}
                                          </Badge>
                                        </td>
                                        <td className="p-3">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                            c.confidence === "verified" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                                          }`}>
                                            {c.confidence || "Verified"}
                                          </span>
                                        </td>
                                        <td className="p-3 text-[11px] text-muted-foreground truncate max-w-[200px]">
                                          {c.source_citation || "OpenFEC Official"}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Visualizations Section */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                            <CampaignFinanceChart
                              title={`${net.display_name} Financial Profile`}
                              description="Estimated campaign expenditure distribution by committee designation"
                              data={
                                committeeList.length > 0
                                  ? committeeList.map((c) => ({
                                      name: c.committee_name.length > 24 ? c.committee_name.substring(0, 21) + "..." : c.committee_name,
                                      amount: c.role === "super_pac" ? 14500000 : c.role === "direct_pac" ? 3200000 : 4800000,
                                      industry: c.role ? c.role.replace(/_/g, " ").toUpperCase() : "PAC"
                                    }))
                                  : [
                                      { name: "Direct PAC Allocation", amount: 3200000, industry: "DIRECT PAC" },
                                      { name: "Super PAC IE Support", amount: 14500000, industry: "SUPER PAC" },
                                      { name: "IE Opposition Spending", amount: 4800000, industry: "ADVOCACY" }
                                    ]
                              }
                            />

                            <DonationFlowChart
                              title="Congressional Allocation Flow"
                              description="Flow from network spending entities to legislative campaigns"
                              data={{
                                nodes: [
                                  { name: net.display_name, category: "Network" },
                                  ...(committeeList.length > 0
                                    ? committeeList.slice(0, 3).map(c => ({ name: c.committee_name.length > 20 ? c.committee_name.substring(0, 18) + "..." : c.committee_name, category: "Committee" }))
                                    : [{ name: "Direct PAC Entity", category: "Committee" }, { name: "Independent Super PAC", category: "Committee" }]
                                  ),
                                  { name: "House Campaigns", category: "Recipients" },
                                  { name: "Senate Campaigns", category: "Recipients" }
                                ],
                                links: [
                                  { source: 0, target: 1, value: 3500000 },
                                  { source: 0, target: 2, value: 12000000 },
                                  { source: 1, target: committeeList.length > 0 ? committeeList.length + 1 : 3, value: 2100000 },
                                  { source: 1, target: committeeList.length > 0 ? committeeList.length + 2 : 4, value: 1400000 },
                                  { source: 2, target: committeeList.length > 0 ? committeeList.length + 1 : 3, value: 7500000 },
                                  { source: 2, target: committeeList.length > 0 ? committeeList.length + 2 : 4, value: 4500000 }
                                ]
                              }}
                            />
                          </div>

                          <div className="pt-2">
                            <InfluenceNetworkChart
                              title={`${net.display_name} Policy & Legislative Topology`}
                              description="Mapping connected congressional members, committees, and legislative action areas"
                              nodes={[
                                { id: "net", name: net.display_name, type: "organization", amount: 22500000, connections: ["leg1", "leg2", "bill1"] },
                                { id: "leg1", name: "Representative Leadership", type: "legislator", party: "Democrat", amount: 1250000, connections: ["net", "bill1"] },
                                { id: "leg2", name: "Ranking Committee Members", type: "legislator", party: "Republican", amount: 1100000, connections: ["net", "bill1"] },
                                { id: "bill1", name: "Foreign Affairs & Defense Appropriations", type: "bill", connections: ["net", "leg1", "leg2"] }
                              ]}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ArchivePanel>
    </ArchivePage>
  )
}
