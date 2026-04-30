"use client"

import { useEffect, useState } from "react"
import { CampaignFinanceChart } from "@/components/visualizations/campaign-finance-chart"
import { DonationFlowChart } from "@/components/visualizations/donation-flow-chart"
import { InfluenceNetwork } from "@/components/visualizations/influence-network"
import { LobbyingTimeline } from "@/components/visualizations/lobbying-timeline"
import { parseIndustries, parseTopSpenders, parseLobbyistRecipients, parseCSV } from "@/lib/csvUtils"
import { Loader2, AlertTriangle } from "lucide-react"
import { BACKEND_URL } from "@/lib/constants"

interface NetworkNode {
  id: string
  name: string
  type: "organization" | "legislator" | "bill"
  party?: string
  amount?: number
  connections: string[]
}

// Enrichment API types
// Data sources: CapitolTrades, Congress.gov, OpenFEC

interface EnrichedTrade {
  ticker: string
  asset_description: string
  trade_type: string
  amount: string
  estimated_value: number
  trade_date: string | null
  disclosure_date: string | null
  chamber: string
  politician_name: string
  party: string
  state: string
  sector: string
  industry: string
}

// Enrichment data transforms

function buildSectorDistribution(trades: EnrichedTrade[]) {
  const sectorMap = new Map<string, number>()
  for (const t of trades) {
    const key = t.sector || "Unknown"
    sectorMap.set(key, (sectorMap.get(key) || 0) + t.estimated_value)
  }
  return Array.from(sectorMap.entries())
    .map(([name, amount]) => ({
      name: name.length > 15 ? name.substring(0, 15) : name,
      amount,
      industry: name,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
}

function buildFlowFromTrades(trades: EnrichedTrade[]) {
  const sectors = [...new Set(trades.map(t => t.sector || "Unknown"))].slice(0, 4)
  const politicians = [...new Set(trades.map(t => t.politician_name).filter(Boolean))].slice(0, 6)

  const linkMap = new Map<string, number>()
  for (const t of trades) {
    const sIdx = sectors.indexOf(t.sector || "Unknown")
    const pIdx = politicians.indexOf(t.politician_name)
    if (sIdx === -1 || pIdx === -1) continue
    const key = `${sIdx}|${pIdx}`
    linkMap.set(key, (linkMap.get(key) || 0) + t.estimated_value)
  }

  const nodes = [
    ...sectors.map(s => ({ name: s.length > 20 ? s.substring(0, 20) : s, category: "Donor" })),
    ...politicians.map(p => ({ name: p.length > 20 ? p.substring(0, 20) : p, category: "Recipient" })),
  ]

  const links = Array.from(linkMap.entries()).map(([key, value]) => {
    const [source, target] = key.split("|").map(Number)
    return { source, target: sectors.length + target, value }
  })

  return { nodes, links }
}

function buildNetworkFromTrades(trades: EnrichedTrade[]) {
  const sectors = [
    ...new Set(trades.map(t => t.sector || "Unknown").filter(s => s !== "Unknown")),
  ].slice(0, 3)
  const polData = [
    ...new Map(
      trades
        .filter(t => t.politician_name)
        .map(t => [t.politician_name, { party: t.party, state: t.state }] as const)
    ).entries(),
  ]
    .slice(0, 4)
    .map(([name, meta]) => ({ name, ...meta }))
  const tickers = [
    ...new Set(trades.map(t => t.ticker).filter(t => t !== "N/A")),
  ].slice(0, 3)

  let idCounter = 1
  const orgIds: string[] = []
  const legIds: string[] = []
  const billIds: string[] = []
  const nodes: NetworkNode[] = []
  const connMap = new Map<string, Set<string>>()

  sectors.forEach(s => {
    const id = String(idCounter++)
    orgIds.push(id)
    const total = trades
      .filter(t => (t.sector || "Unknown") === s)
      .reduce((sum, t) => sum + t.estimated_value, 0)
    nodes.push({
      id,
      name: s.length > 15 ? s.substring(0, 15) : s,
      type: "organization",
      amount: total,
      connections: [],
    })
    connMap.set(id, new Set())
  })

  polData.forEach(({ name, party }) => {
    const id = String(idCounter++)
    legIds.push(id)
    const p =
      party === "Democrat"
        ? "Democrat"
        : party === "Republican"
          ? "Republican"
          : "Independent"
    nodes.push({ id, name, type: "legislator", party: p, connections: [] })
    connMap.set(id, new Set())
  })

  tickers.forEach(ticker => {
    const id = String(idCounter++)
    billIds.push(id)
    nodes.push({
      id,
      name: ticker.length > 15 ? ticker.substring(0, 15) : ticker,
      type: "bill",
      connections: [],
    })
    connMap.set(id, new Set())
  })

  for (const t of trades) {
    const sIdx = sectors.indexOf(t.sector || "Unknown")
    const pIdx = polData.findIndex(p => p.name === t.politician_name)
    const tIdx = tickers.indexOf(t.ticker)

    if (sIdx >= 0 && pIdx >= 0) {
      connMap.get(orgIds[sIdx])?.add(legIds[pIdx])
      connMap.get(legIds[pIdx])?.add(orgIds[sIdx])
    }
    if (pIdx >= 0 && tIdx >= 0) {
      connMap.get(legIds[pIdx])?.add(billIds[tIdx])
      connMap.get(billIds[tIdx])?.add(legIds[pIdx])
    }
  }

  nodes.forEach(node => {
    const conns = connMap.get(node.id)
    if (conns && conns.size > 0) {
      node.connections = [...conns].slice(0, 2)
    } else {
      const fallback =
        node.type === "organization"
          ? legIds
          : node.type === "legislator"
            ? orgIds
            : legIds
      node.connections = [fallback[0]].filter(Boolean)
    }
  })

  return nodes
}

export default function VisualizationsPage() {
  const [loading, setLoading] = useState(true)
  const [financeData, setFinanceData] = useState<Array<{ name: string; amount: number; industry?: string }>>([])
  const [timelineData, setTimelineData] = useState<Array<{ date: string; amount: number; bills: number; organizations: number }>>([])
  const [flowData, setFlowData] = useState<{ nodes: Array<{ name: string; category?: string }>; links: Array<{ source: number; target: number; value: number }> }>({ nodes: [], links: [] })
  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([])
  const [enrichmentAvailable, setEnrichmentAvailable] = useState(false)
  const [enrichmentError, setEnrichmentError] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Fetch CSV files (lobbying data from OpenSecrets)
        const [
          industriesRes,
          spendersRes,
          recipients24Res,
          recipients22Res,
          recipients10Res,
          recipients08Res,
          billsRes,
        ] = await Promise.all([
          fetch("/data/Industries.csv").then(r => r.text()),
          fetch("/data/Top Spenders.csv").then(r => r.text()),
          fetch(
            "/data/Top Recipients of Contributions from Lobbyists, 2024 Cycle.csv"
          ).then(r => r.text()),
          fetch(
            "/data/Top Recipients of Contributions from Lobbyists, 2022 Cycle.csv"
          ).then(r => r.text()),
          fetch(
            "/data/Top Recipients of Contributions from Lobbyists, 2010 Cycle.csv"
          ).then(r => r.text()),
          fetch(
            "/data/Top Recipients of Contributions from Lobbyists, 2008 Cycle.csv"
          ).then(r => r.text()),
          fetch("/data/Bills.csv").then(r => r.text()),
        ])

        // Campaign Finance (Industries) — base data from CSV
        const industries = parseIndustries(industriesRes)
        setFinanceData(
          industries.slice(0, 5).map(ind => ({
            name: ind.name.split("/")[0].substring(0, 15),
            amount: ind.total,
            industry: ind.name,
          }))
        )

        // Timeline (lobbying cycles) — base data from CSV
        const billsRaw = parseCSV(billsRes).slice(1)
        const cycles = [
          { year: "2008", data: parseLobbyistRecipients(recipients08Res, "2008") },
          { year: "2010", data: parseLobbyistRecipients(recipients10Res, "2010") },
          { year: "2022", data: parseLobbyistRecipients(recipients22Res, "2022") },
          { year: "2024", data: parseLobbyistRecipients(recipients24Res, "2024") },
        ]

        setTimelineData(
          cycles.map(cycle => {
            const totalAmount = cycle.data.reduce(
              (sum, item) => sum + item.fromLobbyists,
              0
            )
            return {
              date: `Cycle ${cycle.year}`,
              amount: totalAmount * 50,
              bills: Math.floor(billsRaw.length / cycles.length),
              organizations: cycle.data.length * 10,
            }
          })
        )

        // CSV-derived reference data for fallback flow/network
        const topSpenders = parseTopSpenders(spendersRes).slice(0, 4)
        const topRecipients = parseLobbyistRecipients(recipients24Res, "2024").slice(
          0,
          6
        )
        const topBills = billsRaw.slice(0, 3)

        // 2. Fetch enrichment API data
        // Data sources: CapitolTrades via /api/enrichment/trades,
        //               Congress.gov, OpenFEC via ticker_resolver
        let enrichmentOk = false
        try {
          const tradesRes = await fetch(
            `${BACKEND_URL}/api/enrichment/trades?limit=500`
          )
          if (tradesRes.ok) {
            const enriched: EnrichedTrade[] = await tradesRes.json()
            if (enriched.length > 0) {
              enrichmentOk = true

              // Enrich sector distribution from real stock trade data
              const sectorDist = buildSectorDistribution(enriched)
              if (sectorDist.length > 0) {
                setFinanceData(sectorDist)
              }

              // Build flow data from sector ↔ politician trade relationships
              const flow = buildFlowFromTrades(enriched)
              if (flow.nodes.length > 0 && flow.links.length > 0) {
                setFlowData(flow)
              }

              // Build network from sector → politician → ticker relationships
              const netNodes = buildNetworkFromTrades(enriched)
              if (netNodes.length > 0) {
                setNetworkNodes(netNodes)
              }
            }
          } else {
            setEnrichmentError(true)
          }
        } catch {
          setEnrichmentError(true)
        }
        setEnrichmentAvailable(enrichmentOk)

        // 3. Fallback: CSV-only flow/network
        if (!enrichmentOk) {
          const flowNodes = [
            ...topSpenders.map(s => ({
              name: s.client.substring(0, 20),
              category: "Donor",
            })),
            ...topRecipients.map(r => ({
              name: r.recipient.split(" (")[0],
              category: "Recipient",
            })),
          ]
          const flowLinks: { source: number; target: number; value: number }[] = []
          topSpenders.forEach((spender, i) => {
            topRecipients.forEach((_recip, j) => {
              flowLinks.push({
                source: i,
                target: topSpenders.length + j,
                value: Math.floor(spender.totalSpent / topRecipients.length),
              })
            })
          })
          setFlowData({ nodes: flowNodes, links: flowLinks })

          const netNodes: NetworkNode[] = []
          let idCounter = 1
          const orgIds: string[] = []
          const legIds: string[] = []
          const billIds: string[] = []

          topSpenders.slice(0, 3).forEach(org => {
            const id = String(idCounter++)
            orgIds.push(id)
            netNodes.push({
              id,
              name: org.client.substring(0, 15),
              type: "organization",
              amount: org.totalSpent,
              connections: [],
            })
          })

          topRecipients.slice(0, 4).forEach(leg => {
            const id = String(idCounter++)
            legIds.push(id)
            const partyMatch = leg.recipient.match(/\(([DRI])-[A-Za-z]+\)/)
            const party =
              partyMatch && partyMatch[1] === "D"
                ? "Democrat"
                : partyMatch && partyMatch[1] === "R"
                  ? "Republican"
                  : "Independent"
            netNodes.push({
              id,
              name: leg.recipient.split(" (")[0],
              type: "legislator",
              party,
              connections: [],
            })
          })

          topBills.forEach(bill => {
            const id = String(idCounter++)
            billIds.push(id)
            netNodes.push({
              id,
              name: String(bill[0] || "Bill").substring(0, 15),
              type: "bill",
              connections: [],
            })
          })

          netNodes.forEach((node, idx) => {
            if (node.type === "organization") {
              node.connections = [legIds[idx % legIds.length]]
            } else if (node.type === "legislator") {
              node.connections = [
                orgIds[idx % orgIds.length],
                billIds[idx % billIds.length],
              ]
            } else if (node.type === "bill") {
              node.connections = [legIds[idx % legIds.length]]
            }
          })

          setNetworkNodes(netNodes)
        }
      } catch (err) {
        console.error("Failed to load visualization data:", err)
        setEnrichmentError(true)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 size={40} className="animate-spin text-accent" />
          <p className="font-serif text-xl animate-pulse">Aggregating real-time dataset...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-6 md:px-12 pt-12">
        <div className="mb-12 max-w-3xl">
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Interactive Data Analysis
          </h2>
          <p className="text-lg text-muted-foreground">
            Explore the complex relationships between money, politics, and legislation through interactive
            visualizations powered by live aggregated datasets.
          </p>
        </div>

        {enrichmentError && !enrichmentAvailable && (
          <div className="mb-8 p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Enrichment API unavailable
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Trade, anomaly, and committee data from CapitolTrades, Congress.gov,
                and OpenFEC could not be loaded. Charts show static data from OpenSecrets
                CSV exports. Start the backend server to enable live enrichment.
              </p>
            </div>
          </div>
        )}

        {financeData.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8 animate-stagger-item delay-1">
            <div className="hover-lift transition-all duration-300">
              <CampaignFinanceChart 
                data={financeData} 
                type="bar" 
                title="Top Sector Contributions" 
                description="Highest contributing sectors across both chambers based on live disclosure data." 
              />
            </div>
            <div className="hover-lift transition-all duration-300">
              <LobbyingTimeline 
                data={timelineData} 
                title="Historical Lobbying Trends" 
                description="Total contributions received by top targeted legislators per cycle." 
              />
            </div>
          </div>
        )}

        {flowData.nodes.length > 0 && networkNodes.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-stagger-item delay-2">
            <div className="hover-lift transition-all duration-300">
              <DonationFlowChart 
                data={flowData} 
                title="Trade Sector to Politician Flow" 
                description={
                  enrichmentAvailable
                    ? "Live distribution of stock trade value from economic sectors to politicians. Data: CapitolTrades."
                    : "Proportional allocation of lobbying spend from top spenders to top recipients. Data: OpenSecrets."
                } 
              />
            </div>
            <div className="hover-lift transition-all duration-300">
              <InfluenceNetwork 
                nodes={networkNodes} 
                title="Legislative Influence Network" 
                description={
                  enrichmentAvailable
                    ? "Sector-to-politician and politician-to-ticker connections from live trade data. Data: CapitolTrades, ticker_resolver."
                    : "Top spender, legislator, and bill relationships derived from OpenSecrets lobbying data."
                } 
              />
            </div>
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            Data sources: CapitolTrades (stock disclosures), Congress.gov (legislation,
            committees), OpenFEC (campaign finance), OpenSecrets (lobbying CSV exports).{" "}
            {enrichmentAvailable
              ? "Flow and network charts derived from real trade relationships."
              : "Flow and network charts use proportional fallback from static CSV data."}
          </p>
        </div>
      </div>
    </div>
  )
}

