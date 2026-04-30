"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, FileText, Building2, TrendingUp, Info, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getRecentBills, Bill } from "@/lib/services/bills"
import { getRecentFilings, Filing } from "@/lib/services/lobbying"
import { getEnrichedTrades, EnrichedTrade } from "@/lib/services/enrichment"

export default function BillDetailPage() {
    const { id } = useParams<{ id: string }>()
    const [bill, setBill] = useState<Bill | null>(null)
    const [relatedFilings, setRelatedFilings] = useState<Filing[]>([])
    const [relatedTrades, setRelatedTrades] = useState<EnrichedTrade[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                const bills = await getRecentBills(50)
                const found = bills.find((b) => b.id === id) || null
                setBill(found)

                if (found) {
                    const keywords = (found.title || "")
                        .split(/[\s,]+/)
                        .filter((w) => w.length > 3)
                        .slice(0, 2)

                    const [filingsData, tradesData] = await Promise.all([
                        getRecentFilings(1, 10).catch(() => ({ count: 0, results: [] })),
                        getEnrichedTrades().catch(() => []),
                    ])

                    const matched = (filingsData.results || []).filter((f) => {
                        const issues = f.lobbying_activities
                            ?.map((a) => a.general_issue_area_display)
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase()
                        return keywords.some((kw) => issues?.includes(kw.toLowerCase()))
                    })
                    setRelatedFilings(matched.slice(0, 5))
                    setRelatedTrades(tradesData.slice(0, 10))
                }
            } catch (e: any) {
                console.error("Bill detail fetch error:", e)
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [id])

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <header className="border-b border-border bg-card/50 backdrop-blur-sm">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex items-center space-x-4">
                            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Bills
                            </Button>
                            <div className="h-6 w-px bg-border" />
                            <h1 className="text-xl font-semibold text-foreground">Bill Details</h1>
                        </div>
                    </div>
                </header>
                <div className="flex items-center justify-center h-64">
                    <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    if (!bill) {
        return (
            <div className="min-h-screen bg-background">
                <header className="border-b border-border bg-card/50 backdrop-blur-sm">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex items-center space-x-4">
                            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Bills
                            </Button>
                            <div className="h-6 w-px bg-border" />
                            <h1 className="text-xl font-semibold text-foreground">Bill Details</h1>
                        </div>
                    </div>
                </header>
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm">
                        <AlertTriangle size={48} className="text-muted-foreground mb-6" />
                        <h3 className="font-serif text-3xl font-bold text-primary mb-4">
                            Bill Not Found
                        </h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            Bill <code className="px-2 py-0.5 bg-muted rounded text-xs">{id}</code> was
                            not found. It may have been archived or the Congress.gov API may be
                            unavailable.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-card/50 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center space-x-4">
                        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Bills
                        </Button>
                        <div className="h-6 w-px bg-border" />
                        <h1 className="text-xl font-semibold text-foreground">Bill Details</h1>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-12">
                {error && (
                    <div className="flex items-center gap-3 p-4 border border-red-500/30 bg-red-950/20 text-red-400 rounded-sm mb-8 font-mono text-sm">
                        <AlertTriangle size={16} />
                        <span>Partial data: {error}</span>
                    </div>
                )}

                <div className="bg-card border border-border rounded-sm shadow-sm p-8 mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-xs text-accent font-bold uppercase tracking-wide bg-accent/10 px-2 py-0.5 rounded-sm">
                            {bill.id}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground uppercase">
                            {bill.status}
                        </span>
                    </div>
                    <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-4">
                        {bill.title}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <FileText size={14} />
                            Last Updated: {bill.date}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    <div className="lg:col-span-2 bg-card border border-border rounded-sm shadow-sm p-8">
                        <h3 className="font-serif text-xl font-bold text-primary mb-6">
                            Legislative History
                        </h3>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <div className="w-3 h-3 bg-accent rounded-full" />
                                    <div className="w-px h-full bg-border" />
                                </div>
                                <div className="pb-6">
                                    <p className="text-sm text-muted-foreground mb-1">{bill.date}</p>
                                    <p className="font-medium text-foreground">
                                        Latest action: {bill.status}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <div className="w-3 h-3 bg-muted-foreground/40 rounded-full" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">
                                        Full legislative timeline
                                    </p>
                                    <p className="text-muted-foreground">
                                        Detailed action history is available via the{" "}
                                        <a
                                            href={bill.url || "https://www.congress.gov"}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent hover:underline"
                                        >
                                            Congress.gov
                                        </a>{" "}
                                        bill page.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-sm shadow-sm p-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Info size={16} className="text-accent" />
                            <h3 className="font-serif text-xl font-bold text-primary">Data Sources</h3>
                        </div>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                                <FileText size={14} className="mt-0.5 shrink-0" />
                                <span>
                                    <strong className="text-foreground">Congress.gov API</strong>: bill
                                    text and status
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Building2 size={14} className="mt-0.5 shrink-0" />
                                <span>
                                    <strong className="text-foreground">Senate LDA API</strong>: lobbying
                                    cross-reference
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <TrendingUp size={14} className="mt-0.5 shrink-0" />
                                <span>
                                    <strong className="text-foreground">CapitolTrades</strong>: stock
                                    trade correlation
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-card border border-border rounded-sm shadow-sm p-8">
                        <h3 className="font-serif text-xl font-bold text-primary mb-6">
                            Related Lobbying Activity
                        </h3>
                        {relatedFilings.length > 0 ? (
                            <div className="space-y-4">
                                {relatedFilings.map((f, i) => (
                                    <div
                                        key={f.filing_uuid || i}
                                        className="p-4 bg-muted border border-white/5"
                                    >
                                        <p className="font-medium text-foreground mb-1">
                                            {f.registrant.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Client: {f.client?.name || "Self"} | Posted:{" "}
                                            {f.dt_posted?.split("T")[0]}
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {f.lobbying_activities
                                                ?.slice(0, 3)
                                                .map((a, j) => (
                                                    <span
                                                        key={j}
                                                        className="px-2 py-0.5 border text-[10px] font-mono font-bold uppercase border-blue-500/30 text-blue-400 bg-blue-900/20"
                                                    >
                                                        {a.general_issue_area_display}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                No lobbying filings found matching bill keywords. Lobbying
                                cross-referencing matches on shared issue areas where available.
                            </p>
                        )}
                    </div>

                    <div className="bg-card border border-border rounded-sm shadow-sm p-8">
                        <h3 className="font-serif text-xl font-bold text-primary mb-6">
                            Recent Trade Activity
                        </h3>
                        {relatedTrades.length > 0 ? (
                            <div className="space-y-4">
                                {relatedTrades.slice(0, 8).map((t, i) => (
                                    <div
                                        key={i}
                                        className="p-4 bg-muted border border-white/5"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="font-medium text-foreground">
                                                {t.politician_name}
                                            </p>
                                            <span
                                                className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 ${
                                                    t.trade_type === "BUY"
                                                        ? "text-green-500 bg-green-900/20"
                                                        : t.trade_type === "SELL"
                                                          ? "text-red-500 bg-red-900/20"
                                                          : "text-muted-foreground bg-muted"
                                                }`}
                                            >
                                                {t.trade_type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {t.ticker} &mdash; {t.asset_description} |{" "}
                                            {formatCurrency(t.estimated_value)}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {t.trade_date} | Sector: {t.sector || "Unknown"}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                No recent trades available for cross-reference. Trade correlation
                                requires the CapitolTrades enrichment API to be available.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
