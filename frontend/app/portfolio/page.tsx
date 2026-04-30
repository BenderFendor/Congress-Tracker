"use client"

import React, { useEffect, useState, useMemo } from "react"
import {
  Search, Filter, Activity, TrendingUp, Users,
  ArrowUpRight, ArrowDownRight, BarChart3,
  Building, CheckCircle2, ChevronRight, LineChart, PieChart, X
} from "lucide-react"
import {
  fetchPortfolioSummary, fetchFeaturedPortfolio, fetchTopMembers,
  fetchSectorExposure, fetchMarketPulse,
  type PortfolioSummary, type FeaturedPortfolio, type MemberRank,
  type SectorWeight, type MarketPulseResponse
} from "@/lib/services/portfolio"

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [featured, setFeatured] = useState<FeaturedPortfolio | null>(null)
  const [members, setMembers] = useState<MemberRank[]>([])
  const [sectors, setSectors] = useState<SectorWeight[]>([])
  const [pulse, setPulse] = useState<MarketPulseResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [s, f, m, sec, p] = await Promise.all([
          fetchPortfolioSummary(),
          fetchFeaturedPortfolio(),
          fetchTopMembers(),
          fetchSectorExposure(),
          fetchMarketPulse(),
        ])
        setSummary(s)
        setFeatured(f)
        setMembers(m.members)
        setSectors(sec.sectors)
        setPulse(p)
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

  const buyPct = summary ? ((summary.buy_orders / (summary.buy_orders + summary.sell_orders || 1)) * 100).toFixed(1) : "0.0"
  const sellPct = summary ? ((summary.sell_orders / (summary.buy_orders + summary.sell_orders || 1)) * 100).toFixed(1) : "0.0"

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
            Analyze stock trading portfolios and patterns of congressional members.
          </p>
        </div>
        <div className="relative w-full h-[250px] md:h-[300px] flex items-center justify-center bg-card rounded-2xl overflow-hidden border border-border shadow-sm">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-foreground to-transparent" />
          <Building className="w-32 h-32 md:w-48 md:h-48 text-muted-foreground/30 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
          <LineChart className="w-20 h-20 md:w-24 md:h-24 text-accent absolute left-[20%] top-[30%] opacity-80" />
          <PieChart className="w-16 h-16 md:w-20 md:h-20 text-blue-500 absolute right-[25%] bottom-[25%] opacity-80" />
        </div>
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
          { title: "Total Politicians", value: loading ? "..." : (summary?.total_politicians?.toLocaleString() ?? "0"), sub: "IN DATABASE", icon: <Users className="text-muted-foreground w-5 h-5" /> },
          { title: "Total Trades", value: loading ? "..." : (summary?.total_trades?.toLocaleString() ?? "0"), sub: "ACROSS ALL MEMBERS", icon: <Activity className="text-blue-500 w-5 h-5" /> },
          { title: "Buy Orders", value: loading ? "..." : (summary?.buy_orders?.toLocaleString() ?? "0"), sub: `${buyPct}% OF TOTAL`, icon: <ArrowUpRight className="text-emerald-500 w-5 h-5" /> },
          { title: "Sell Orders", value: loading ? "..." : (summary?.sell_orders?.toLocaleString() ?? "0"), sub: `${sellPct}% OF TOTAL`, icon: <ArrowDownRight className="text-red-500 w-5 h-5" /> },
          { title: "Net Activity", value: summary ? `${summary.net_activity >= 0 ? '+' : ''}${summary.net_activity}` : "...", sub: "NET BUY ORDERS", icon: <TrendingUp className="text-purple-500 w-5 h-5" /> },
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
            {/* Featured Portfolio */}
            <div className="col-span-1 border border-border bg-card rounded-xl p-6 flex flex-col shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-bl-full" />
              <div className="text-[10px] font-bold text-accent tracking-widest uppercase mb-3 relative z-10">Featured Portfolio</div>
              {featured ? (
                <>
                  <h2 className="text-2xl font-serif mb-6 relative z-10 text-foreground">
                    {featured.member.name}
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-background rounded-lg p-3 border border-border">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Total Trades</div>
                      <div className="text-lg font-bold text-foreground">{featured.trade_count.toLocaleString()}</div>
                    </div>
                    <div className="bg-background rounded-lg p-3 border border-border">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Est. Volume</div>
                      <div className="text-lg font-bold text-emerald-500">${featured.member.volume ? (featured.member.volume / 1000000).toFixed(1) + "M" : "N/A"}</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold mb-3 text-foreground">Top Holdings</div>
                  <div className="flex-1 space-y-1">
                    {featured.top_holdings.length > 0 ? featured.top_holdings.map((h, i) => (
                      <div key={i} className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                            {h.ticker.substring(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-foreground">{h.ticker}</div>
                            <div className="text-xs text-muted-foreground">{h.name}</div>
                          </div>
                        </div>
                        <div className="font-mono text-sm font-medium text-foreground">{h.percentage}%</div>
                      </div>
                    )) : (
                      <div className="text-muted-foreground text-sm py-4 text-center">No holdings data</div>
                    )}
                  </div>
                  <div className="mt-8 flex flex-col items-center justify-center relative">
                    <div className="text-xs text-muted-foreground font-medium mb-4 text-center">Asset Allocation</div>
                    <div className="w-36 h-36 rounded-full relative" style={{ background: `conic-gradient(${featured.asset_allocation.map((s, i) => `${sectorColors[i % sectorColors.length]} ${featured.asset_allocation.slice(0, i).reduce((sum, p) => sum + p.weight, 0).toFixed(1)}% ${(featured.asset_allocation.slice(0, i).reduce((sum, p) => sum + p.weight, 0) + s.weight).toFixed(1)}%`).join(", ") || "#e5e7eb 0% 100%"})` }}>
                      <div className="absolute inset-[14px] bg-card rounded-full flex flex-col items-center justify-center shadow-inner">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">Assets</span>
                        <span className="font-bold text-2xl text-foreground">{featured.top_holdings.length}</span>
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
                <h2 className="text-lg font-bold text-foreground">Sector Exposure</h2>
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
                  <span className="text-sm font-semibold text-foreground">Based on transaction volume sample</span>
                </div>
              </div>
            </div>

            {/* Top Active Members */}
            <div className="col-span-1 border border-border bg-card rounded-xl p-6 flex flex-col shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-foreground">Top Active Members</h2>
              </div>
              <div className="flex-1 overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase">Rank</th>
                      <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase">Member</th>
                      <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase text-right">Trades</th>
                      <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase text-right">Volume</th>
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
                          <td className="py-4 text-right font-mono font-medium text-foreground">{m.total_trades.toLocaleString()}</td>
                          <td className="py-4 text-right font-mono text-muted-foreground">{m.volume ? `$${(m.volume / 1000).toFixed(0)}K` : "N/A"}</td>
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
                {pulse ? `${pulse.total_trades_sampled.toLocaleString()} trades analyzed` : "..."}
              </div>
            </div>
            <div className="col-span-1 border border-border bg-card rounded-xl p-4 shadow-sm">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">Most Traded</div>
              <div className="text-xl font-bold flex flex-col items-start text-foreground">
                {pulse?.most_traded_ticker || "..."}
                <span className="font-mono text-muted-foreground text-xs mt-1 bg-secondary px-2 py-0.5 rounded-sm">
                  {pulse ? `${pulse.most_traded_count.toLocaleString()} trades` : "..."}
                </span>
              </div>
            </div>
            <div className="col-span-1 border border-border bg-card rounded-xl p-4 shadow-sm">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">Trending Sector</div>
              <div className="text-lg font-bold flex flex-col items-start text-foreground">
                {pulse?.trending_sector || "..."}
                <span className="text-emerald-500 text-sm mt-1 flex items-center gap-1 font-semibold">
                  <TrendingUp className="w-3.5 h-3.5" /> {pulse ? `${pulse.trending_sector_weight.toFixed(1)}%` : "..."}
                </span>
              </div>
            </div>
            <div className="col-span-1 border border-border bg-card rounded-xl p-4 shadow-sm">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">Compliance</div>
              <div className="text-xl font-bold flex flex-col items-start text-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  {pulse ? `${pulse.timely_disclosure_rate}%` : "..."}
                </div>
                <span className="font-medium text-muted-foreground text-xs mt-1 uppercase tracking-wide">Timely Rate</span>
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
                  <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase text-right">Trades</th>
                  <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase text-right">Volume</th>
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
                    <td className="py-3 text-right font-mono font-medium text-foreground">{m.total_trades.toLocaleString()}</td>
                    <td className="py-3 text-right font-mono text-muted-foreground">{m.volume ? `$${(m.volume / 1000).toFixed(0)}K` : "N/A"}</td>
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
