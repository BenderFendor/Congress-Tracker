"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
    Search,
    Building2,
    DollarSign,
    Users,
    FileText,
    TrendingUp,
    ExternalLink,
    HardHat,
    BarChart3,
} from "lucide-react"
import { getRecentFilings, getRegistrants, getLobbyingRegistrants, getLobbyingClients, getLobbyingContributions, Filing, Registrant, LobbyingClient, Contribution } from "@/lib/services/lobbying"

const currentYear = new Date().getFullYear()
const CLIENTS_PER_PAGE = 25

export default function LobbyingPage() {
    const [filings, setFilings] = useState<Filing[]>([])
    const [registrants, setRegistrants] = useState<Registrant[]>([])
    const [clients, setClients] = useState<LobbyingClient[]>([])
    const [clientSearchTerm, setClientSearchTerm] = useState("")
    const [clientPage, setClientPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedYear, setSelectedYear] = useState(currentYear.toString())
    const [activeTab, setActiveTab] = useState("filings")

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    useEffect(() => {
        const fetchLobbyingData = async () => {
            try {
                setLoading(true)

                const [filingsData, registrantsData, backendRegistrants, clientsData, contribData] = await Promise.all([
                    getRecentFilings(1, 50),
                    getRegistrants(1, 50),
                    getLobbyingRegistrants({ page_size: 50 }),
                    getLobbyingClients({ page_size: 200 }),
                    getLobbyingContributions({ year: Number(currentYear) }),
                ])

                setFilings(filingsData.results || [])
                setRegistrants(backendRegistrants?.results || registrantsData.results || [])
                setClients(clientsData?.results || [])
            } catch (e: any) {
                console.error("Lobbying data fetch error:", e)
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }

        fetchLobbyingData()
    }, [])

    const registrantFilings = new Map<number, Filing[]>()
    filings.forEach((filing) => {
        const registrantId = filing.registrant.id
        if (!registrantFilings.has(registrantId)) {
            registrantFilings.set(registrantId, [])
        }
        registrantFilings.get(registrantId)?.push(filing)
    })

    const lobbyingOrganizations = Array.from(registrantFilings.entries()).map(
        ([registrantId, orgFilings]) => {
            const registrant = orgFilings[0].registrant
            const totalIncome = orgFilings.reduce(
                (sum, filing) => sum + (filing.income || 0),
                0
            )
            const totalExpenses = orgFilings.reduce(
                (sum, filing) => sum + (filing.expenses || 0),
                0
            )
            const uniqueClients = new Set(
                orgFilings.map((f) => f.client?.name).filter(Boolean)
            )
            const allIssues = new Set(
                orgFilings.flatMap(
                    (f) =>
                        f.lobbying_activities
                            ?.map((a) => a.general_issue_area_display)
                            .filter(Boolean) || []
                )
            )

            return {
                id: registrantId,
                registrant,
                filings: orgFilings,
                totalIncome,
                totalExpenses,
                clientCount: uniqueClients.size,
                issueAreas: Array.from(allIssues).slice(0, 5),
                mostRecentFiling: orgFilings[0],
            }
        }
    )

    const filteredOrgs = lobbyingOrganizations.filter((org) => {
        const matchesSearch =
            org.registrant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            org.issueAreas.some(
                (issue) => issue && issue.toLowerCase().includes(searchTerm.toLowerCase())
            )
        return matchesSearch
    })

    const getIssueColor = (issue: string) => {
        const colors = [
            "border-blue-500/50 text-blue-400 bg-blue-900/20",
            "border-green-500/50 text-green-400 bg-green-900/20",
            "border-purple-500/50 text-purple-400 bg-purple-900/20",
            "border-orange-500/50 text-orange-400 bg-orange-900/20",
            "border-red-500/50 text-red-400 bg-red-900/20",
            "border-yellow-500/50 text-yellow-400 bg-yellow-900/20",
            "border-pink-500/50 text-pink-400 bg-pink-900/20",
            "border-indigo-500/50 text-indigo-400 bg-indigo-900/20",
        ]
        if (!issue || typeof issue !== "string") {
            return colors[0]
        }
        const index = issue.length % colors.length
        return colors[index]
    }

    const topSpenders = [...lobbyingOrganizations]
        .sort((a, b) => b.totalIncome - a.totalIncome)
        .slice(0, 10)

    const topFirms = [...registrants]
        .sort((a, b) => (b.name > a.name ? -1 : 1))
        .slice(0, 15)

    const issueSpend = new Map<string, number>()
    filings.forEach((f) => {
        const income = f.income || 0
        ;(f.lobbying_activities || []).forEach((a) => {
            if (a.general_issue_area_display) {
                const existing = issueSpend.get(a.general_issue_area_display) || 0
                issueSpend.set(a.general_issue_area_display, existing + income)
            }
        })
    })
    const topIssues = Array.from(issueSpend.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)

    const clientSpend = new Map<string, number>()
    filings.forEach((f) => {
        if (f.client?.name) {
            const existing = clientSpend.get(f.client.name) || 0
            clientSpend.set(f.client.name, existing + (f.income || 0))
        }
    })
    const topRecipients = [...clients]
        .filter((c) => clientSpend.has(c.name))
        .map((c) => ({
            ...c,
            totalSpend: clientSpend.get(c.name) || 0,
        }))
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, 10)

    const renderTopSpenders = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {topSpenders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm">
                    <HardHat size={48} className="text-muted-foreground mb-6" />
                    <h3 className="font-serif text-3xl font-bold text-primary mb-4">
                        Top Spenders
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Spending data unavailable. The Senate LDA API may not be configured. Set
                        SENATE_LDA_API_KEY in your environment and restart the backend.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {topSpenders.map((org, i) => (
                        <Link
                            key={org.id}
                            href={`/lobbying/${encodeURIComponent(org.registrant.name.replace(/\s+/g, "-"))}`}
                            className="block bg-card border-2 border-border p-6 hover:border-accent/50 transition-all duration-300 group"
                        >
                            <div className="flex items-center gap-4">
                                <span className="font-mono text-2xl text-muted-foreground/40 font-bold w-8">
                                    {i + 1}
                                </span>
                                <div className="flex-1">
                                    <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                                        {org.registrant.name}
                                    </h3>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                        <span>{org.filings.length} filings</span>
                                        <span>{org.clientCount} clients</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-serif text-xl font-bold text-foreground">
                                        {formatCurrency(org.totalIncome)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase">
                                        Total Income
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )

    const renderTopFirms = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {topFirms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm">
                    <HardHat size={48} className="text-muted-foreground mb-6" />
                    <h3 className="font-serif text-3xl font-bold text-primary mb-4">
                        Top Lobbying Firms
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Registrant data unavailable. The Senate LDA API may not be configured. Set
                        SENATE_LDA_API_KEY in your environment and restart the backend.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {topFirms.map((firm) => (
                        <Link
                            key={firm.id}
                            href={`/lobbying/${encodeURIComponent(firm.name.replace(/\s+/g, "-"))}`}
                            className="block bg-card border-2 border-border p-6 hover:border-accent/50 transition-all duration-300 group"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <Building2 size={16} className="text-accent" />
                                <span className="font-mono text-[10px] text-accent font-bold uppercase">
                                    {firm.state_display || "Federal"}
                                </span>
                            </div>
                            <h3 className="font-serif text-lg font-bold text-foreground group-hover:text-accent transition-colors mb-2">
                                {firm.name}
                            </h3>
                            {firm.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {firm.description}
                                </p>
                            )}
                            <div className="mt-3">
                                <a
                                    href={firm.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-mono uppercase text-muted-foreground hover:text-accent transition-colors flex items-center gap-1"
                                >
                                    Senate.gov <ExternalLink size={10} />
                                </a>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )

    const renderIndustrySpend = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {topIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm">
                    <HardHat size={48} className="text-muted-foreground mb-6" />
                    <h3 className="font-serif text-3xl font-bold text-primary mb-4">
                        Industry Spend
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Issue data unavailable. The Senate LDA API may not be configured. Set
                        SENATE_LDA_API_KEY in your environment and restart the backend.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {topIssues.map(([issue, spend], i) => {
                        const maxSpend = topIssues[0]?.[1] || 1
                        const pct = Math.round((spend / maxSpend) * 100)
                        return (
                            <div
                                key={issue}
                                className="bg-card border-2 border-border p-6"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono text-sm text-muted-foreground w-6">
                                            {i + 1}
                                        </span>
                                        <span className="font-medium text-foreground">{issue}</span>
                                    </div>
                                    <span className="font-serif text-lg font-bold text-foreground">
                                        {formatCurrency(spend)}
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-accent rounded-full transition-all duration-700"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )

    const renderTopRecipients = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {topRecipients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm">
                    <HardHat size={48} className="text-muted-foreground mb-6" />
                    <h3 className="font-serif text-3xl font-bold text-primary mb-4">
                        Top Recipients
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Recipient data unavailable. The Senate LDA API may not be configured. Set
                        SENATE_LDA_API_KEY in your environment and restart the backend.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {topRecipients.map((client, i) => {
                        const filingsForClient = filings.filter(
                            (f) => f.client?.name === client.name
                        )
                        const registrantsForClient = new Set(
                            filingsForClient.map((f) => f.registrant.name)
                        )
                        return (
                            <div
                                key={client.id}
                                className="bg-card border-2 border-border p-6 hover:border-accent/50 transition-all duration-300 group"
                            >
                                <div className="flex items-center gap-4">
                                    <span className="font-mono text-2xl text-muted-foreground/40 font-bold w-8">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1">
                                        <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                                            {client.name}
                                        </h3>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                            <span className="flex items-center gap-1">
                                                <Building2 size={12} />
                                                {registrantsForClient.size} registrant
                                                {registrantsForClient.size !== 1 ? "s" : ""}
                                            </span>
                                            <span>{filingsForClient.length} filings</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-serif text-xl font-bold text-foreground">
                                            {formatCurrency(client.totalSpend)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground uppercase">
                                            Total Lobbying
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )

    const filteredClients = clients.filter(
        (c) =>
            c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
            (c.description &&
                c.description.toLowerCase().includes(clientSearchTerm.toLowerCase()))
    )
    const totalClientPages = Math.ceil(filteredClients.length / CLIENTS_PER_PAGE)
    const paginatedClients = filteredClients.slice(
        (clientPage - 1) * CLIENTS_PER_PAGE,
        clientPage * CLIENTS_PER_PAGE
    )

    const renderClients = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm">
                    <HardHat size={48} className="text-muted-foreground mb-6" />
                    <h3 className="font-serif text-3xl font-bold text-primary mb-4">
                        Lobbying Clients
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Client data unavailable. The Senate LDA API may not be configured. Set
                        SENATE_LDA_API_KEY in your environment and restart the backend.
                    </p>
                </div>
            ) : (
                <>
                    <div className="relative group mb-8">
                        <Search
                            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="SEARCH CLIENTS..."
                            value={clientSearchTerm}
                            onChange={(e) => {
                                setClientSearchTerm(e.target.value)
                                setClientPage(1)
                            }}
                            className="w-full bg-card border-2 border-border px-12 py-3 text-foreground font-mono text-sm font-bold placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-all uppercase tracking-wider"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        {paginatedClients.map((client) => (
                            <div
                                key={client.id}
                                className="bg-card border-2 border-border p-6 hover:border-accent/50 transition-all duration-300 group"
                            >
                                <h3 className="font-serif text-lg font-bold text-foreground group-hover:text-accent transition-colors mb-2">
                                    {client.name}
                                </h3>
                                {client.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                                        {client.description}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 mb-3">
                                    {client.state && (
                                        <span className="font-mono text-[10px] text-accent font-bold uppercase border border-accent/30 px-2 py-0.5">
                                            {client.state}
                                        </span>
                                    )}
                                    {client.country &&
                                        client.country !== "United States" && (
                                            <span className="font-mono text-[10px] text-muted-foreground font-bold uppercase border border-border px-2 py-0.5">
                                                {client.country}
                                            </span>
                                        )}
                                </div>
                                <a
                                    href={client.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-mono uppercase text-muted-foreground hover:text-accent transition-colors flex items-center gap-1"
                                >
                                    Senate.gov <ExternalLink size={10} />
                                </a>
                            </div>
                        ))}
                    </div>

                    {totalClientPages > 1 && (
                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={() => setClientPage((p) => Math.max(1, p - 1))}
                                disabled={clientPage === 1}
                                className="px-4 py-2 bg-muted border-2 border-border text-foreground font-mono text-xs font-bold hover:bg-accent hover:text-black hover:border-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <span className="font-mono text-sm text-muted-foreground px-4">
                                Page {clientPage} of {totalClientPages}
                            </span>
                            <button
                                onClick={() =>
                                    setClientPage((p) => Math.min(totalClientPages, p + 1))
                                }
                                disabled={clientPage === totalClientPages}
                                className="px-4 py-2 bg-muted border-2 border-border text-foreground font-mono text-xs font-bold hover:bg-accent hover:text-black hover:border-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent text-accent-foreground selection:text-foreground pb-20">
            <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">
                <div className="mb-12">
                    <h2 className="font-serif text-5xl md:text-6xl font-bold text-foreground mb-4 leading-none tracking-tight">
                        INFLUENCE <span className="text-accent">TRACKER</span>
                    </h2>
                    <p className="font-mono text-muted-foreground max-w-xl text-sm uppercase tracking-wide">
                        Follow the flow of money and political influence. Comprehensive data from
                        Senate filings.
                    </p>
                </div>

                <div className="flex border-b-2 border-border mb-8 overflow-x-auto">
                    {["filings", "spenders", "firms", "industries", "recipients", "clients"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-8 py-4 font-sans text-sm font-semibold tracking-wide transition-all relative ${
                                activeTab === tab
                                    ? "text-accent"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {tab === "filings"
                                ? "Recent Filings"
                                : tab === "spenders"
                                  ? "Top Spenders"
                                  : tab === "firms"
                                    ? "Top Firms"
                                    : tab === "industries"
                                      ? "Industry Spend"
                                      : tab === "clients"
                                        ? "Clients"
                                        : "Top Recipients"}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent text-accent-foreground" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="min-h-[400px]">
                    {loading && activeTab === "filings" ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : error && activeTab === "filings" ? (
                        <div className="flex items-center justify-center h-64 text-red-500 font-mono">
                            Error: {error}
                        </div>
                    ) : (
                        <>
                            {activeTab === "filings" && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex flex-col md:flex-row gap-4 mb-8">
                                        <div className="relative group flex-1">
                                            <Search
                                                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors"
                                                size={18}
                                            />
                                            <input
                                                type="text"
                                                placeholder="SEARCH ORGANIZATIONS..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full bg-card border-2 border-border px-12 py-3 text-foreground font-mono text-sm font-bold placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-all uppercase tracking-wider"
                                            />
                                        </div>

                                        <select
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(e.target.value)}
                                            className="w-full md:w-48 bg-card border-2 border-border px-4 py-3 text-foreground font-sans text-sm font-semibold focus:border-accent outline-none appearance-none cursor-pointer"
                                        >
                                            <option value={currentYear.toString()}>{currentYear}</option>
                                            <option value={(currentYear - 1).toString()}>
                                                {currentYear - 1}
                                            </option>
                                            <option value={(currentYear - 2).toString()}>
                                                {currentYear - 2}
                                            </option>
                                        </select>

                                        <button
                                            onClick={() => window.location.reload()}
                                            className="px-6 py-3 bg-muted border-2 border-border text-foreground font-sans text-sm font-semibold hover:bg-accent hover:text-accent-foreground hover:text-black hover:border-accent transition-all"
                                        >
                                            Refresh
                                        </button>
                                    </div>

                                    <div className="grid gap-6">
                                        {filteredOrgs.map((org) => (
                                            <div
                                                key={org.id}
                                                className="bg-card border-2 border-border p-8 hover:border-accent/50 transition-all duration-300 group"
                                            >
                                                <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className="w-2 h-2 bg-accent text-accent-foreground rounded-full" />
                                                            <span className="font-mono text-xs text-accent font-bold uppercase tracking-wide">
                                                                Registrant
                                                            </span>
                                                            <span className="font-mono text-xs text-muted-foreground uppercase border border-border px-2 py-0.5">
                                                                {org.registrant.state_display || "Federal"}
                                                            </span>
                                                        </div>
                                                        <h3 className="font-serif text-3xl font-bold text-foreground mb-2">
                                                            {org.registrant.name}
                                                        </h3>
                                                        <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground uppercase">
                                                            <span>
                                                                {org.filings.length} filings this year
                                                            </span>
                                                            <span className="text-gray-700">|</span>
                                                            <span>{org.clientCount} clients</span>
                                                        </div>
                                                    </div>

                                                    <a
                                                        href={org.registrant.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-4 py-2 border border-border text-xs font-mono font-bold uppercase hover:bg-card hover:text-black transition-colors flex items-center gap-2"
                                                    >
                                                        View Details <ExternalLink size={12} />
                                                    </a>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                                    <div className="p-4 bg-muted border border-white/5">
                                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                            <DollarSign size={14} />
                                                            <span className="font-sans text-xs text-muted-foreground">
                                                                Total Income
                                                            </span>
                                                        </div>
                                                        <div className="font-serif text-xl font-bold text-foreground">
                                                            {org.totalIncome > 0
                                                                ? formatCurrency(org.totalIncome)
                                                                : "N/A"}
                                                        </div>
                                                    </div>

                                                    <div className="p-4 bg-muted border border-white/5">
                                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                            <FileText size={14} />
                                                            <span className="font-sans text-xs text-muted-foreground">
                                                                Filings
                                                            </span>
                                                        </div>
                                                        <div className="font-serif text-xl font-bold text-foreground">
                                                            {org.filings.length}
                                                        </div>
                                                    </div>

                                                    <div className="p-4 bg-muted border border-white/5">
                                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                            <Users size={14} />
                                                            <span className="font-sans text-xs text-muted-foreground">
                                                                Clients
                                                            </span>
                                                        </div>
                                                        <div className="font-serif text-xl font-bold text-foreground">
                                                            {org.clientCount}
                                                        </div>
                                                    </div>

                                                    <div className="p-4 bg-muted border border-white/5">
                                                        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                            <TrendingUp size={14} />
                                                            <span className="font-sans text-xs text-muted-foreground">
                                                                Issue Areas
                                                            </span>
                                                        </div>
                                                        <div className="font-serif text-xl font-bold text-foreground">
                                                            {org.issueAreas.length}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {org.issueAreas.map((issue, index) => (
                                                        <span
                                                            key={index}
                                                            className={`px-2 py-1 border text-[10px] font-mono font-bold uppercase ${getIssueColor(issue)}`}
                                                        >
                                                            {issue}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === "spenders" && renderTopSpenders()}
                            {activeTab === "firms" && renderTopFirms()}
                            {activeTab === "industries" && renderIndustrySpend()}
                            {activeTab === "recipients" && renderTopRecipients()}
                            {activeTab === "clients" && renderClients()}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
