"use client"

import { useState, useEffect } from "react"
import { DollarSign, TrendingUp, TrendingDown, Info, AlertTriangle } from "lucide-react"
import { getEnrichedTrades, EnrichedTrade } from "@/lib/services/enrichment"

export default function NetWorthPage() {
    const [trades, setTrades] = useState<EnrichedTrade[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                const data = await getEnrichedTrades()
                setTrades(data)
            } catch (e: any) {
                console.error("Net worth data fetch error:", e)
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    const memberTotals = new Map<string, { name: string; buys: number; sells: number; count: number }>()
    trades.forEach((t) => {
        const existing = memberTotals.get(t.politician_name) || {
            name: t.politician_name,
            buys: 0,
            sells: 0,
            count: 0,
        }
        if (t.trade_type === "BUY") existing.buys += t.estimated_value
        if (t.trade_type === "SELL") existing.sells += t.estimated_value
        existing.count += 1
        memberTotals.set(t.politician_name, existing)
    })

    const sortedMembers = Array.from(memberTotals.entries())
        .map(([name, data]) => ({
            ...data,
            name,
            net: data.buys - data.sells,
        }))
        .sort((a, b) => b.buys + b.sells - (a.buys + b.sells))

    const sectorTotals = new Map<string, number>()
    trades.forEach((t) => {
        if (t.sector && t.sector !== "Unknown") {
            const existing = sectorTotals.get(t.sector) || 0
            sectorTotals.set(t.sector, existing + t.estimated_value)
        }
    })

    const topSectors = Array.from(sectorTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)

    const estimatedTotalVolume = trades.reduce((sum, t) => sum + t.estimated_value, 0)

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <div className="container mx-auto px-6 md:px-12 py-12">
                    <div className="flex items-center justify-center h-64">
                        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-6 md:px-12 py-12">
                <div className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                            <DollarSign size={20} strokeWidth={2} />
                        </div>
                        <h2 className="font-serif text-4xl md:text-5xl font-bold text-primary">
                            Congressional Net Worth
                        </h2>
                    </div>
                    <p className="text-lg text-muted-foreground max-w-3xl">
                        Estimated portfolio values and sector allocation derived from public financial
                        disclosures filed under the STOCK Act. Data sourced from CapitolTrades.
                    </p>
                </div>

                {error && (
                    <div className="flex items-center gap-3 p-4 border border-red-500/30 bg-red-950/20 text-red-400 rounded-sm mb-8 font-mono text-sm">
                        <AlertTriangle size={16} />
                        <span>API unavailable: {error}. Showing limited data.</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="p-6 bg-card border border-border rounded-sm shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                            Estimated Trade Volume
                        </p>
                        <p className="font-serif text-3xl font-bold text-primary">
                            {estimatedTotalVolume > 0 ? formatCurrency(estimatedTotalVolume) : "No data"}
                        </p>
                    </div>
                    <div className="p-6 bg-card border border-border rounded-sm shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                            Disclosed Trades
                        </p>
                        <p className="font-serif text-3xl font-bold text-primary">{trades.length}</p>
                    </div>
                    <div className="p-6 bg-card border border-border rounded-sm shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                            Data Source
                        </p>
                        <p className="font-serif text-xl font-bold text-primary">CapitolTrades</p>
                        <p className="text-xs text-muted-foreground mt-1">STOCK Act Period Disclosures</p>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-sm shadow-sm p-8 mb-12">
                    <div className="flex items-center gap-2 mb-4">
                        <Info size={16} className="text-accent" />
                        <h3 className="font-serif text-2xl font-bold text-primary">Methodology</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                        Net worth estimation from trade disclosures is inherently approximate. Disclosure
                        forms report transaction value ranges (e.g., $1,001-$15,000) rather than exact
                        dollar amounts, as permitted by the STOCK Act. This page uses the minimum value
                        of each reported range as a conservative estimate, following the methodology
                        developed by GovTrades and NOTUS Capitol Gains.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="p-4 bg-muted border border-white/5">
                            <p className="text-muted-foreground mb-2">
                                <strong className="text-foreground">Disclosure Lag:</strong> Reports may
                                be filed up to 45 days after a transaction. This means the data shown here
                                reflects a delayed view of actual holdings.
                            </p>
                        </div>
                        <div className="p-4 bg-muted border border-white/5">
                            <p className="text-muted-foreground mb-2">
                                <strong className="text-foreground">Value Ranges:</strong> The STOCK Act
                                uses broad value brackets. Estimated values are floor-of-range
                                calculations and may significantly understate actual portfolio values.
                            </p>
                        </div>
                    </div>
                </div>

                {trades.length > 0 ? (
                    <>
                        <div className="mb-12">
                            <h3 className="font-serif text-2xl font-bold text-primary mb-6">
                                Top Sector Allocation
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                {topSectors.map(([sector, value]) => (
                                    <div
                                        key={sector}
                                        className="p-4 bg-card border border-border rounded-sm shadow-sm text-center"
                                    >
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                            {sector}
                                        </p>
                                        <p className="font-serif text-lg font-bold text-primary">
                                            {formatCurrency(value)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-serif text-2xl font-bold text-primary mb-6">
                                Estimated Activity by Member
                            </h3>
                            <div className="overflow-x-auto border border-border rounded-sm">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted">
                                            <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                Member
                                            </th>
                                            <th className="text-right p-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                Purchases
                                            </th>
                                            <th className="text-right p-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                Sales
                                            </th>
                                            <th className="text-right p-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                Trades
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedMembers.slice(0, 30).map((m, i) => (
                                            <tr
                                                key={m.name}
                                                className={`border-b border-border hover:bg-muted transition-colors ${
                                                    i % 2 === 0 ? "bg-card" : "bg-card/50"
                                                }`}
                                            >
                                                <td className="p-4 font-medium text-foreground">
                                                    {m.name}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="flex items-center justify-end gap-1 text-green-500">
                                                        <TrendingUp size={12} />
                                                        {m.buys > 0 ? formatCurrency(m.buys) : "--"}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="flex items-center justify-end gap-1 text-red-500">
                                                        <TrendingDown size={12} />
                                                        {m.sells > 0 ? formatCurrency(m.sells) : "--"}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right text-muted-foreground font-mono">
                                                    {m.count}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm">
                        <AlertTriangle size={48} className="text-muted-foreground mb-6" />
                        <h3 className="font-serif text-3xl font-bold text-primary mb-4">
                            No Trade Data Available
                        </h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            The enrichment API returned no trades. This may be because the backend is not
                            running or the CapitolTrades API is unavailable. Start the backend with{" "}
                            <code className="px-2 py-0.5 bg-muted rounded text-xs">cargo run -p backend_server</code>{" "}
                            and refresh.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
