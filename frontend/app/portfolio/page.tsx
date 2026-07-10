"use client"

import { createLogger } from "@/lib/tracing"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  Building,
  CheckCircle2,
  FileText,
  Search,
  TrendingUp,
  Users,
  X,
} from "lucide-react"
import {
  ArchiveMetrics,
  ArchivePage,
  ArchivePanel,
  ArchiveSearch,
  DataState,
  EvidenceSpine,
} from "@/components/ui/archive-ui"
import { CompactMasthead, MarketVisual } from "@/components/ui/mockup-visuals"
import { EvidenceRow } from "@/components/evidence/EvidenceRow"
import { OverlapCard } from "@/components/evidence/OverlapCard"
import { SourceProvenancePill } from "@/components/evidence/SourceProvenancePill"
import { FilingTimeline } from "./_components/FilingTimeline"
import {
  fetchPortfolioSummary,
  fetchTopMembers,
  fetchSectorExposure,
  fetchMarketPulse,
  type MemberRank,
  type MarketPulseResponse,
  type PortfolioSummary,
  type SectorWeight,
} from "@/lib/services/portfolio"
import { getRelationships, type RelationshipEvidence } from "@/lib/services/relationships"
import { formatAmountRange, getRecentTrades, type StockTrade } from "@/lib/services/stocks"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isBuy(trade: StockTrade) {
  const t = (trade.tx_type || "").toLowerCase()
  return t === "buy" || t.includes("purchase")
}

function isSell(trade: StockTrade) {
  const t = (trade.tx_type || "").toLowerCase()
  return t === "sell" || t.includes("sale")
}

const SECTOR_COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1", "#14b8a6",
]

function resolveSubjectName(key: string, trades: StockTrade[]): string {
  if (key.startsWith("member:")) {
    const bioguideId = key.slice(7)
    const match = trades.find((t) => t.bioguide_id === bioguideId)
    return match?.member_name || key
  }
  if (key.startsWith("committee:")) return key.slice(10)
  if (key.startsWith("organization:")) return "Organization #" + key.slice(13)
  return key
}

