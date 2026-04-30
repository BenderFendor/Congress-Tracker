"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, TrendingUp, Calendar, Building, ArrowUpRight, ArrowDownRight, BarChart3, PieChart, DollarSign, Users, MapPin, Filter, ExternalLink } from "lucide-react"
import { fetchPoliticians, fetchTrades, Politician, Trade } from "@/lib/api"
import { getAllSectors, SectorInfo } from "@/lib/services/enrichment"

interface PortfolioStats {
    totalVolume: number;
    totalTrades: number;
    buyTrades: number;
    sellTrades: number;
    topTickers: string[];
}

export default function PortfolioPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedPolitician, setSelectedPolitician] = useState<string | null>(null)
    const [politicians, setPoliticians] = useState<Politician[]>([])
    const [trades, setTrades] = useState<Trade[]>([])
    const [sectors, setSectors] = useState<SectorInfo[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("overview")

    useEffect(() => {
        async function loadData() {
            try {
                const [politiciansData, tradesData, sectorsData] = await Promise.all([
                    fetchPoliticians(),
                    fetchTrades(),
                    getAllSectors()
                ]);
                setPoliticians(politiciansData.data);
                setTrades(tradesData.data);
                setSectors(sectorsData);
            } catch (error) {
                console.error("Failed to load portfolio data", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Filter trades by selected politician
    const filteredTrades = selectedPolitician
        ? trades.filter(t => t.representative && t.representative.toLowerCase().includes(selectedPolitician.toLowerCase()))
        : trades;

    // Calculate portfolio statistics
    const stats: PortfolioStats = filteredTrades.reduce((acc, trade) => {
        const volume = 0; // Volume not available in current data structure
        const tradeType = trade.type || "";
        return {
            totalVolume: acc.totalVolume + volume,
            totalTrades: acc.totalTrades + 1,
            buyTrades: acc.buyTrades + (tradeType.toLowerCase().includes("purchase") ? 1 : 0),
            sellTrades: acc.sellTrades + (tradeType.toLowerCase().includes("sale") ? 1 : 0),
            topTickers: acc.topTickers
        };
    }, { totalVolume: 0, totalTrades: 0, buyTrades: 0, sellTrades: 0, topTickers: [] as string[] });

    // Group trades by politician
    const tradesByPolitician = trades.reduce((acc, trade) => {
        const name = trade.representative || "Unknown";
        if (!acc[name]) {
            acc[name] = [];
        }
        acc[name].push(trade);
        return acc;
    }, {} as Record<string, Trade[]>);

    // Calculate politician stats
    const politicianStats = Object.entries(tradesByPolitician).map(([name, politicianTrades]) => {
        const buyCount = politicianTrades.filter(t => (t.type || "").toLowerCase().includes("purchase")).length;
        const sellCount = politicianTrades.filter(t => (t.type || "").toLowerCase().includes("sale")).length;
        const uniqueTickers = [...new Set(politicianTrades.map(t => t.ticker))];

        return {
            name,
            totalTrades: politicianTrades.length,
            buyCount,
            sellCount,
            uniqueTickers,
            recentTrades: politicianTrades.slice(0, 3)
        };
    });

    // Filter politician stats by search term
    const filteredPoliticianStats = politicianStats.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent text-accent-foreground selection:text-foreground pb-20">
            <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">
                {/* Header */}
                <div className="mb-12">
                    <h2 className="font-serif text-5xl md:text-6xl font-bold text-foreground mb-4 leading-none tracking-tight">
                        CONGRESS <span className="text-accent">PORTFOLIOS</span>
                    </h2>
                    <p className="font-mono text-muted-foreground max-w-xl text-sm uppercase tracking-wide">
                        Analyze stock trading portfolios and patterns of congressional members.
                    </p>
                </div>

                {/* Search and Filter */}
                <div className="mb-12 animate-stagger-item delay-1">
                    <div className="flex flex-col lg:flex-row gap-6 mb-8">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-accent" size={20} />
                            <input
                                type="text"
                                placeholder="SEARCH BY POLITICIAN NAME..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-card border-2 border-border px-12 py-4 text-foreground font-mono font-bold placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-all uppercase tracking-wider"
                            />
                        </div>
                        <button className="flex items-center justify-center gap-2 bg-muted border-2 border-border px-8 py-4 font-mono font-bold uppercase hover:bg-muted/50 hover:border-accent transition-all text-accent">
                            <Filter size={16} />
                            Advanced Filters
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b-2 border-border mb-8 overflow-x-auto">
                    {['overview', 'politicians', 'analysis'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-8 py-4 font-sans text-sm font-semibold tracking-wide transition-all relative ${activeTab === tab
                                ? 'text-accent'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab === 'overview' ? 'Portfolio Overview' : tab === 'politicians' ? 'Member Portfolios' : 'Analysis'}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent text-accent-foreground"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="min-h-[400px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'overview' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-card border-2 border-border p-6 hover:border-accent/50 transition-colors group">
                                        <div className="flex items-center gap-3 mb-4 text-muted-foreground group-hover:text-accent transition-colors">
                                            <Users size={20} />
                                            <span className="font-sans text-xs font-semibold tracking-wide">Total Politicians</span>
                                        </div>
                                        <div className="text-3xl font-serif font-bold text-foreground mb-1">
                                            {politicians.length}
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground uppercase">In Database</div>
                                    </div>

                                    <div className="bg-card border-2 border-border p-6 hover:border-accent/50 transition-colors group">
                                        <div className="flex items-center gap-3 mb-4 text-muted-foreground group-hover:text-accent transition-colors">
                                            <TrendingUp size={20} />
                                            <span className="font-sans text-xs font-semibold tracking-wide">Total Trades</span>
                                        </div>
                                        <div className="text-3xl font-serif font-bold text-foreground mb-1">
                                            {stats.totalTrades}
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground uppercase">Across All Members</div>
                                    </div>

                                    <div className="bg-card border-2 border-border p-6 hover:border-accent/50 transition-colors group">
                                        <div className="flex items-center gap-3 mb-4 text-muted-foreground group-hover:text-accent transition-colors">
                                            <ArrowUpRight size={20} />
                                            <span className="font-sans text-xs font-semibold tracking-wide">Buy Orders</span>
                                        </div>
                                        <div className="text-3xl font-serif font-bold text-green-400 mb-1">
                                            {stats.buyTrades}
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground uppercase">Purchases</div>
                                    </div>

                                    <div className="bg-card border-2 border-border p-6 hover:border-accent/50 transition-colors group">
                                        <div className="flex items-center gap-3 mb-4 text-muted-foreground group-hover:text-accent transition-colors">
                                            <ArrowDownRight size={20} />
                                            <span className="font-sans text-xs font-semibold tracking-wide">Sell Orders</span>
                                        </div>
                                        <div className="text-3xl font-serif font-bold text-red-400 mb-1">
                                            {stats.sellTrades}
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground uppercase">Sales</div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'politicians' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {filteredPoliticianStats.length > 0 ? (
                                        filteredPoliticianStats.map((politician, index) => (
                                            <div key={politician.name} className="bg-card border-2 border-border p-6 hover:border-accent/50 transition-all duration-300 group">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-12 h-12 bg-muted border border-border flex items-center justify-center text-muted-foreground">
                                                            <Users size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                                                                {politician.name}
                                                            </h3>
                                                            <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground uppercase mt-1">
                                                                <span>{politician.totalTrades} Trades</span>
                                                                <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                                                                <span className="text-green-400">{politician.buyCount} Buys</span>
                                                                <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                                                                <span className="text-red-400">{politician.sellCount} Sells</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {politician.uniqueTickers.slice(0, 5).map(ticker => (
                                                            <span key={ticker} className="px-3 py-1 bg-muted border border-border text-[10px] font-mono font-bold uppercase text-accent">
                                                                {ticker}
                                                            </span>
                                                        ))}
                                                        {politician.uniqueTickers.length > 5 && (
                                                            <span className="px-3 py-1 bg-muted border border-border text-[10px] font-mono font-bold uppercase text-muted-foreground">
                                                                +{politician.uniqueTickers.length - 5} more
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Recent Trades Preview */}
                                                <div className="mt-6 pt-6 border-t border-border">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h4 className="font-mono text-xs font-bold text-muted-foreground uppercase">Recent Trades</h4>
                                                        <Link href={`/legislators/${politician.name.split(' ').pop()}`} className="text-[10px] font-mono text-accent hover:underline uppercase">
                                                            View Profile <ExternalLink size={10} className="inline ml-1" />
                                                        </Link>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {politician.recentTrades.map((trade, idx) => (
                                                            <div key={idx} className="p-3 bg-muted border border-white/5 hover:border-border transition-colors">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="font-mono text-sm font-bold text-foreground">{trade.ticker}</span>
                                                                    <span className={`text-[10px] font-mono font-bold ${(trade.type || "").toLowerCase().includes("purchase") ? "text-green-400" : "text-red-400"}`}>
                                                                        {(trade.type || "").toUpperCase()}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                                                                    <span>{trade.asset_description}</span>
                                                                    <span>{trade.transaction_date}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 text-muted-foreground font-mono">
                                            No politicians found matching "{searchTerm}"
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'analysis' && (
                                <div className="grid md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-card border-2 border-border p-8">
                                        <h3 className="font-mono text-xs font-bold text-accent uppercase mb-8 flex items-center gap-2">
                                            <BarChart3 size={16} /> Trading Activity
                                        </h3>

                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center p-4 bg-muted border border-white/5">
                                                <span className="font-mono text-sm text-muted-foreground uppercase">Total Trades</span>
                                                <span className="font-serif text-2xl font-bold text-foreground">{stats.totalTrades}</span>
                                            </div>

                                            <div className="flex justify-between items-center p-4 bg-muted border border-white/5">
                                                <span className="font-mono text-sm text-muted-foreground uppercase">Buy Orders</span>
                                                <div className="text-right">
                                                    <span className="font-serif text-2xl font-bold text-green-400 block">
                                                        {stats.buyTrades}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                                        {stats.totalTrades > 0 ? ((stats.buyTrades / stats.totalTrades) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center p-4 bg-muted border border-white/5">
                                                <span className="font-mono text-sm text-muted-foreground uppercase">Sell Orders</span>
                                                <div className="text-right">
                                                    <span className="font-serif text-2xl font-bold text-red-400 block">
                                                        {stats.sellTrades}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                                        {stats.totalTrades > 0 ? ((stats.sellTrades / stats.totalTrades) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-card border-2 border-border p-8">
                                        <h3 className="font-mono text-xs font-bold text-accent uppercase mb-8 flex items-center gap-2">
                                            <PieChart size={16} /> Sector Industries
                                        </h3>

                                        {sectors.length > 0 ? (
                                            <>
                                                <div className="grid grid-cols-2 gap-3 mb-6">
                                                    {sectors.map((s) => (
                                                        <div key={s.sector} className="p-4 bg-muted border border-white/5 hover:border-accent/50 transition-colors">
                                                            <div className="font-mono text-xs font-bold text-foreground uppercase mb-2">{s.sector}</div>
                                                            <div className="font-mono text-[10px] text-muted-foreground uppercase">
                                                                {s.industries.length} industr{s.industries.length === 1 ? 'y' : 'ies'}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="p-4 bg-muted border border-white/5 mb-4">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-mono text-xs text-muted-foreground uppercase">Total Sectors</span>
                                                        <span className="font-serif text-xl font-bold text-foreground">{sectors.length}</span>
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-muted border border-white/5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-mono text-xs text-muted-foreground uppercase">Total Industries</span>
                                                        <span className="font-serif text-xl font-bold text-foreground">
                                                            {sectors.reduce((sum, s) => sum + s.industries.length, 0)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-center h-32">
                                                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        )}

                                        <div className="mt-6 pt-4 border-t border-white/5">
                                            <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                                                Based on yfinance SECTOR_INDUSTRY_MAPPING by Ran Aroussi
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
