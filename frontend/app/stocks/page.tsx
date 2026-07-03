"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Building, Calendar, FileText, TrendingUp, Users } from "lucide-react"
import { ArchiveHero, ArchiveMetrics, ArchivePage, ArchivePanel, ArchiveSearch } from "@/components/ui/archive-ui"
import { formatAmountRange, getRecentTrades, type StockTrade } from "@/lib/services/stocks"

function isBuy(trade: StockTrade) {
  return (trade.tx_type || "").toLowerCase() === "buy" || (trade.tx_type || "").toLowerCase().includes("purchase")
}

function isSell(trade: StockTrade) {
  return (trade.tx_type || "").toLowerCase() === "sell" || (trade.tx_type || "").toLowerCase().includes("sale")
}

export default function StocksPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAction, setFilterAction] = useState("all")
  const [trades, setTrades] = useState<StockTrade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTrades() {
      try {
        setTrades(await getRecentTrades(120))
      } finally {
        setLoading(false)
      }
    }

    loadTrades()
  }, [])

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      const search = searchTerm.toLowerCase()
      const matchesSearch =
        trade.member_name.toLowerCase().includes(search) ||
        (trade.ticker || "").toLowerCase().includes(search) ||
        (trade.asset_name || "").toLowerCase().includes(search)

      const matchesAction =
        filterAction === "all" ||
        (filterAction === "buy" && isBuy(trade)) ||
        (filterAction === "sell" && isSell(trade))

      return matchesSearch && matchesAction
    })
  }, [trades, searchTerm, filterAction])

  const buyTrades = trades.filter(isBuy).length
  const sellTrades = trades.filter(isSell).length
  const activeMembers = new Set(trades.map((trade) => trade.member_name).filter(Boolean)).size
  const topTickers = Object.entries(
    trades.reduce((acc, trade) => {
      if (trade.ticker) acc[trade.ticker] = (acc[trade.ticker] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Stocks"
        title="Market"
        accent="Moves."
        description="Track congressional stock trading activity from public financial disclosure records and inspect the underlying filings."
        mode="market"
        aside={
          <div>
            <div className="archive-panel-kicker">Market snapshot</div>
            <div className="mt-4 space-y-3">
              {topTickers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickers loaded.</p>
              ) : topTickers.map(([ticker, count]) => (
                <div key={ticker}>
                  <div className="mb-1 flex justify-between text-sm"><span>{ticker}</span><span>{count} trades</span></div>
                  <div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(16, (count / topTickers[0][1]) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        }
      />

      <ArchiveSearch value={searchTerm} onChange={setSearchTerm} placeholder="Search trades, members, tickers, or issuers">
        <select value={filterAction} onChange={(event) => setFilterAction(event.target.value)}>
          <option value="all">All Actions</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
      </ArchiveSearch>

      <ArchiveMetrics
        metrics={[
          { label: "Total trades", value: loading ? "..." : trades.length, detail: "Loaded disclosures", icon: <TrendingUp size={20} /> },
          { label: "Buy trades", value: buyTrades, detail: "Purchase filings", icon: <ArrowUpRight size={20} /> },
          { label: "Sell trades", value: sellTrades, detail: "Sale filings", icon: <ArrowDownRight size={20} /> },
          { label: "Active members", value: activeMembers, detail: "Unique filers", icon: <Users size={20} /> },
        ]}
      />

      <div className="archive-content archive-grid-two">
        <ArchivePanel title="Recent trades" kicker="Disclosure stream">
          {loading ? (
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          ) : filteredTrades.length === 0 ? (
            <p className="py-10 text-sm text-muted-foreground">No trades match the current search.</p>
          ) : (
            <div className="archive-list">
              {filteredTrades.slice(0, 32).map((trade, index) => (
                <div key={`${trade.transaction_date}-${trade.ticker}-${index}`} className="archive-row grid-cols-[3rem_minmax(0,1fr)_auto]">
                  <div className={`grid h-12 w-12 place-items-center rounded-full border ${isBuy(trade) ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}`}>
                    {isBuy(trade) ? <ArrowUpRight size={21} /> : <ArrowDownRight size={21} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-xl text-foreground">{trade.member_name || "Unknown member"}</h2>
                      <span className="archive-chip">{trade.state || "Congress"}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Building size={13} /> <strong className="text-foreground">{trade.ticker || "N/A"}</strong> {trade.asset_name}</span>
                      <span className="inline-flex items-center gap-1"><Calendar size={13} /> {trade.transaction_date || "No date"}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={isBuy(trade) ? "font-mono text-sm text-emerald-400" : "font-mono text-sm text-red-400"}>{trade.tx_type ? trade.tx_type.charAt(0).toUpperCase() + trade.tx_type.slice(1) : "Filed"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatAmountRange(trade.amount_min, trade.amount_max)}</div>
                    {trade.filing_url ? <a className="archive-link mt-2" href={trade.filing_url} target="_blank" rel="noreferrer">Filing</a> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ArchivePanel>

        <div className="grid gap-4">
          <ArchivePanel title="Ticker concentration" kicker="Most frequent">
            <div className="space-y-4">
              {topTickers.map(([ticker, count]) => (
                <div key={ticker} className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <div className="font-serif text-2xl">{ticker}</div>
                    <div className="text-xs text-muted-foreground">Public disclosure ticker</div>
                  </div>
                  <div className="font-mono text-sm text-accent">{count} trades</div>
                </div>
              ))}
            </div>
          </ArchivePanel>

          <ArchivePanel title="Disclosure notes" kicker="Source">
            <div className="flex gap-3 text-sm leading-6 text-muted-foreground">
              <FileText className="mt-1 shrink-0 text-accent" size={18} />
              <p>Trade rows come from the backend CapitolTrades client. Amounts are public disclosure ranges, not exact market values.</p>
            </div>
          </ArchivePanel>
        </div>
      </div>
    </ArchivePage>
  )
}
