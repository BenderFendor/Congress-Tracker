"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, FileText, Landmark, Network, TrendingUp, Users } from "lucide-react"
import { ArchiveHero, ArchiveMetrics, ArchivePage, ArchivePanel } from "@/components/ui/archive-ui"
import { getAllLegislators, type Legislator } from "@/lib/services/legislators"
import { getRecentTrades, type StockTrade } from "@/lib/services/stocks"
import { getRecentFilings, type Filing } from "@/lib/services/lobbying"
import { getRecentBills, type Bill } from "@/lib/services/bills"

function compactNumber(value: number) {
  if (!Number.isFinite(value)) return "0"
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function numericValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatDate(value?: string) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function HomePage() {
  const [legislators, setLegislators] = useState<Legislator[]>([])
  const [trades, setTrades] = useState<StockTrade[]>([])
  const [filings, setFilings] = useState<Filing[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [legislatorData, tradeData, filingData, billData] = await Promise.all([
          getAllLegislators().catch(() => []),
          getRecentTrades(80).catch(() => []),
          getRecentFilings(1, 40).then((data) => data.results || []).catch(() => []),
          getRecentBills(40).catch(() => []),
        ])

        setLegislators(legislatorData)
        setTrades(tradeData)
        setFilings(filingData)
        setBills(billData)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const matchedTradeMembers = useMemo(
    () => legislators.filter((member) => member.trade_summary?.matched).length,
    [legislators],
  )

  const totalLobbyingIncome = useMemo(
    () => filings.reduce((sum, filing) => sum + numericValue(filing.income) + numericValue(filing.expenses), 0),
    [filings],
  )

  const latestItems = [
    ...bills.slice(0, 3).map((bill) => ({
      type: "Bill",
      title: bill.title,
      meta: `${bill.id || "Bill"} updated ${formatDate(bill.date)}`,
      href: "/bills",
    })),
    ...trades.slice(0, 3).map((trade) => ({
      type: "Trade",
      title: `${trade.representative || "Member"} ${trade.type || "filed"} ${trade.ticker || "trade"}`,
      meta: `${trade.amount || "Undisclosed range"} on ${formatDate(trade.transaction_date)}`,
      href: "/stocks",
    })),
    ...filings.slice(0, 3).map((filing) => ({
      type: "Lobbying",
      title: filing.registrant?.name || "Lobbying filing",
      meta: `${filing.client?.name || "Client not listed"} posted ${formatDate(filing.dt_posted)}`,
      href: "/lobbying",
    })),
  ].slice(0, 6)

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow={loading ? "Syncing public records" : "Live public records"}
        title="Power. Policy."
        accent="Public Knowledge."
        description="Real-time transparency into congressional activity, financial disclosures, legislation, and lobbying influence."
        mode="capitol"
        actions={
          <>
            <Link className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-950/20 transition hover:-translate-y-0.5" href="/legislators">
              Browse Legislators <ArrowRight size={16} />
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-md border border-accent/40 px-5 py-3 text-sm font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent/10" href="/stocks">
              Explore Trades <ArrowRight size={16} />
            </Link>
          </>
        }
        aside={
          <div>
            <div className="archive-panel-kicker">Archive status</div>
            <div className="mt-3 grid gap-3">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted-foreground">Members loaded</span>
                <span className="font-serif text-2xl">{loading ? "..." : legislators.length}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted-foreground">Disclosures sampled</span>
                <span className="font-serif text-2xl">{loading ? "..." : trades.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Senate filings sampled</span>
                <span className="font-serif text-2xl">{loading ? "..." : filings.length}</span>
              </div>
            </div>
          </div>
        }
      />

      <ArchiveMetrics
        metrics={[
          { label: "Active legislators", value: loading ? "..." : legislators.length || 535, detail: "Congress.gov directory", icon: <Users size={20} /> },
          { label: "Bills tracked", value: loading ? "..." : compactNumber(bills.length), detail: "Recent Congress.gov feed", icon: <FileText size={20} /> },
          { label: "Lobbying reports", value: loading ? "..." : compactNumber(filings.length), detail: `$${compactNumber(totalLobbyingIncome)} sampled spend`, icon: <Network size={20} /> },
          { label: "Stock trades", value: loading ? "..." : compactNumber(trades.length), detail: `${matchedTradeMembers} matched members`, icon: <TrendingUp size={20} /> },
        ]}
      />

      <div className="archive-content archive-grid-two mt-4">
        <ArchivePanel title="Recent public activity" kicker="Live feed">
          <div className="archive-list">
            {latestItems.length === 0 ? (
              <div className="py-10 text-sm text-muted-foreground">No records loaded from the configured APIs.</div>
            ) : (
              latestItems.map((item, index) => (
                <Link key={`${item.type}-${index}`} href={item.href} className="archive-row grid-cols-[auto_minmax(0,1fr)_auto]">
                  <span className="archive-chip">{item.type}</span>
                  <span>
                    <span className="block truncate font-serif text-xl text-foreground">{item.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{item.meta}</span>
                  </span>
                  <ArrowRight className="text-accent" size={17} />
                </Link>
              ))
            )}
          </div>
        </ArchivePanel>

        <ArchivePanel title="Influence network" kicker="Connections">
          <div className="relative min-h-[18rem] overflow-hidden rounded-md border border-border bg-muted/35 p-5">
            <div className="absolute inset-0 opacity-45" style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
            <div className="relative z-10 grid h-full place-items-center">
              <div className="grid h-28 w-28 place-items-center rounded-full border border-accent/45 bg-card text-center shadow-2xl">
                <Landmark className="mx-auto mb-2 text-accent" size={28} />
                <span className="font-mono text-[10px] uppercase text-muted-foreground">Congress</span>
              </div>
            </div>
            <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
              <div className="flex justify-between border-t border-border pt-3"><span>Legislators</span><strong className="text-foreground">{legislators.length || 0}</strong></div>
              <div className="flex justify-between border-t border-border pt-3"><span>Organizations</span><strong className="text-foreground">{filings.length || 0}</strong></div>
              <div className="flex justify-between border-t border-border pt-3"><span>Bills</span><strong className="text-foreground">{bills.length || 0}</strong></div>
              <div className="flex justify-between border-t border-border pt-3"><span>Trades</span><strong className="text-foreground">{trades.length || 0}</strong></div>
            </div>
          </div>
        </ArchivePanel>
      </div>
    </ArchivePage>
  )
}
