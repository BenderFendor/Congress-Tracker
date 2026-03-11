"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, TrendingUp, Calendar, Building, ArrowUpRight, ArrowDownRight, BarChart3, PieChart, DollarSign } from "lucide-react"
import { getRecentTrades, StockTrade } from "@/lib/services/stocks"

export default function StocksPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAction, setFilterAction] = useState("all")
  const [trades, setTrades] = useState<StockTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("trades")

  useEffect(() => {
    async function loadTrades() {
      try {
        const data = await getRecentTrades(100)
        setTrades(data)
      } catch (error) {
        console.error("Failed to load trades", error)
      } finally {
        setLoading(false)
      }
    }
    loadTrades()
  }, [])

  const filteredTrades = trades.filter(trade => {
    const matchesSearch =
      trade.representative.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trade.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trade.asset_description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesAction = filterAction === "all" ||
      (filterAction === "buy" && trade.type.toLowerCase().includes("purchase")) ||
      (filterAction === "sell" && trade.type.toLowerCase().includes("sale"))

    return matchesSearch && matchesAction
  })

  // Calculate popular stocks from the trades
  const stockCounts = trades.reduce((acc, trade) => {
    acc[trade.ticker] = (acc[trade.ticker] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topStocks = Object.entries(stockCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([symbol, count]) => ({
      symbol,
      name: trades.find(t => t.ticker === symbol)?.asset_description || symbol,
      trades: count,
      price: "N/A", // Mock price
    }))

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent text-accent-foreground selection:text-foreground pb-20">



      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">

        {/* Page Title & Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div>
            <h2 className="font-serif text-5xl md:text-6xl font-bold text-foreground mb-4 leading-none tracking-tight">
              MARKET <span className="text-accent">MOVES</span>
            </h2>
            <p className="font-mono text-muted-foreground max-w-xl text-sm uppercase tracking-wide">
              Track real-time stock trading activity by members of Congress. Follow the money.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={18} />
              <input
                type="text"
                placeholder="SEARCH TRADES..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-80 bg-card border-2 border-border px-12 py-3 text-foreground font-mono text-sm font-bold placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-all uppercase tracking-wider"
              />
            </div>

            <div className="relative">
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full md:w-48 bg-card border-2 border-border px-4 py-3 text-foreground font-sans text-sm font-semibold focus:border-accent outline-none appearance-none cursor-pointer"
              >
                <option value="all">All Actions</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-white"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b-2 border-border mb-8 overflow-x-auto">
          {['trades', 'popular', 'analysis'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 font-sans text-sm font-semibold tracking-wide transition-all relative ${activeTab === tab
                ? 'text-accent'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {tab === 'trades' ? 'Recent Trades' : tab === 'popular' ? 'Popular Stocks' : 'Market Analysis'}
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
          ) : trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm">
              <h3 className="font-serif text-3xl font-bold text-primary mb-4">Database Offline</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                The trade database is currently being integrated and is not accessible. Please check back later for live congressional stock trades.
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'trades' && (
                <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {filteredTrades.map((trade, index) => (
                    <div key={`${trade.transaction_date}-${trade.ticker}-${index}`} className="group bg-card border-2 border-border p-6 hover:border-accent/50 transition-all duration-300">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-start gap-6">
                          <div className={`w-12 h-12 flex items-center justify-center border-2 ${trade.type.toLowerCase().includes("purchase")
                            ? "bg-green-900/20 border-green-500/30 text-green-400"
                            : "bg-red-900/20 border-red-500/30 text-red-400"
                            }`}>
                            {trade.type.toLowerCase().includes("purchase") ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                          </div>

                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-serif text-xl font-bold text-foreground group-hover:text-accent transition-colors">{trade.representative}</h3>
                              <span className="px-2 py-0.5 bg-muted/50 text-[10px] font-mono font-bold uppercase text-gray-300 border border-border">
                                {trade.district}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground uppercase">
                              <span className="flex items-center gap-1">
                                <Building size={12} />
                                <span className="text-foreground font-bold">{trade.ticker}</span> - {trade.asset_description}
                              </span>
                              <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {trade.transaction_date}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col md:items-end gap-2 pl-18 md:pl-0">
                          <div className="font-mono text-sm font-bold text-foreground">
                            <span className={trade.type.toLowerCase().includes("purchase") ? "text-green-400" : "text-red-400"}>
                              {trade.type.toUpperCase()}
                            </span>
                            <span className="mx-2 text-muted-foreground">|</span>
                            {trade.amount}
                          </div>

                          <div className="flex items-center gap-3">
                            {trade.cap_gains_over_200_usd && (
                              <span className="text-[10px] font-mono font-bold text-accent uppercase border border-accent/30 px-2 py-0.5 bg-accent text-accent-foreground/10">
                                Cap Gains &gt; $200
                              </span>
                            )}
                            <a href={trade.ptr_link} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono font-bold text-muted-foreground hover:text-foreground uppercase underline decoration-gray-700 underline-offset-4 transition-colors">
                              View Disclosure
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'popular' && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {topStocks.map((stock) => (
                    <div key={stock.symbol} className="bg-card border-2 border-border p-8 hover:border-accent transition-all duration-300 group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-accent text-accent-foreground/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-accent hover:text-accent-foreground/10 transition-colors"></div>

                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 bg-muted border border-border flex items-center justify-center text-xl font-bold font-mono text-foreground">
                          {stock.symbol.substring(0, 1)}
                        </div>
                        <div className="px-3 py-1 bg-accent text-accent-foreground text-black text-xs font-mono font-bold uppercase">
                          {stock.trades} Trades
                        </div>
                      </div>

                      <h3 className="font-serif text-3xl font-bold text-foreground mb-2">{stock.symbol}</h3>
                      <p className="font-mono text-xs text-muted-foreground uppercase truncate mb-6">{stock.name}</p>

                      <div className="flex items-center justify-between pt-6 border-t border-border">
                        <span className="font-mono text-xs text-muted-foreground uppercase">Recent Activity</span>
                        <ArrowUpRight className="text-accent group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={16} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="grid md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-card border-2 border-border p-8">
                    <h3 className="font-mono text-xs font-bold text-accent uppercase mb-8 flex items-center gap-2">
                      <BarChart3 size={16} /> Trading Volume
                    </h3>

                    <div className="space-y-6">
                      <div className="flex justify-between items-center p-4 bg-muted border border-white/5">
                        <span className="font-mono text-sm text-muted-foreground uppercase">Total Trades Loaded</span>
                        <span className="font-serif text-2xl font-bold text-foreground">{trades.length}</span>
                      </div>

                      <div className="flex justify-between items-center p-4 bg-muted border border-white/5">
                        <span className="font-mono text-sm text-muted-foreground uppercase">Buy Orders</span>
                        <div className="text-right">
                          <span className="font-serif text-2xl font-bold text-green-400 block">
                            {trades.filter(t => t.type.toLowerCase().includes("purchase")).length}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">
                            {((trades.filter(t => t.type.toLowerCase().includes("purchase")).length / trades.length) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-4 bg-muted border border-white/5">
                        <span className="font-mono text-sm text-muted-foreground uppercase">Sell Orders</span>
                        <div className="text-right">
                          <span className="font-serif text-2xl font-bold text-red-400 block">
                            {trades.filter(t => t.type.toLowerCase().includes("sale")).length}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">
                            {((trades.filter(t => t.type.toLowerCase().includes("sale")).length / trades.length) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border-2 border-border p-8 flex items-center justify-center">
                    <div className="text-center">
                      <PieChart size={48} className="text-gray-700 mx-auto mb-4" />
                      <h3 className="font-serif text-xl font-bold text-foreground mb-2">More Analytics Coming Soon</h3>
                      <p className="font-mono text-xs text-muted-foreground uppercase max-w-xs mx-auto">
                        Detailed breakdown of sector allocation and party-wise trading patterns will be available in the next update.
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
  )
}
