"use client"

import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { ArrowRight, FileText, Landmark, Network, TrendingUp, Users, DollarSign } from "lucide-react"
import { ArchiveHero, ArchiveMetrics, ArchivePage, ArchivePanel } from "@/components/ui/archive-ui"
import { NetworkHeroVisual, ActivityItem, ProofRow } from "@/components/ui/mockup-visuals"
import { getAllLegislators, type Legislator } from "@/lib/services/legislators"
import { formatAmountRange, getRecentTrades, type StockTrade } from "@/lib/services/stocks"
import { getRecentFilings, type LobbyingFiling } from "@/lib/services/lobbying"
import { getRecentBills, type Bill } from "@/lib/services/bills"
import { compactNumber, formatDate } from "@/lib/format"
import { getSourceCoverage, type SourceCoverage } from "@/lib/services/sources"

const CivicObservatory = dynamic(
  () => import("@/components/ui/civic-observatory").then((module) => module.CivicObservatory),
  { ssr: false },
)

function numericValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export default function HomePage() {
  const [legislators, setLegislators] = useState<Legislator[]>([])
  const [trades, setTrades] = useState<StockTrade[]>([])
  const [filings, setFilings] = useState<LobbyingFiling[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [sourceCoverage, setSourceCoverage] = useState<SourceCoverage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [legislatorData, tradeData, filingData, billData, coverageData] = await Promise.all([
          getAllLegislators().catch(() => []),
          getRecentTrades(80).catch(() => []),
          getRecentFilings(1, 40).then((data) => data.results || []).catch(() => []),
          getRecentBills(40).catch(() => []),
          getSourceCoverage().catch(() => null),
        ])

        setLegislators(legislatorData)
        setTrades(tradeData)
        setFilings(filingData)
        setBills(billData)
        setSourceCoverage(coverageData)
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
  const lobbyingSpendLabel = totalLobbyingIncome > 0 ? `$${compactNumber(totalLobbyingIncome)} disclosed spend` : "Spend unavailable"

  const sourceCounts = useMemo(() => {
    const initial = { fresh: 0, stale: 0, failed: 0 }
    return sourceCoverage?.sources.reduce((counts, source) => {
      if (source.freshness === "fresh") counts.fresh += 1
      else if (source.freshness === "stale") counts.stale += 1
      else counts.failed += 1
      return counts
    }, initial) ?? initial
  }, [sourceCoverage])

  const latestItems = [
    ...bills.slice(0, 3).map((bill) => ({
      type: "Bill" as const,
      icon: <FileText size={17} />,
      title: bill.title,
      meta: `${bill.id || "Bill"} updated ${formatDate(bill.date)}`,
      href: "/bills",
    })),
    ...trades.slice(0, 3).map((trade) => ({
      type: "Trade" as const,
      icon: <TrendingUp size={17} />,
      title: `${trade.member_name || "Member"} ${trade.tx_type || "filed"} ${trade.ticker || "trade"}`,
      meta: `${formatAmountRange(trade.amount_min, trade.amount_max)} on ${formatDate(trade.transaction_date || undefined)}`,
      href: "/portfolio",
    })),
    ...filings.slice(0, 3).map((filing) => ({
      type: "Lobbying" as const,
      icon: <DollarSign size={17} />,
      title: filing.registrant_name || "Lobbying filing",
      meta: `${filing.client_name || "Client not listed"} posted ${formatDate(filing.dt_posted || undefined)}`,
      href: "/lobbying",
    })),
  ].slice(0, 6)

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow={loading ? "Syncing public records" : sourceCoverage?.summary.successful ? "Fresh public records" : "Public records with coverage gaps"}
        title="Power. Policy."
        accent="Public Knowledge."
        description="Trace legislation, campaign money, lobbying, and financial disclosures back to the public records that support them."
        mode="capitol"
        actions={
          <div className="home-hero-actions">
            <Link className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-950/20 transition hover:-translate-y-0.5" href="/legislators">
              Find a legislator <ArrowRight size={16} />
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-5 py-3 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-accent" href="/search">
              Search records <ArrowRight size={16} />
            </Link>
            <Link className="home-hero-tertiary" href="/portfolio">Browse financial disclosures</Link>
            <ProofRow />
          </div>
        }
        aside={
          <div className="home-hero-aside-content">
            <div className="home-hero-aside-heading">
              <div>
                <div className="archive-panel-kicker">How the archive works</div>
                <h2>Follow the evidence chain</h2>
              </div>
              <Link href="/influence" className="archive-link">Explore links <ArrowRight size={14} /></Link>
            </div>
            <NetworkHeroVisual />
          </div>
        }
      />
      <CivicObservatory />

      <section className="home-snapshot-heading" aria-labelledby="archive-snapshot-title">
        <div>
          <div className="archive-panel-kicker">Current archive</div>
          <h2 id="archive-snapshot-title">What you can investigate now</h2>
        </div>
        <p>Counts reflect records loaded from configured public sources, not estimates.</p>
      </section>

      <ArchiveMetrics
        metrics={[
          { label: "Active legislators", value: loading ? "..." : legislators.length, detail: "Canonical member table", icon: <Users size={20} /> },
          { label: "Bills tracked", value: loading ? "..." : compactNumber(bills.length), detail: "Recent Congress.gov feed", icon: <FileText size={20} /> },
          { label: "Lobbying reports", value: loading ? "..." : compactNumber(filings.length), detail: lobbyingSpendLabel, icon: <Network size={20} /> },
          { label: "Stock trades", value: loading ? "..." : compactNumber(trades.length), detail: `${matchedTradeMembers} matched members`, icon: <TrendingUp size={20} /> },
        ]}
      />

      <div className="archive-content home-story-grid mt-4">
        <ArchivePanel title="Recent public activity" kicker="Live feed">
          <div>
            {latestItems.length === 0 ? (
              <div className="py-10 text-sm text-muted-foreground">No records loaded from the configured APIs.</div>
            ) : (
              latestItems.map((item, index) => (
                <ActivityItem
                  key={`${item.type}-${index}`}
                  icon={item.icon}
                  badge={item.type}
                  title={item.title}
                  meta={item.meta}
                  href={item.href}
                />
              ))
            )}
          </div>
        </ArchivePanel>

        <ArchivePanel title="Influence network" kicker="Connections">
            <div className="relative min-h-[12rem] overflow-hidden rounded-md border border-border bg-muted/35 p-5">
              <div className="absolute inset-0 opacity-45" style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
              <div className="relative z-10 grid h-full place-items-center">
                <div className="grid h-24 w-24 place-items-center rounded-full border border-accent/45 bg-card text-center shadow-2xl">
                  <Landmark className="mx-auto mb-1 text-accent" size={24} />
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">Congress</span>
                </div>
              </div>
              <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div className="flex justify-between border-t border-border pt-3"><span>Legislators</span><strong className="text-foreground">{legislators.length || 0}</strong></div>
                <div className="flex justify-between border-t border-border pt-3"><span>Organizations</span><strong className="text-muted-foreground">Unavailable until entity crosswalks load</strong></div>
                <div className="flex justify-between border-t border-border pt-3"><span>Bills</span><strong className="text-foreground">{bills.length || 0}</strong></div>
                <div className="flex justify-between border-t border-border pt-3"><span>Trades</span><strong className="text-foreground">{trades.length || 0}</strong></div>
                <div className="flex justify-between border-t border-border pt-3"><span>Filings</span><strong className="text-foreground">{filings.length || 0}</strong></div>
              </div>
              <Link href="/influence" className="archive-link mt-4 inline-flex">Open influence graph <ArrowRight size={14} /></Link>
            </div>
        </ArchivePanel>
      </div>

      <section className="home-coverage" aria-labelledby="coverage-title">
        <div className="home-coverage-intro">
          <div>
            <div className="archive-panel-kicker">Coverage pulse</div>
            <h2 id="coverage-title">Know what the archive can prove</h2>
          </div>
          <p>Source gaps stay visible. Missing records become unavailable labels or ranges, never false zeroes.</p>
        </div>

        <div className="home-coverage-summary" aria-label="Source coverage summary">
          <div className="fresh"><strong>{sourceCounts.fresh}</strong><span>Fresh</span></div>
          <div className="stale"><strong>{sourceCounts.stale}</strong><span>Stale</span></div>
          <div className="failed"><strong>{sourceCounts.failed}</strong><span>Unavailable</span></div>
        </div>

        <details className="home-source-inventory" open>
          <summary>
            <span>Source inventory</span>
            <span>{sourceCoverage?.sources.length ?? 0} monitored sources</span>
          </summary>
          <div className="home-source-grid">
            {sourceCoverage ? sourceCoverage.sources.map((src, index) => (
              <div
                key={src.source}
                className={`ct-source-row ${src.freshness}`}
                style={{ "--source-index": index } as CSSProperties}
              >
                <span><i className={`ct-status-dot ${src.freshness === "fresh" ? "" : src.freshness === "stale" ? "warn" : "bad"}`} />{src.display_name || src.source}</span>
                <b>{src.freshness === "fresh" ? "Fresh" : src.freshness === "stale" ? "Stale" : "Unavailable"}</b>
              </div>
            )) : <div className="text-sm text-muted-foreground">Source coverage loading...</div>}
          </div>
        </details>
      </section>

      {sourceCoverage && sourceCoverage.summary.stale_or_missing > 0 && (
        <ArchivePanel title="Source coverage" kicker="Data quality">
          <p className="text-sm text-muted-foreground">
            {sourceCoverage.summary.stale_or_missing} of {sourceCoverage.summary.total} registered sources are stale or missing. Results from those sources may be incomplete; missing records are not evidence of no activity.
          </p>
        </ArchivePanel>
      )}
    </ArchivePage>
  )
}
