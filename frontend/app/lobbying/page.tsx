"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  ExternalLink, Info, Landmark,
  RefreshCw, Search
} from "lucide-react"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import {
  fetchLobbyingOverview, fetchLobbyingFilings, fetchInfluenceFlow, fetchTopSectors,
  type FilingCardItem, type FlowNode, type FlowLink,
} from "@/lib/services/lobbying"

const currentYear = new Date().getFullYear()

function formatCurrency(value: number): string {
  if (!value || !Number.isFinite(value)) return "$0"
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1,
  }).format(value)
}

const DONUT_COLORS = ["#aa332d", "#335d88", "#6e5d91", "#8a8d91"]
const SECTOR_COLORS = ["#aa332d", "#335d88", "#6e5d91", "#8a8d91", "#d4a574"]

// ── Influence Flow SVG ──

function InfluenceFlowSvg({ nodes, links }: { nodes: FlowNode[]; links: FlowLink[] }) {
  const w = 380; const h = 260
  const leftNodes = nodes.filter(n => n.side === "left")
  const rightNodes = nodes.filter(n => n.side === "right")
  const centerNode = nodes.find(n => n.side === "center")

  const leftY = (i: number) => h * 0.15 + (h * 0.7 / Math.max(leftNodes.length, 1)) * (i + 0.5)
  const rightY = (i: number) => h * 0.15 + (h * 0.7 / Math.max(rightNodes.length, 1)) * (i + 0.5)
  const cx = w * 0.25; const c2x = w * 0.75

  const maxVal = links.reduce((m, l) => Math.max(m, l.value || 0), 1)
  const bandScale = (v: number) => Math.max(3, (v / maxVal) * 18)

  function curvePath(x1: number, y1: number, x2: number, y2: number, bw: number): string {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1 - bw / 2} C ${mx} ${y1 - bw / 2}, ${mx} ${y2 - bw / 2}, ${x2} ${y2 - bw / 2} L ${x2} ${y2 + bw / 2} C ${mx} ${y2 + bw / 2}, ${mx} ${y1 + bw / 2}, ${x1} ${y1 + bw / 2} Z`
  }

  const leftLinks = links.filter(l => l.target === "senate_influence")
  const rightLinks = links.filter(l => l.source === "senate_influence")

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <defs>
        <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#aa332d" stopOpacity={0.7} />
          <stop offset="50%" stopColor="#335d88" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#6e5d91" stopOpacity={0.7} />
        </linearGradient>
      </defs>
      {leftLinks.map((l, i) => {
        const sn = leftNodes.findIndex(n => n.id === l.source)
        const bw = bandScale(l.value)
        return <path key={`l${i}`} d={curvePath(cx + 30, leftY(sn), w * 0.48, h * 0.5, bw)} fill="url(#flowGrad)" opacity={0.75} />
      })}
      {rightLinks.map((l, i) => {
        const tn = rightNodes.findIndex(n => n.id === l.target)
        const bw = bandScale(l.value)
        return <path key={`r${i}`} d={curvePath(w * 0.52, h * 0.5, c2x - 30, rightY(tn), bw)} fill="url(#flowGrad)" opacity={0.75} />
      })}
      {leftNodes.map((n, i) => (
        <g key={n.id}>
          <rect x={10} y={leftY(i) - 12} width={cx - 20} height={24} rx={6} fill="#fffdf8" stroke="#dfd5c6" />
          <text x={cx / 2} y={leftY(i) + 4} textAnchor="middle" className="fill-foreground text-[10px] font-sans">{n.label}</text>
        </g>
      ))}
      {centerNode && (
        <g>
          <circle cx={w / 2} cy={h * 0.5} r={28} fill="#aa332d" />
          <Landmark width={18} height={18} x={w / 2 - 9} y={h * 0.5 - 9} color="#fffdf8" />
          <text x={w / 2} y={h * 0.5 + 42} textAnchor="middle" className="fill-muted-foreground text-[9px] font-sans">SENATE</text>
          <text x={w / 2} y={h * 0.5 + 54} textAnchor="middle" className="fill-muted-foreground text-[9px] font-sans">INFLUENCE</text>
        </g>
      )}
      {rightNodes.map((n, i) => (
        <g key={n.id}>
          <rect x={c2x + 10} y={rightY(i) - 12} width={w - c2x - 20} height={24} rx={6} fill="#fffdf8" stroke="#dfd5c6" />
          <text x={c2x + (w - c2x) / 2} y={rightY(i) + 4} textAnchor="middle" className="fill-foreground text-[10px] font-sans">{n.label}</text>
        </g>
      ))}
    </svg>
  )
}

// ── Filing Card ──

function FilingCard({ item }: { item: FilingCardItem }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent/10 border border-accent/20 font-serif text-lg text-accent font-bold">
          {item.avatarText}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[10px] font-bold text-accent tracking-widest uppercase">{item.entityRole}</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono uppercase">{item.jurisdiction}</span>
          </div>
          <h3 className="font-serif text-xl text-foreground truncate">{item.registrantName}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {item.filingCount} FILING{item.filingCount !== 1 ? "S" : ""} THIS YEAR &bull; {item.clientCount} CLIENT{item.clientCount !== 1 ? "S" : ""}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
        <div><div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">{item.reportedAmountLabel}</div><div className="font-serif text-lg font-bold text-foreground mt-0.5">{formatCurrency(item.reportedAmount)}</div></div>
        <div><div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Filing Count</div><div className="font-serif text-lg font-bold text-foreground mt-0.5">{item.filingCount}</div></div>
        <div><div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Clients</div><div className="font-serif text-lg font-bold text-foreground mt-0.5">{item.clientCount}</div></div>
      </div>
      {item.topIssueAreas.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-2">Top Issue Areas</div>
          <div className="flex flex-wrap gap-1.5">
            {item.topIssueAreas.slice(0, 4).map(issue => (
              <span key={issue} className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 bg-accent/5 border border-accent/15 text-accent rounded">{issue}</span>
            ))}
          </div>
        </div>
      )}
      <a href={`/lobbying/${encodeURIComponent(item.registrantName.replace(/\s+/g, "-"))}`} className="inline-flex items-center gap-1 mt-4 text-xs font-bold text-accent hover:text-accent-dark transition-colors">
        View Details <ExternalLink size={11} />
      </a>
    </div>
  )
}

// ── Main Page ──

export default function LobbyingPage() {
  const [activeTab, setActiveTab] = useState("Recent Filings")
  const [search, setSearch] = useState("")
  const [year, setYear] = useState(currentYear)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<{ total: number; breakdown: { label: string; amount: number; percent: number }[]; sourceNote: string } | null>(null)
  const [filingItems, setFilingItems] = useState<FilingCardItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [flowData, setFlowData] = useState<{ nodes: FlowNode[]; links: FlowLink[] } | null>(null)
  const [sectorData, setSectorData] = useState<{ sector: string; amount: number }[]>([])
  const [sectorSource, setSectorSource] = useState("")

  const loadOverview = useCallback(async () => {
    const data = await fetchLobbyingOverview(year)
    if (data) setOverview({ total: data.totalReportedLobbying, breakdown: data.breakdown, sourceNote: data.sourceNote })
  }, [year])

  const loadFilings = useCallback(async () => {
    const data = await fetchLobbyingFilings(year, search || undefined, 12, 0)
    if (data) { setFilingItems(data.items); setHasMore(data.hasMore) }
  }, [year, search])

  const loadFlow = useCallback(async () => {
    const data = await fetchInfluenceFlow(year)
    if (data) setFlowData(data)
  }, [year])

  const loadSectors = useCallback(async () => {
    const data = await fetchTopSectors(year)
    if (data) {
      setSectorData(data.items.slice(0, 5).map(i => ({ sector: i.sector, amount: i.amount })))
      setSectorSource(data.sourceNote)
    }
  }, [year])

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([loadOverview(), loadFilings(), loadFlow(), loadSectors()])
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [loadOverview, loadFilings, loadFlow, loadSectors])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
  }, [])

  const handleRefresh = useCallback(() => {
    setLoading(true)
    Promise.all([loadOverview(), loadFilings(), loadFlow(), loadSectors()])
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [loadOverview, loadFilings, loadFlow, loadSectors])

  const tabs = ["Recent Filings", "Top Spenders", "Top Firms", "Industry Spend", "Top Recipients"]

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-card to-background">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #aa332d 0.5px, transparent 0.5px)", backgroundSize: "24px 24px" }} />
        <div className="absolute top-8 right-16 text-[72px] font-serif font-bold text-muted-foreground/5 rotate-12 select-none pointer-events-none">SENATE RECORD</div>
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-12 md:py-16 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
            <div className="lg:col-span-3">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-none mb-4 font-serif">
                <span className="text-foreground">Influence</span><br />
                <span className="text-accent italic font-normal tracking-normal">Tracker</span>
              </h1>
              <p className="text-xs font-bold text-muted-foreground tracking-[0.25em] uppercase max-w-lg leading-relaxed">
                Trace lobbying money and political influence through Senate filings.
              </p>
              {/* Folder art */}
              <div className="mt-8 flex gap-2">
                <div className="relative w-32 h-40">
                  <div className="absolute bottom-0 left-0 w-28 h-36 bg-[#f5ecd7] border border-[#d4c5a0] rounded-sm shadow-sm flex flex-col items-center justify-center p-2 z-10">
                    <div className="text-[9px] font-mono font-bold text-accent tracking-wide text-center leading-tight">LOBBYING<br />DISCLOSURE<br />SENATE FILINGS</div>
                    <div className="w-8 h-0.5 bg-accent/40 my-1.5" />
                    <div className="text-[7px] font-mono font-bold text-muted-foreground text-center">PUBLIC<br />RECORD</div>
                  </div>
                  <div className="absolute bottom-1 left-3 w-28 h-36 bg-[#ede1c8] border border-[#d4c5a0] rounded-sm -rotate-3 opacity-80" />
                  <div className="absolute bottom-2 left-6 w-28 h-36 bg-[#e8d9bf] border border-[#d4c5a0] rounded-sm rotate-2 opacity-60" />
                </div>
                <div className="flex flex-col gap-1 justify-end pb-1">
                  {["Disclosures", "Clients", "Issue Areas", "Payments"].map(tab => (
                    <div key={tab} className="text-[8px] font-mono font-bold text-muted-foreground bg-[#ede1c8] border border-[#d4c5a0] px-2 py-0.5 rounded-sm uppercase tracking-wider">{tab}</div>
                  ))}
                </div>
              </div>
            </div>
            {/* Overview Card */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Influence Overview</h3>
                  <Info size={14} className="text-muted-foreground" />
                </div>
                <div className="text-center mb-4">
                  <div className="font-serif text-3xl md:text-4xl font-extrabold text-foreground">
                    {loading ? "..." : formatCurrency(overview?.total ?? 0)}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mt-1">Total Reported Lobbying</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">YTD {year}</div>
                </div>
                {loading ? (
                  <div className="h-40 flex items-center justify-center"><div className="w-10 h-10 rounded-full border-4 border-accent border-t-transparent animate-spin" /></div>
                ) : overview && overview.breakdown.some(b => b.percent > 0) ? (
                  <div className="flex items-center gap-4">
                    <div className="w-28 h-28 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={overview.breakdown.filter(b => b.percent > 0)} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="percent" nameKey="label" strokeWidth={0}>
                            {overview.breakdown.filter(b => b.percent > 0).map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2">
                      {overview.breakdown.map((b, i) => (
                        <div key={b.label} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          <span className="text-foreground font-medium flex-1">{b.label}</span>
                          <span className="font-mono text-muted-foreground">{b.percent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-muted-foreground py-6">No data available</div>
                )}
                <div className="mt-4 pt-3 border-t border-border text-[9px] text-muted-foreground font-mono">
                  Source: {overview?.sourceNote ?? "LDA filings"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="border-b border-border bg-card/50 sticky top-0 z-20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex gap-0 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-bold border-b-[3px] transition-colors whitespace-nowrap ${
                activeTab === tab ? "text-accent border-accent" : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >{tab}</button>
          ))}
        </div>
      </div>

      {/* Search Controls */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input type="text" value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search organizations, clients, or issues..."
            className="w-full bg-card border border-border rounded-lg py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-card border border-border rounded-lg py-2.5 px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={handleRefresh} className="flex items-center gap-2 border border-border bg-card hover:bg-muted rounded-lg py-2.5 px-4 text-sm font-bold text-foreground transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 md:px-10 pb-4">
          <div className="p-3 border border-red-500/30 bg-red-950/10 text-sm text-red-600 dark:text-red-400 rounded-lg">{error}</div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Filing Cards */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="flex justify-center py-16"><div className="w-10 h-10 rounded-full border-4 border-accent border-t-transparent animate-spin" /></div>
            ) : filingItems.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">No filings found for the selected criteria.</div>
            ) : (
              <>
                {filingItems.map(item => (
                  <FilingCard key={`${item.registrantId}-${item.registrantName}`} item={item} />
                ))}
                {hasMore && (
                  <button onClick={() => { setLoading(true); fetchLobbyingFilings(year, search || undefined, filingItems.length + 12, 0).then(d => { if (d) { setFilingItems(d.items); setHasMore(d.hasMore); } setLoading(false); }) }}
                    className="w-full py-3 text-sm font-bold text-accent border border-accent/20 rounded-xl hover:bg-accent/5 transition-colors"
                  >
                    View more filings &#x2193;
                  </button>
                )}
              </>
            )}
          </div>

          {/* Right - Analytics */}
          <div className="lg:col-span-1 space-y-5">
            {/* Influence Flow */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Influence Flow</h3>
                <div className="flex items-center gap-1.5">
                  <Info size={13} className="text-muted-foreground" />
                  <span className="text-[9px] font-mono text-muted-foreground">YTD {year}</span>
                </div>
              </div>
              {loading ? (
                <div className="flex justify-center py-10"><div className="w-8 h-8 rounded-full border-3 border-accent border-t-transparent animate-spin" /></div>
              ) : flowData && flowData.links.length > 0 ? (
                <>
                  <div className="flex justify-between items-center px-2 mb-1">
                    <span className="text-[9px] font-bold text-muted-foreground tracking-wider uppercase">Spenders</span>
                    <span className="text-[9px] font-bold text-muted-foreground tracking-wider uppercase">Policy Targets</span>
                  </div>
                  <InfluenceFlowSvg nodes={flowData.nodes} links={flowData.links} />
                </>
              ) : (
                <div className="text-center text-xs text-muted-foreground py-8">No flow data available</div>
              )}
            </div>

            {/* Top Sectors */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Top Sectors by Spend</h3>
                <div className="flex items-center gap-1.5">
                  <Info size={13} className="text-muted-foreground" />
                  <span className="text-[9px] font-mono text-muted-foreground">YTD {year}</span>
                </div>
              </div>
              {loading ? (
                <div className="flex justify-center py-10"><div className="w-8 h-8 rounded-full border-3 border-accent border-t-transparent animate-spin" /></div>
              ) : sectorData.length > 0 ? (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                        <XAxis type="number" tickFormatter={v => formatCurrency(Number(v))} tick={{ fontSize: 9, fill: "#89919b" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="sector" tick={{ fontSize: 10, fontWeight: 600, fill: "#5f6874" }} axisLine={false} tickLine={false} width={130} />
                        <Tooltip formatter={(v: number) => [formatCurrency(v), "Amount"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                          {sectorData.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border text-[9px] text-muted-foreground font-mono">
                    {sectorSource}
                  </div>
                </>
              ) : (
                <div className="text-center text-xs text-muted-foreground py-8">No sector data available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