function predicateLabel(relationType: string): string {
  switch (relationType) {
    case "disclosed_trade": return "disclosed a trade in"
    case "committee_membership": return "serves on"
    default: return relationType.replace(/_/g, " ")
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const log = createLogger("PortfolioPage")

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<"ledger" | "overview" | "evidence">("ledger")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAction, setFilterAction] = useState("all")

  const [trades, setTrades] = useState<StockTrade[]>([])
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [members, setMembers] = useState<MemberRank[]>([])
  const [sectors, setSectors] = useState<SectorWeight[]>([])
  const [pulse, setPulse] = useState<MarketPulseResponse | null>(null)
  const [relationships, setRelationships] = useState<RelationshipEvidence[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErrors, setLoadErrors] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const results = await Promise.allSettled([
          fetchPortfolioSummary(),
          fetchTopMembers(),
          fetchSectorExposure(),
          fetchMarketPulse(),
          getRecentTrades(120),
          getRelationships({ limit: 50 }),
        ])
        if (cancelled) return
        const labels = ["summary", "member rankings", "sector exposure", "source pulse", "disclosures", "relationships"]
        const errors = results.flatMap((result, index) =>
          result.status === "rejected" ? [`${labels[index]}: ${String(result.reason)}`] : [],
        )
        setLoadErrors(errors)
        for (const error of errors) log.error("Portfolio data request failed", { error })
        const fulfilled = <T,>(r: PromiseSettledResult<T>): T | null =>
          r.status === "fulfilled" ? r.value : null
        const s = fulfilled(results[0])
        const m = fulfilled(results[1])
        const sec = fulfilled(results[2])
        const p = fulfilled(results[3])
        const disclosureRows = fulfilled(results[4])
        const rel = fulfilled(results[5])
        if (s) setSummary(s)
        if (m) setMembers(m.members)
        if (sec) setSectors(sec.sectors)
        if (p) setPulse(p)
        if (disclosureRows) setTrades(disclosureRows)
        if (rel) setRelationships(rel.relationships)
      } catch (e) {
        if (!cancelled) log.error("Failed to load portfolio data", { error: String(e) })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Derived values
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      const q = searchTerm.toLowerCase()
      const matchesSearch =
        (trade.member_name || "").toLowerCase().includes(q) ||
        (trade.ticker || "").toLowerCase().includes(q) ||
        (trade.asset_name || "").toLowerCase().includes(q)
      const matchesAction =
        filterAction === "all" ||
        (filterAction === "buy" && isBuy(trade)) ||
        (filterAction === "sell" && isSell(trade)) ||
        (filterAction === "flagged" && (trade.late_filing || trade.conflict_flag_count > 0))
      return matchesSearch && matchesAction
    })
  }, [trades, searchTerm, filterAction])

  const flaggedTrades = useMemo(
    () =>
      trades
        .filter((t) => t.late_filing || t.conflict_flag_count > 0)
        .sort((a, b) => {
          const byFlags = b.conflict_flag_count - a.conflict_flag_count
          if (byFlags !== 0) return byFlags
          return (b.disclosure_lag_days ?? 0) - (a.disclosure_lag_days ?? 0)
        }),
    [trades],
  )

  const buyTrades = trades.filter(isBuy).length
  const sellTrades = trades.filter(isSell).length
  const activeMembers = new Set(trades.map((t) => t.bioguide_id).filter(Boolean)).size
  const disclosedMembers = new Set(trades.map((t) => t.bioguide_id).filter(Boolean)).size

  const topTickers = Object.entries(
    trades.reduce((acc, trade) => {
      if (trade.ticker) acc[trade.ticker] = (acc[trade.ticker] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const filteredMembers = useMemo(() => {
    if (!memberSearch) return members.slice(0, 10)
    const q = memberSearch.toLowerCase()
    return members
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.state.toLowerCase().includes(q) ||
          m.party.toLowerCase().includes(q),
      )
      .slice(0, 10)
  }, [members, memberSearch])

  // Sector donut
  let conicPct = 0
  const conicStops = sectors
    .map((s, i) => {
      const start = conicPct
      conicPct += s.weight
      return `${SECTOR_COLORS[i % SECTOR_COLORS.length]} ${start}% ${conicPct}%`
    })
    .join(", ")
  const conicBg = conicStops || "#e5e7eb 0% 100%"

  // Source coverage counts
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of trades) {
      counts[t.source] = (counts[t.source] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [trades])
  const disclosureSourceLabel = sourceCounts.length === 1
    ? sourceCounts[0][0]
    : sourceCounts.length > 1
      ? `${sourceCounts.length} disclosure sources`
      : "Disclosure source unavailable"

  const directRelationships = useMemo(
    () => relationships.filter((r) => r.evidence_tier === "direct"),
    [relationships],
  )
  const disclosuresFailed = loadErrors.some((error) => error.startsWith("disclosures:"))
  const relationshipsFailed = loadErrors.some((error) => error.startsWith("relationships:"))
  const summaryFailed = loadErrors.some((error) => error.startsWith("summary:"))
  const membersFailed = loadErrors.some((error) => error.startsWith("member rankings:"))
  const sectorsFailed = loadErrors.some((error) => error.startsWith("sector exposure:"))
  const pulseFailed = loadErrors.some((error) => error.startsWith("source pulse:"))
  const activeFilterCount = Number(Boolean(searchTerm.trim())) + Number(filterAction !== "all")
  const latestDisclosureDate = trades
    .map((trade) => trade.disclosure_date)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1)

  function clearLedgerFilters() {
    setSearchTerm("")
    setFilterAction("all")
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <ArchivePage>
      <CompactMasthead
        eyebrow="Disclosure intelligence"
        title="Congressional"
        accent="evidence."
        description="Inspect reported transaction ranges, filing dates, disclosure delays, and source records before reviewing aggregate portfolio context."
        visual={<MarketVisual />}
      />

      {/* ---- Tab bar ---- */}
      <div className="flex gap-0 overflow-x-auto border-b border-border" role="tablist" aria-label="Portfolio views">
        {(["ledger", "overview", "evidence"] as const).map((tab) => (
          <button
            key={tab}
            id={`portfolio-tab-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`portfolio-panel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`min-h-11 whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "ledger" ? "Disclosure Ledger" : tab === "overview" ? "Portfolio Overview" : "Evidence & Overlaps"}
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* TAB 1: Disclosure Ledger                                            */}
      {/* ================================================================= */}
      {activeTab === "ledger" && (
        <section id="portfolio-panel-ledger" role="tabpanel" aria-labelledby="portfolio-tab-ledger">
          <ArchiveSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search trades, members, tickers, or issuers"
          >
            <select
              aria-label="Filter transactions by action"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="all">All Actions</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="flagged">Flagged</option>
            </select>
          </ArchiveSearch>

          <div className="mx-auto -mt-3 mb-4 flex w-[calc(100%-2rem)] max-w-[106rem] flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <strong className="text-foreground">{filteredTrades.length} results</strong>
            {filterAction !== "all" ? <span className="archive-chip">Action: {filterAction}</span> : null}
            {searchTerm.trim() ? <span className="archive-chip">Query: {searchTerm.trim()}</span> : null}
            {activeFilterCount > 0 ? (
              <button className="ml-auto inline-flex min-h-10 items-center gap-1 px-2 font-semibold text-accent" onClick={clearLedgerFilters}>
                <X size={14} /> Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
              </button>
            ) : null}
          </div>

          <div className="archive-content archive-grid-two">
            <ArchivePanel title="Transaction ledger" kicker="Official disclosure rows" action={<span className="font-mono text-xs text-muted-foreground">Showing {Math.min(filteredTrades.length, 32)} of {filteredTrades.length}</span>}>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
                </div>
              ) : disclosuresFailed ? (
                <DataState
                  kind="error"
                  title="Disclosure service unavailable"
                  description="The ledger request failed. No rows are shown because an API failure must not look like a genuine zero-record result."
                />
              ) : filteredTrades.length === 0 ? (
                <DataState
                  title={trades.length === 0 ? "No disclosure rows are loaded" : "No trades match these filters"}
                  description={trades.length === 0
                    ? "This is an ingestion coverage gap, not evidence that members made no trades. Check worker health and source coverage."
                    : "Clear the search or choose another transaction filter to return to the loaded disclosure window."}
                />
              ) : (
                <div className="archive-list">
                  {filteredTrades.slice(0, 32).map((trade) => (
                    <div
                      key={trade.trade_id}
                      className="archive-row grid-cols-1 sm:grid-cols-[3rem_minmax(0,1fr)_auto]"
                    >
                      <div
                        className={`grid h-12 w-12 place-items-center rounded-full border ${
                          isBuy(trade)
                            ? "border-emerald-500/40 text-emerald-400"
                            : isSell(trade)
                              ? "border-red-500/40 text-red-400"
                              : "border-border text-muted-foreground"
                        }`}
                      >
                        {isBuy(trade) ? <ArrowUpRight size={21} /> : isSell(trade) ? <ArrowDownRight size={21} /> : <FileText size={21} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-serif text-xl text-foreground">
                            {trade.member_name || "Unknown member"}
                          </h2>
                          <span className="archive-chip">{trade.state || "Congress"}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Building size={13} />
                            <strong className="text-foreground">{trade.ticker || "N/A"}</strong>{" "}
                            {trade.asset_name}
                          </span>
                        </div>
                        <FilingTimeline trade={trade} />
                        <div className="mt-1">
                          <EvidenceRow trade={trade} />
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div
                          className={
                            isBuy(trade)
                              ? "font-mono text-sm text-emerald-400"
                              : isSell(trade)
                                ? "font-mono text-sm text-red-400"
                                : "font-mono text-sm text-muted-foreground"
                          }
                        >
                          {trade.tx_type
                            ? trade.tx_type.charAt(0).toUpperCase() + trade.tx_type.slice(1)
                            : "Filed"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatAmountRange(trade.amount_min, trade.amount_max)}
                        </div>
                        {trade.filing_url ? (
                          <a
                            className="archive-link mt-2"
                            href={trade.filing_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Filing
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ArchivePanel>

            <div className="grid gap-4">
              <ArchivePanel title="Ticker concentration" kicker="Most frequent">
                {topTickers.length === 0 ? (
                  <DataState kind="setup" title="No tickers are loaded" description="The current disclosure response does not contain normalized ticker symbols." />
                ) : <div className="space-y-4">
                  {topTickers.map(([ticker, count]) => (
                    <div
                      key={ticker}
                      className="flex items-center justify-between border-b border-border pb-3"
                    >
                      <div>
                        <div className="font-serif text-2xl">{ticker}</div>
                        <div className="text-xs text-muted-foreground">Public disclosure ticker</div>
                      </div>
                      <div className="font-mono text-sm text-accent">{count} trades</div>
                    </div>
                  ))}
                </div>}
              </ArchivePanel>

              <ArchivePanel title="Disclosure notes" kicker="Source">
                <EvidenceSpine
                  source={disclosureSourceLabel}
                  status={disclosuresFailed ? "API request failed" : trades.length > 0 ? "Loaded" : "Awaiting ingestion"}
                  updated={latestDisclosureDate}
                  coverage={trades.length > 0 ? `${disclosedMembers} matched members in ${trades.length} loaded rows` : "No loaded rows"}
                >
                  <div className="flex gap-3 text-sm leading-6 text-muted-foreground">
                    <FileText className="mt-1 shrink-0 text-accent" size={18} />
                    <p>
                      Amounts remain the ranges reported in official filings. Committee overlap and
                      filing-delay labels are derived context, not claims about motive or legality.
                    </p>
                  </div>
                </EvidenceSpine>
              </ArchivePanel>
            </div>
          </div>

          <ArchiveMetrics
            metrics={[
              { label: "Loaded rows", value: loading ? "..." : disclosuresFailed ? "Unavailable" : trades.length, detail: "Current API response", icon: <TrendingUp size={20} /> },
              { label: "Purchases", value: disclosuresFailed ? "Unavailable" : buyTrades, detail: "Reported purchase rows", icon: <ArrowUpRight size={20} /> },
              { label: "Sales", value: disclosuresFailed ? "Unavailable" : sellTrades, detail: "Reported sale rows", icon: <ArrowDownRight size={20} /> },
              { label: "Matched members", value: disclosuresFailed ? "Unavailable" : activeMembers, detail: "Unique Bioguide IDs", icon: <Users size={20} /> },
            ]}
          />
        </section>
      )}

      {/* ================================================================= */}
      {/* TAB 2: Portfolio Overview                                          */}
      {/* ================================================================= */}
      {activeTab === "overview" && (
        <section id="portfolio-panel-overview" role="tabpanel" aria-labelledby="portfolio-tab-overview">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-8">
            {[
              { title: "Tracked Members", value: loading ? "..." : summaryFailed ? "Unavailable" : (summary?.total_members?.toLocaleString() ?? "Not loaded"), sub: "NORMALIZED ROWS", icon: <Users className="text-muted-foreground w-5 h-5" /> },
              { title: "In Office", value: loading ? "..." : summaryFailed ? "Unavailable" : (summary?.in_office_count?.toLocaleString() ?? "Not loaded"), sub: "CURRENT MEMBERS", icon: <TrendingUp className="text-blue-500 w-5 h-5" /> },
              { title: "House", value: loading ? "..." : summaryFailed ? "Unavailable" : (summary?.house_count?.toLocaleString() ?? "Not loaded"), sub: "CURRENT CHAMBER", icon: <Building className="text-emerald-500 w-5 h-5" /> },
              { title: "Senate", value: loading ? "..." : summaryFailed ? "Unavailable" : (summary?.senate_count?.toLocaleString() ?? "Not loaded"), sub: "CURRENT CHAMBER", icon: <Building className="text-red-500 w-5 h-5" /> },
              { title: "Disclosed trades", value: loading ? "..." : disclosuresFailed ? "Unavailable" : trades.length.toLocaleString(), sub: "OFFICIAL DISCLOSURES", icon: <TrendingUp className="text-purple-500 w-5 h-5" /> },
            ].map((metric) => (
              <div key={metric.title} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{metric.title}</span>
                  {metric.icon}
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-foreground">{metric.value}</div>
                  <div className="text-[10px] text-gray-500 font-mono font-medium tracking-wider mt-1">{metric.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Cards Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            {/* Coverage Snapshot */}
            <ArchivePanel title="Coverage snapshot" kicker="Official Records">
              {loading ? (
                <output className="block py-8 text-center text-muted-foreground">Loading coverage...</output>
              ) : summaryFailed ? (
                <DataState kind="error" title="Coverage summary unavailable" description="The summary request failed, so member and chamber totals are not replaced with zeroes." />
              ) : summary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background rounded-lg p-3 border border-border">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Members</div>
                      <div className="text-lg font-bold text-foreground">{summary.total_members.toLocaleString()}</div>
                    </div>
                    <div className="bg-background rounded-lg p-3 border border-border">
                      <div className="text-xs text-muted-foreground font-medium mb-1">Committees</div>
                      <div className="text-lg font-bold text-emerald-500">{summary.total_committees.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">House</span><span className="font-mono">{summary.house_count}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Senate</span><span className="font-mono">{summary.senate_count}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Democratic</span><span className="font-mono">{summary.democratic_count}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Republican</span><span className="font-mono">{summary.republican_count}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Independent/Other</span><span className="font-mono">{summary.independent_count}</span></div>
                  </div>
                  <div className="flex flex-col items-center justify-center pt-4">
                    <div className="text-xs text-muted-foreground font-medium mb-4 text-center">Average Service</div>
                    <div className="w-36 h-36 rounded-full relative bg-muted">
                      <div className="absolute inset-[14px] bg-card rounded-full flex flex-col items-center justify-center shadow-inner">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">Years</span>
                        <span className="font-bold text-2xl text-foreground">{summary.avg_years_in_office > 0 ? summary.avg_years_in_office.toFixed(1) : "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : <DataState kind="setup" title="Coverage summary is not loaded" description="The API returned no summary for the current dataset." />}
            </ArchivePanel>

            {/* Sector Exposure */}
            <ArchivePanel title="Committee jurisdiction exposure" kicker="Sector Weights">
              {loading ? (
                <p className="py-8 text-center text-muted-foreground">Loading...</p>
              ) : sectorsFailed ? (
                <DataState kind="error" title="Sector exposure unavailable" description="The sector request failed, so the chart is withheld instead of showing an empty or zero-valued result." />
              ) : sectors.length === 0 ? (
                <DataState kind="setup" title="No sector exposure is loaded" description="Committee jurisdiction weights have not been derived for this dataset." />
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="w-48 h-48 rounded-full shadow-sm relative" style={{ background: `conic-gradient(${conicBg})` }}>
                      <div className="absolute inset-[24px] bg-card rounded-full flex items-center justify-center flex-col shadow-inner">
                        <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase text-center px-2">Top Sector</span>
                        <span className="font-bold text-lg text-foreground text-center truncate px-4 w-full">
                          {sectors.length > 0 ? sectors[0].sector : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 px-2">
                    {sectors.map((s, i) => (
                      <div key={s.sector} className="flex items-center gap-3 text-sm">
                        <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                        <div className="flex-1 text-muted-foreground font-medium truncate" title={s.sector}>{s.sector}</div>
                        <div className="font-mono font-semibold text-foreground">{s.weight.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ArchivePanel>

            {/* Stock Disclosure Snapshot */}
            <ArchivePanel title="Stock disclosures" kicker="Live snapshot">
              {loading ? (
                <p className="py-8 text-center text-muted-foreground">Loading canonical disclosure rows...</p>
              ) : trades.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">
                  No stock transactions are loaded for the current source window. This is an
                  ingestion coverage gap, not evidence that members made no trades.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div><div className="text-2xl font-bold">{trades.length.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Rows</div></div>
                    <div><div className="text-2xl font-bold text-emerald-400">{buyTrades.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Purchases</div></div>
                    <div><div className="text-2xl font-bold text-red-400">{sellTrades.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sales</div></div>
                  </div>
                  <div className="space-y-3">
                    {trades.slice(0, 5).map((trade) => (
                      <div key={trade.trade_id} className="flex items-center justify-between gap-3 border-b border-border pb-3 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{trade.member_name || "Unknown member"}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {trade.ticker || trade.asset_name || "Unidentified asset"} · {trade.transaction_date || "Date unavailable"}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-semibold">{trade.tx_type || "Filed"}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatAmountRange(trade.amount_min, trade.amount_max)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {disclosedMembers.toLocaleString()} members represented in this loaded disclosure window.
                  </p>
                </>
              )}
            </ArchivePanel>

            {/* Top Active Members */}
            <div className="col-span-1 lg:col-span-3">
              <ArchivePanel title="Members by committee coverage" kicker="Rankings">
                {/* Member search */}
                <div className="mb-4">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                      type="text"
                      aria-label="Search members by name, state, or party"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search by name, state, or party..."
                      className="w-full bg-card border border-border rounded-md py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    {memberSearch && (
                      <button aria-label="Clear member search" onClick={() => setMemberSearch("")} className="absolute right-1 top-1/2 grid min-h-10 min-w-10 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
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
                      ) : membersFailed ? (
                        <tr><td colSpan={4} className="py-4 text-center text-red-500">Member ranking request failed. No ranking is shown.</td></tr>
                      ) : filteredMembers.length === 0 ? (
                        <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">{memberSearch ? "No members match this search." : "No member ranking is loaded."}</td></tr>
                      ) : (
                        filteredMembers.map((m) => (
                          <tr key={m.bioguide_id} className="hover:bg-muted/30 transition-colors">
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
              </ArchivePanel>
            </div>
          </div>

          {/* Bottom Insights */}
          {pulseFailed ? (
            <div className="mt-8">
              <DataState kind="error" title="Source pulse unavailable" description="The source-health request failed. Freshness and coverage status are not inferred from the other responses." />
            </div>
          ) : <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">Market Pulse</div>
              <div className="text-sm font-medium text-foreground leading-snug">
                {pulse ? `${pulse.total_members_tracked.toLocaleString()} members tracked` : "..."}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">Source Status</div>
              <div className="text-xl font-bold flex flex-col items-start text-foreground">
                {pulse?.status || "..."}
                <span className="font-mono text-muted-foreground text-xs mt-1 bg-secondary px-2 py-0.5 rounded-sm">
                  {pulse?.message || "..."}
                </span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">Trending Sector</div>
              <div className="text-lg font-bold flex flex-col items-start text-foreground">
                {sectors[0]?.sector || "..."}
                <span className="text-emerald-500 text-sm mt-1 flex items-center gap-1 font-semibold">
                  <TrendingUp className="w-3.5 h-3.5" /> {sectors[0] ? `${sectors[0].weight.toFixed(1)}%` : "..."}
                </span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-2">Compliance</div>
              <div className="text-xl font-bold flex flex-col items-start text-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  {pulse ? pulse.total_committees.toLocaleString() : "..."}
                </div>
                <span className="font-medium text-muted-foreground text-xs mt-1 uppercase tracking-wide">Committees</span>
              </div>
            </div>
          </div>}
        </section>
      )}

      {/* ================================================================= */}
      {/* TAB 3: Evidence & Overlaps                                         */}
      {/* ================================================================= */}
      {activeTab === "evidence" && (
        <section id="portfolio-panel-evidence" role="tabpanel" aria-labelledby="portfolio-tab-evidence">
          <div className="archive-content archive-grid-two mt-8">
            {/* Panel A: Flagged Disclosures */}
            <ArchivePanel title="Flagged disclosures" kicker="Evidence">
              {loading ? (
                <p className="py-8 text-center text-muted-foreground">Loading...</p>
              ) : disclosuresFailed ? (
                <DataState kind="error" title="Flagged disclosures unavailable" description="The disclosure request failed, so the absence of flagged rows cannot be evaluated." />
              ) : flaggedTrades.length === 0 ? (
                <p className="py-8 text-sm text-muted-foreground">
                  No flagged disclosures in the current data window. This may reflect genuine clean
                  records or missing enrichment data.
                </p>
              ) : (
                <div className="archive-list">
                  {flaggedTrades.slice(0, 20).map((trade) => (
                    <div
                      key={trade.trade_id}
                      className="archive-row grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-lg text-foreground">
                            {trade.member_name || "Unknown member"}
                          </h3>
                          <span className="archive-chip">{trade.state}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span>
                            <strong className="text-foreground">{trade.ticker || "N/A"}</strong>{" "}
                            {trade.asset_name}
                          </span>
                          <span>{trade.transaction_date || "No date"}</span>
                        </div>
                        <div className="mt-1">
                          <EvidenceRow trade={trade} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-muted-foreground">
                          {formatAmountRange(trade.amount_min, trade.amount_max)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {trade.conflict_flag_count} flag{trade.conflict_flag_count !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ArchivePanel>

            {/* Panel B: Notable Overlaps */}
            <ArchivePanel title="Notable overlaps" kicker="Relationships">
              {loading ? (
                <p className="py-8 text-center text-muted-foreground">Loading...</p>
              ) : relationshipsFailed ? (
                <DataState
                  kind="error"
                  title="Relationship service unavailable"
                  description="The evidence request failed. The panel is not treating the failure as an empty evidence graph."
                />
              ) : directRelationships.length === 0 ? (
                <DataState
                  kind="setup"
                  title="Relationship evidence has not been derived"
                  description="The disclosure worker derives member-to-organization edges during its resolution step. Run the worker or the refresh-relationships ingest command after loading source records."
                />
              ) : (
                <div className="space-y-3">
                  {directRelationships.slice(0, 15).map((rel) => (
                    <OverlapCard
                      key={`${rel.subject_key}-${rel.object_key}-${rel.relation_type}`}
                      subjectName={resolveSubjectName(rel.subject_key, trades)}
                      predicate={predicateLabel(rel.relation_type)}
                      objectName={resolveSubjectName(rel.object_key, trades)}
                      evidenceTier={rel.evidence_tier}
                      source={rel.source}
                      sourceUrl={rel.source_url}
                      observedAt={rel.observed_at}
                      amountMin={rel.amount_min}
                      amountMax={rel.amount_max}
                    />
                  ))}
                </div>
              )}
            </ArchivePanel>
          </div>

          {/* Panel C: Source Coverage (full width) */}
          <ArchivePanel title="Source coverage" kicker="Provenance">
            {disclosuresFailed ? (
              <DataState kind="error" title="Source coverage unavailable" description="The disclosure request failed, so source counts are not available." />
            ) : sourceCounts.length === 0 ? (
              <DataState kind="setup" title="No source rows are loaded" description="Run the disclosure ingest worker before evaluating source coverage." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase">Source</th>
                      <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase text-right">Rows</th>
                      <th className="pb-3 font-semibold text-[10px] tracking-wider uppercase">Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sourceCounts.map(([source, count]) => (
                      <tr key={source} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 font-medium text-foreground">{source}</td>
                        <td className="py-3 text-right font-mono text-foreground">{count.toLocaleString()}</td>
                        <td className="py-3">
                          <SourceProvenancePill source={source} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ArchivePanel>
        </section>
      )}
    </ArchivePage>
  )
}
