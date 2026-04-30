"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import {
    ArrowLeft,
    Building2,
    DollarSign,
    Users,
    FileText,
    TrendingUp,
    ExternalLink,
    AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getRecentFilings, getRegistrants, Filing, Registrant } from "@/lib/services/lobbying"
import { formatCurrency } from "@/lib/format"
export default function OrganizationProfilePage() {
    const { id } = useParams<{ id: string }>()
    const decodedName = decodeURIComponent(id || "")
    const searchName = decodedName.replace(/-/g, " ")

    const [filings, setFilings] = useState<Filing[]>([])
    const [registrant, setRegistrant] = useState<Registrant | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                const [filingsData, registrantsData] = await Promise.all([
                    getRecentFilings(1, 50).catch(() => ({ count: 0, results: [] })),
                    getRegistrants(1, 100).catch(() => ({ count: 0, results: [] })),
                ])

                const matchedFilings = (filingsData.results || []).filter(
                    (f) =>
                        f.registrant.name.toLowerCase().includes(searchName.toLowerCase()) ||
                        (f.client?.name || "").toLowerCase().includes(searchName.toLowerCase())
                )

                const matchedRegistrant = (registrantsData.results || []).find((r) =>
                    r.name.toLowerCase().includes(searchName.toLowerCase())
                )

                setFilings(matchedFilings)
                setRegistrant(matchedRegistrant || null)
            } catch (e) {
                console.error("Organization profile fetch error:", e)
                setError(e instanceof Error ? e.message : "Failed to load organization")
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [id, searchName])

    const totalIncome = filings.reduce((sum, f) => sum + (f.income || 0), 0)
    const totalExpenses = filings.reduce((sum, f) => sum + (f.expenses || 0), 0)
    const uniqueClients = new Set(filings.map((f) => f.client?.name).filter(Boolean))
    const allIssues = new Set(
        filings.flatMap((f) =>
            (f.lobbying_activities || []).map((a) => a.general_issue_area_display).filter(Boolean)
        )
    )

    const issueColorClasses = [
        "border-blue-500/50 text-blue-400 bg-blue-900/20",
        "border-green-500/50 text-green-400 bg-green-900/20",
        "border-purple-500/50 text-purple-400 bg-purple-900/20",
        "border-orange-500/50 text-orange-400 bg-orange-900/20",
        "border-red-500/50 text-red-400 bg-red-900/20",
        "border-yellow-500/50 text-yellow-400 bg-yellow-900/20",
        "border-pink-500/50 text-pink-400 bg-pink-900/20",
        "border-indigo-500/50 text-indigo-400 bg-indigo-900/20",
    ]

    const displayName = registrant?.name || searchName
    const registrantUrl = filings.length > 0 ? filings[0].registrant.url : null

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <header className="border-b border-border bg-card/50 backdrop-blur-sm">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex items-center space-x-4">
                            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Search
                            </Button>
                            <div className="h-6 w-px bg-border" />
                            <h1 className="text-xl font-semibold text-foreground">Organization Profile</h1>
                        </div>
                    </div>
                </header>
                <div className="flex items-center justify-center h-64">
                    <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
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
                            Back to Search
                        </Button>
                        <div className="h-6 w-px bg-border" />
                        <h1 className="text-xl font-semibold text-foreground">Organization Profile</h1>
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

                {filings.length === 0 && !registrant ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm">
                        <AlertTriangle size={48} className="text-muted-foreground mb-6" />
                        <h3 className="font-serif text-3xl font-bold text-primary mb-4">
                            Organization Not Found
                        </h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            No lobbying records found for &ldquo;{searchName}&rdquo;. The organization
                            may not have filed disclosures during the current year, or the Senate LDA API
                            may be unavailable.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="bg-card border border-border rounded-sm shadow-sm p-8 mb-8">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="w-2 h-2 bg-accent rounded-full" />
                                        <span className="font-mono text-xs text-accent font-bold uppercase tracking-wide">
                                            {registrant?.state_display || "Federal"}
                                        </span>
                                    </div>
                                    <h2 className="font-serif text-3xl font-bold text-primary mb-2">
                                        {displayName}
                                    </h2>
                                    {registrant?.description && (
                                        <p className="text-muted-foreground text-sm max-w-2xl mt-2">
                                            {registrant.description}
                                        </p>
                                    )}
                                </div>
                                {registrantUrl && (
                                    <a
                                        href={registrantUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 border border-border text-xs font-mono font-bold uppercase hover:bg-card hover:text-black transition-colors flex items-center gap-2 shrink-0"
                                    >
                                        View on Senate.gov <ExternalLink size={12} />
                                    </a>
                                )}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-muted border border-white/5">
                                    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                        <DollarSign size={14} />
                                        <span className="text-xs">Total Income</span>
                                    </div>
                                    <div className="font-serif text-xl font-bold text-foreground">
                                        {totalIncome > 0 ? formatCurrency(totalIncome) : "N/A"}
                                    </div>
                                </div>
                                <div className="p-4 bg-muted border border-white/5">
                                    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                        <FileText size={14} />
                                        <span className="text-xs">Filings</span>
                                    </div>
                                    <div className="font-serif text-xl font-bold text-foreground">
                                        {filings.length}
                                    </div>
                                </div>
                                <div className="p-4 bg-muted border border-white/5">
                                    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                        <Users size={14} />
                                        <span className="text-xs">Clients</span>
                                    </div>
                                    <div className="font-serif text-xl font-bold text-foreground">
                                        {uniqueClients.size}
                                    </div>
                                </div>
                                <div className="p-4 bg-muted border border-white/5">
                                    <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                        <TrendingUp size={14} />
                                        <span className="text-xs">Issue Areas</span>
                                    </div>
                                    <div className="font-serif text-xl font-bold text-foreground">
                                        {allIssues.size}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="font-serif text-xl font-bold text-primary mb-4">
                                Issue Areas
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(allIssues).map((issue, i) => (
                                    <span
                                        key={issue || i}
                                        className={`px-3 py-1 border text-[10px] font-mono font-bold uppercase ${
                                            issueColorClasses[i % issueColorClasses.length]
                                        }`}
                                    >
                                        {issue}
                                    </span>
                                ))}
                                {allIssues.size === 0 && (
                                    <p className="text-muted-foreground text-sm">No issue areas recorded.</p>
                                )}
                            </div>
                        </div>

                        {uniqueClients.size > 0 && (
                            <div className="mb-8">
                                <h3 className="font-serif text-xl font-bold text-primary mb-4">
                                    Clients ({uniqueClients.size})
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {Array.from(uniqueClients).map((client) => (
                                        <span
                                            key={client}
                                            className="px-3 py-1 border border-border text-xs font-mono font-bold uppercase bg-muted"
                                        >
                                            {client}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="font-serif text-xl font-bold text-primary mb-4">
                                Recent Filings
                            </h3>
                            <div className="space-y-4">
                                {filings.slice(0, 20).map((f, i) => (
                                    <div
                                        key={f.filing_uuid || i}
                                        className="p-6 bg-card border border-border rounded-sm"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-medium text-foreground">
                                                    {f.filing_type_display || f.filing_type}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Period: {f.filing_period_display || f.filing_period} |{" "}
                                                    Posted: {f.dt_posted?.split("T")[0]}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-foreground">
                                                    {f.income ? formatCurrency(f.income) : "N/A"}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground uppercase">
                                                    Income
                                                </p>
                                            </div>
                                        </div>
                                        {f.client && (
                                            <p className="text-xs text-muted-foreground mb-2">
                                                Client: {f.client.name}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-1">
                                            {(f.lobbying_activities || [])
                                                .slice(0, 5)
                                                .map((a, j) => (
                                                    <span
                                                        key={j}
                                                        className={`px-2 py-0.5 border text-[10px] font-mono font-bold uppercase ${
                                                            issueColorClasses[
                                                                (a.general_issue_area_display || "").length %
                                                                    issueColorClasses.length
                                                            ]
                                                        }`}
                                                    >
                                                        {a.general_issue_area_display}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
