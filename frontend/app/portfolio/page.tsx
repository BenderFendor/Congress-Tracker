"use client"

import React, { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import {
  Search, Filter, Activity, TrendingUp, Users,
  Building, CheckCircle2, LineChart, PieChart, X
} from "lucide-react"
import {
  fetchPortfolioSummary, fetchTopMembers,
  fetchSectorExposure, fetchMarketPulse,
  type PortfolioSummary, type MemberRank,
  type SectorWeight, type MarketPulseResponse
} from "@/lib/services/portfolio"
import { formatAmountRange, getRecentTrades, type StockTrade } from "@/lib/services/stocks"

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [members, setMembers] = useState<MemberRank[]>([])
  const [sectors, setSectors] = useState<SectorWeight[]>([])
  const [pulse, setPulse] = useState<MarketPulseResponse | null>(null)
  const [trades, setTrades] = useState<StockTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [s, m, sec, p, disclosureRows] = await Promise.all([
          fetchPortfolioSummary(),
          fetchTopMembers(),
          fetchSectorExposure(),
          fetchMarketPulse(),
          getRecentTrades(120),
        ])
        setSummary(s)
        setMembers(m.members)
        setSectors(sec.sectors)
        setPulse(p)
        setTrades(disclosureRows)
      } catch (e) {
        console.error("Failed to load portfolio data:", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filteredMembers = useMemo(() => {
    if (!search) return members.slice(0, 10)
    const q = search.toLowerCase()
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.state.toLowerCase().includes(q) ||
      m.party.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [members, search])

  const buyTrades = trades.filter((trade) => (trade.tx_type || "").toLowerCase().includes("buy") || (trade.tx_type || "").toLowerCase().includes("purchase")).length
  const sellTrades = trades.filter((trade) => (trade.tx_type || "").toLowerCase().includes("sell") || (trade.tx_type || "").toLowerCase().includes("sale")).length
  const disclosedMembers = new Set(trades.map((trade) => trade.bioguide_id).filter(Boolean)).size

  const sectorColors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1", "#14b8a6"]

  let conicPct = 0
  const conicStops = sectors.map((s, i) => {
    const start = conicPct
    conicPct += s.weight
    return `${sectorColors[i % sectorColors.length]} ${start.toFixed(1)}% ${conicPct.toFixed(1)}%`
  }).join(", ")
  const conicBg = conicStops || "#e5e7eb 0% 100%"

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 font-sans max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center pt-4">
        <div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-none mb-4">
            <span className="text-foreground">CONGRESS</span><br />
            <span className="text-accent font-serif italic font-normal tracking-normal">PORTFOLIOS</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            View member-level coverage and committee exposure from normalized congressional records.
          </p>
        </div>
        <div className="relative w-full h-[250px] md:h-[300px] flex items-center justify-center bg-card rounded-2xl overflow-hidden border border-border shadow-sm">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-foreground to-transparent" />
          <Building className="w-32 h-32 md:w-48 md:h-48 text-muted-foreground/30 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
          <LineChart className="w-20 h-20 md:w-24 md:h-24 text-accent absolute left-[20%] top-[30%] opacity-80" />
          <PieChart className="w-16 h-16 md:w-20 md:h-20 text-blue-500 absolute right-[25%] bottom-[25%] opacity-80" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent/30 bg-accent/5 px-5 py-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-accent">Unified disclosure view</div>
          <p className="mt-1 text-sm text-muted-foreground">Portfolio coverage and STOCK Act transactions use the same canonical disclosure feed.</p>
        </div>
        <Link href="/stocks" className="rounded-md border border-accent px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent hover:text-white">Open full stock ledger</Link>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-end justify-between border-b border-border pb-0 mt-8">
        <div className="flex gap-8 w-full lg:w-auto overflow-x-auto no-scrollbar">
          {["overview", "members", "analysis"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-bold border-b-[4px] pb-3 whitespace-nowrap px-1 transition-colors ${activeTab === tab
                  ? "text-accent border-accent"
                  : "text-gray-500 border-transparent hover:text-foreground"
                }`}
            >
              {tab === "overview" ? "Portfolio Overview" : tab === "members" ? "Member Portfolios" : "Analysis"}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3 pb-4 lg:pb-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by politician name, state, or party..."
              className="w-full bg-card border border-border rounded-md py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 border px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap ${showFilters ? 'bg-accent text-white border-accent' : 'border-accent text-accent hover:bg-accent/10'}`}
          >
            <Filter className="w-4 h-4" /> Advanced Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Chamber", "Party", "State", "Sector"].map(f => (
            <div key={f}>
              <div className="text-[10px] font-bold text-muted-foreground uppercase mb-2">{f}</div>
              <select className="w-full bg-background border border-border rounded-md py-1.5 px-2 text-sm">
                <option>All</option>
                {f === "Chamber" && <><option>House</option><option>Senate</option></>}
                {f === "Party" && <><option>Democrat</option><option>Republican</option><option>Independent</option></>}
                {f === "State" && <option>TX</option>}
                {f === "Sector" && sectors.slice(0, 6).map(s => <option key={s.sector}>{s.sector}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { title: "Tracked Members", value: loading ? "..." : (summary?.total_members?.toLocaleString() ?? "0"), sub: "NORMALIZED ROWS", icon: <Users className="text-muted-foreground w-5 h-5" /> },
          { title: "In Office", value: loading ? "..." : (summary?.in_office_count?.toLocaleString() ?? "0"), sub: "CURRENT MEMBERS", icon: <Activity className="text-blue-500 w-5 h-5" /> },
          { title: "House", value: loading ? "..." : (summary?.house_count?.toLocaleString() ?? "0"), sub: "CURRENT CHAMBER", icon: <Building className="text-emerald-500 w-5 h-5" /> },
          { title: "Senate", value: loading ? "..." : (summary?.senate_count?.toLocaleString() ?? "0"), sub: "CURRENT CHAMBER", icon: <Building className="text-red-500 w-5 h-5" /> },
          { title: "Disclosed trades", value: loading ? "..." : trades.length.toLocaleString(), sub: "OFFICIAL DISCLOSURES", icon: <TrendingUp className="text-purple-500 w-5 h-5" /> },
        ].map((m, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{m.title}</span>
              {m.icon}
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground">{m.value}</div>
              <div className="text-[10px] text-gray-500 font-mono font-medium tracking-wider mt-1">{m.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          {/* Main Cards Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coverage Snapshot */}
            <div className="col-span-1 border border-border bg-card rounded-xl p-6 flex flex-col shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-bl-full" />
              <div className="text-[10px] font-bold text-accent tracking-widest uppercase mb-3 relative z-10">Coverage Snapshot</div>
              {summary ? (
                <>
                  <h2 className="text-2xl font-serif mb-6 relative z-10 text-foreground">
                    Official Records
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-background rounded-lg p-3 border border-border">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Members</div>
                      <div className="text-lg font-bold text-foreground">{summary.total_members.toLocaleString()}</div>
                    </div>
                    <div className="bg-background rounded-lg p-3 border border-border">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Committees</div>
                      <div className="text-lg font-bold text-emerald-500">{summary.total_committees.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mb-3 text-foreground">Chamber And Party Mix</div>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">House</span><span className="font-mono">{summary.house_count}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Senate</span><span className="font-mono">{summary.senate_count}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Democratic</span><span className="font-mono">{summary.democratic_count}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Republican</span><span className="font-mono">{summary.republican_count}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Independent/Other</span><span className="font-mono">{summary.independent_count}</span></div>
                  </div>
                  <div className="mt-8 flex flex-col items-center justify-center relative">
                    <div className="text-xs text-muted-foreground font-medium mb-4 text-center">Average Service</div>
                    <div className="w-36 h-36 rounded-full relative bg-muted">
                      <div className="absolute inset-[14px] bg-card rounded-full flex flex-col items-center justify-center shadow-inner">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">Years</span>
                        <span className="font-bold text-2xl text-foreground">{summary.avg_years_in_office > 0 ? summary.avg_years_in_office.toFixed(1) : "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">{loading ? "Loading..." : "No data"}</div>
              )}
            </div>

            {/* Sector Exposure */}
            <div className="col-span-1 border border-border bg-card rounded-xl p-6 flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-lg font-bold text-foreground">Committee jurisdiction exposure</h2>
              </div>
              {loading ? (
                <div className="flex justify-center items-center h-48 mb-10 text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="flex justify-center mb-10 relative">
                    <div className="w-48 h-48 rounded-full shadow-sm" style={{ background: `conic-gradient(${conicBg})` }}>
                      <div className="absolute inset-[24px] bg-card rounded-full flex items-center justify-center flex-col shadow-inner">
                        <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase text-center px-2">Top Sector</span>
                        <span className="font-bold text-lg text-foreground text-center truncate px-4 w-full">
                          {sectors.length > 0 ? sectors[0].sector : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 flex-1 px-2">
                    {sectors.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: sectorColors[i % sectorColors.length] }} />
                        <div className="flex-1 text-muted-foreground font-medium truncate" title={s.sector}>{s.sector}</div>
                        <div className="font-mono font-semibold text-foreground">{s.weight.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-8 pt-6 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-foreground">Based on committee jurisdiction records</span>
                </div>
              </div>
            </div>

            <div className="col-span-1 border border-border bg-card rounded-xl p-6 flex flex-col shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-accent">Stock disclosures</div>
                  <h2 className="mt-1 text-lg font-bold text-foreground">Live filing snapshot</h2>
                </div>
                <Link href="/stocks" className="text-xs font-semibold text-accent hover:underline">View ledger</Link>
              </div>
              {loading ? <p className="text-sm text-muted-foreground">Loading canonical disclosure rows...</p> : trades.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">No stock transactions are loaded for the current source window. This is an ingestion coverage gap, not evidence that members made no trades.</div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div><div className="text-2xl font-bold">{trades.length.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Rows</div></div>
                    <div><div className="text-2xl font-bold text-emerald-400">{buyTrades.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Purchases</div></div>
                    <div><div className="text-2xl font-bold text-red-400">{sellTrades.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sales</div></div>
                  </div>
                  <div className="space-y-3">
                    {trades.slice(0, 5).map((trade) => <div key={trade.trade_id} className="flex items-center justify-between gap-3 border-b border-border pb-3 text-sm"><div className="min-w-0"><div className="truncate font-semibold">{trade.member_name || "Unknown member"}</div><div className="truncate text-xs text-muted-foreground">{trade.ticker || trade.asset_name || "Unidentified asset"} · {trade.transaction_date || "Date unavailable"}</div></div><div className="shrink-0 text-right"><div className="text-xs font-semibold">{trade.tx_type || "Filed"}</div><div className="text-[11px] text-muted-foreground">{formatAmountRange(trade.amount_min, trade.amount_max)}</div></div></div>)}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">{disclosedMembers.toLocaleString()} members represented in this loaded disclosure window.</p>
                </>
              )}
            </div>

            {/* Top Active Members */}
            <div className="col-span-1 border border-border bg-card rounded-xl p-6 flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-foreground">Members by committee coverage</h2>
              </div>
              <div className="flex-1 overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase">Rank</th>
                      <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase">Member</th>
                      <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase text-right">Committees</th>
                      <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase text-right">Years</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Loading...</td></tr>
                    ) : filteredMembers.length === 0 ? (
                      <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No data available</td></tr>
                    ) : (
                      filteredMembers.map((m, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors group">
                          <td className="py-4 font-mono text-muted-foreground text-xs">{m.rank}</td>
                          <td className="py-4 font-semibold text-foreground whitespace-nowrap pr-2 truncate max-w-[120px]" title={m.name}>
                            {m.name}
                            <div className="text-[10px] text-muted-foreground">{m.party} - {m.state}</div>
                          </td>
                          <td className="py-4 text-right font-mono font-medium text-foreground">{m.committee_count.toLocaleString()}</td>
                          <td className="py-4 text-right font-mono text-muted-foreground">{m.years_in_office > 0 ? m.years_in_office.toFixed(1) : "N/A"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom Insights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-1 border border-border bg-card rounded-xl p-4 shadow-sm">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">Market Pulse</div>
              <div className="text-sm font-medium text-foreground leading-snug">
                {pulse ? `${pulse.total_members_tracked.toLocaleString()} members tracked` : "..."}
              </div>
            </div>
            <div className="col-span-1 border border-border bg-card rounded-xl p-4 shadow-sm">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">Source Status</div>
              <div className="text-xl font-bold flex flex-col items-start text-foreground">
                {pulse?.status || "..."}
                <span className="font-mono text-muted-foreground text-xs mt-1 bg-secondary px-2 py-0.5 rounded-sm">
                  {pulse?.message || "..."}
                </span>
              </div>
            </div>
            <div className="col-span-1 border border-border bg-card rounded-xl p-4 shadow-sm">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">Trending Sector</div>
              <div className="text-lg font-bold flex flex-col items-start text-foreground">
                {sectors[0]?.sector || "..."}
                <span className="text-emerald-500 text-sm mt-1 flex items-center gap-1 font-semibold">
                  <TrendingUp className="w-3.5 h-3.5" /> {sectors[0] ? `${sectors[0].weight.toFixed(1)}%` : "..."}
                </span>
              </div>
            </div>
            <div className="col-span-1 border border-border bg-card rounded-xl p-4 shadow-sm">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">Compliance</div>
              <div className="text-xl font-bold flex flex-col items-start text-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  {pulse ? pulse.total_committees.toLocaleString() : "..."}
                </div>
                <span className="font-medium text-muted-foreground text-xs mt-1 uppercase tracking-wide">Committees</span>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "members" && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground mb-6">Member Portfolios</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase">Rank</th>
                  <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase">Name</th>
                  <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase">Party</th>
                  <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase">State</th>
                  <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase">Chamber</th>
                  <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase text-right">Committees</th>
                  <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase text-right">Years</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMembers.map((m, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-mono text-muted-foreground text-xs">{m.rank}</td>
                    <td className="py-3 font-semibold text-foreground">{m.name}</td>
                    <td className="py-3 text-muted-foreground">{m.party}</td>
                    <td className="py-3 text-muted-foreground">{m.state}</td>
                    <td className="py-3 text-muted-foreground">{m.chamber}</td>
                    <td className="py-3 text-right font-mono font-medium text-foreground">{m.committee_count.toLocaleString()}</td>
                    <td className="py-3 text-right font-mono text-muted-foreground">{m.years_in_office > 0 ? m.years_in_office.toFixed(1) : "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "analysis" && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h2 className="text-2xl font-serif text-foreground mb-4">Analysis</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Deeper charts, estimated returns, committee-stock overlap detection, and timeline views are planned for this section.
          </p>
        </div>
      )}
    </div>
  )
}
