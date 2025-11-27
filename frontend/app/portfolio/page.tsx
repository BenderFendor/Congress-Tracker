"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { TrendingUp, TrendingDown, Plus, Eye, EyeOff, BarChart3, PieChart, Shield, DollarSign, ArrowUpRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  PieChart as RechartsPieChart,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Pie,
} from "recharts"
import { getRecentTrades, StockTrade } from "@/lib/services/stocks"

// Helper to generate a mock portfolio based on real recent trades
const generateMockPortfolio = (trades: StockTrade[]) => {
  const uniqueTickers = Array.from(new Set(trades.map(t => t.ticker))).slice(0, 5);
  return uniqueTickers.map((ticker, index) => {
    const trade = trades.find(t => t.ticker === ticker);
    return {
      id: index + 1,
      symbol: ticker,
      name: trade?.asset_description || ticker,
      shares: Math.floor(Math.random() * 100) + 10,
      avgCost: Math.floor(Math.random() * 200) + 50,
      currentPrice: Math.floor(Math.random() * 200) + 50, // Mock price since we don't have real-time API
      value: 0, // Calculated below
      dayChange: (Math.random() * 5) - 2.5,
      totalReturn: (Math.random() * 40) - 10,
      congressionalActivity: ["High", "Medium", "Low"][Math.floor(Math.random() * 3)],
      recentTrades: trades.filter(t => t.ticker === ticker).length,
    }
  }).map(h => ({ ...h, value: h.shares * h.currentPrice }));
}

export default function PortfolioPage() {
  const [isAddStockOpen, setIsAddStockOpen] = useState(false)
  const [newStock, setNewStock] = useState({ symbol: "", shares: "", price: "" })
  const [watchingCongress, setWatchingCongress] = useState(true)
  const [portfolioHoldings, setPortfolioHoldings] = useState<any[]>([])
  const [recentTrades, setRecentTrades] = useState<StockTrade[]>([])
  const [activeTab, setActiveTab] = useState("holdings")

  useEffect(() => {
    async function loadData() {
      const trades = await getRecentTrades(50);
      setRecentTrades(trades);
      setPortfolioHoldings(generateMockPortfolio(trades));
    }
    loadData();
  }, []);

  const totalValue = portfolioHoldings.reduce((sum, holding) => sum + holding.value, 0)
  const totalCost = portfolioHoldings.reduce((sum, holding) => sum + holding.shares * holding.avgCost, 0)
  const totalReturn = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const handleAddStock = () => {
    // Add stock logic would go here
    setIsAddStockOpen(false)
    setNewStock({ symbol: "", shares: "", price: "" })
  }

  const sectorAllocation = [
    { name: "Technology", value: 65, color: "#ff4d00" },
    { name: "Healthcare", value: 20, color: "#ffffff" },
    { name: "Financial", value: 10, color: "#333333" },
    { name: "Energy", value: 5, color: "#666666" },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#ff4d00] selection:text-white pb-20">



      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">

        {/* Page Title */}
        <div className="mb-12 flex flex-col md:flex-row justify-between items-end gap-8">
          <div>
            <h2 className="font-serif text-5xl md:text-6xl font-black text-white mb-4 leading-none tracking-tight">
              YOUR <span className="text-[#ff4d00]">ASSETS</span>
            </h2>
            <p className="font-mono text-gray-400 max-w-xl text-sm uppercase tracking-wide">
              Track your performance against congressional trading patterns.
            </p>
          </div>

          <Dialog open={isAddStockOpen} onOpenChange={setIsAddStockOpen}>
            <DialogTrigger asChild>
              <button className="px-8 py-4 bg-[#ff4d00] text-black font-mono text-sm font-bold uppercase tracking-widest hover:bg-white transition-colors flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                <Plus size={16} strokeWidth={3} /> Add Stock
              </button>
            </DialogTrigger>
            <DialogContent className="bg-[#171717] border-2 border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl font-bold">Add Stock to Portfolio</DialogTitle>
                <DialogDescription className="font-mono text-xs text-gray-500 uppercase">
                  Enter the stock details to add to your portfolio
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="symbol" className="text-right font-mono text-xs font-bold uppercase text-gray-400">
                    Symbol
                  </label>
                  <input
                    id="symbol"
                    value={newStock.symbol}
                    onChange={(e) => setNewStock({ ...newStock, symbol: e.target.value })}
                    className="col-span-3 bg-black/50 border border-white/10 px-4 py-2 text-white font-mono text-sm focus:border-[#ff4d00] outline-none"
                    placeholder="AAPL"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="shares" className="text-right font-mono text-xs font-bold uppercase text-gray-400">
                    Shares
                  </label>
                  <input
                    id="shares"
                    type="number"
                    value={newStock.shares}
                    onChange={(e) => setNewStock({ ...newStock, shares: e.target.value })}
                    className="col-span-3 bg-black/50 border border-white/10 px-4 py-2 text-white font-mono text-sm focus:border-[#ff4d00] outline-none"
                    placeholder="100"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="price" className="text-right font-mono text-xs font-bold uppercase text-gray-400">
                    Price
                  </label>
                  <input
                    id="price"
                    type="number"
                    value={newStock.price}
                    onChange={(e) => setNewStock({ ...newStock, price: e.target.value })}
                    className="col-span-3 bg-black/50 border border-white/10 px-4 py-2 text-white font-mono text-sm focus:border-[#ff4d00] outline-none"
                    placeholder="150.00"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setIsAddStockOpen(false)}
                  className="px-6 py-2 border border-white/10 text-white font-mono text-xs font-bold uppercase hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStock}
                  className="px-6 py-2 bg-[#ff4d00] text-black font-mono text-xs font-bold uppercase hover:bg-white transition-colors"
                >
                  Add Stock
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Portfolio Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-gray-500 group-hover:text-[#ff4d00] transition-colors">
              <DollarSign size={20} />
              <span className="font-mono text-xs font-bold uppercase tracking-widest">Total Value</span>
            </div>
            <div className="text-3xl font-serif font-black text-white mb-1">
              {formatCurrency(totalValue)}
            </div>
            <div className={`text-xs font-mono uppercase font-bold ${totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalReturn >= 0 ? "+" : ""}
              {totalReturn.toFixed(1)}% all time
            </div>
          </div>

          <div className="bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-gray-500 group-hover:text-[#ff4d00] transition-colors">
              <TrendingUp size={20} />
              <span className="font-mono text-xs font-bold uppercase tracking-widest">Day Change</span>
            </div>
            <div className="text-3xl font-serif font-black text-green-400 mb-1">
              +$1,247
            </div>
            <div className="text-xs font-mono text-green-400 uppercase font-bold">+0.99% today</div>
          </div>

          <div className="bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-gray-500 group-hover:text-[#ff4d00] transition-colors">
              <PieChart size={20} />
              <span className="font-mono text-xs font-bold uppercase tracking-widest">Holdings</span>
            </div>
            <div className="text-3xl font-serif font-black text-white mb-1">
              {portfolioHoldings.length}
            </div>
            <div className="text-xs font-mono text-gray-600 uppercase">Active positions</div>
          </div>

          <div className="bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-colors group">
            <div className="flex items-center justify-between mb-4 text-gray-500 group-hover:text-[#ff4d00] transition-colors">
              <div className="flex items-center gap-3">
                <Shield size={20} />
                <span className="font-mono text-xs font-bold uppercase tracking-widest">Congress Mirror</span>
              </div>
              <button onClick={() => setWatchingCongress(!watchingCongress)} className="hover:text-white transition-colors">
                {watchingCongress ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            <div className="text-3xl font-serif font-black text-[#ff4d00] mb-1">
              Active
            </div>
            <div className="text-xs font-mono text-gray-600 uppercase">Tracking recent trades</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b-2 border-white/10 mb-8 overflow-x-auto">
          {['holdings', 'performance', 'analysis', 'mirror'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 font-mono text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === tab
                ? 'text-[#ff4d00]'
                : 'text-gray-500 hover:text-white'
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#ff4d00]"></div>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          {activeTab === 'holdings' && (
            <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {portfolioHoldings.map((holding) => (
                <div key={holding.id} className="bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-all duration-300 group">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6 w-full md:w-auto">
                      <div className={`w-12 h-12 flex items-center justify-center border-2 ${holding.dayChange > 0
                        ? "bg-green-900/20 border-green-500/30 text-green-400"
                        : "bg-red-900/20 border-red-500/30 text-red-400"
                        }`}>
                        {holding.dayChange > 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-serif text-xl font-bold text-white group-hover:text-[#ff4d00] transition-colors">{holding.symbol}</h3>
                          <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border ${holding.congressionalActivity === "High"
                            ? "text-red-400 border-red-500/30 bg-red-900/20"
                            : holding.congressionalActivity === "Medium"
                              ? "text-yellow-400 border-yellow-500/30 bg-yellow-900/20"
                              : "text-gray-400 border-gray-500/30 bg-gray-900/20"
                            }`}>
                            {holding.congressionalActivity} Activity
                          </span>
                        </div>
                        <p className="font-mono text-xs text-gray-500 uppercase">{holding.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full md:w-auto gap-12">
                      <div className="text-right">
                        <div className="font-mono text-xs text-gray-500 uppercase mb-1">Position</div>
                        <div className="font-mono text-sm font-bold text-white">
                          {holding.shares} shares @ ${holding.avgCost.toFixed(2)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono text-xl font-bold text-white">{formatCurrency(holding.value)}</div>
                        <div className={`font-mono text-xs font-bold uppercase ${holding.dayChange > 0 ? "text-green-400" : "text-red-400"}`}>
                          {holding.dayChange > 0 ? "+" : ""}
                          {holding.dayChange.toFixed(2)}% today
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="bg-[#171717] border-2 border-white/10 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-8 flex items-center gap-2">
                <BarChart3 size={16} /> Portfolio vs Congressional Index
              </h3>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[
                    { date: "Jan", value: 95000, congressIndex: 98000 },
                    { date: "Feb", value: 102000, congressIndex: 105000 },
                    { date: "Mar", value: 98000, congressIndex: 101000 },
                    { date: "Apr", value: 115000, congressIndex: 118000 },
                    { date: "May", value: 126355, congressIndex: 125000 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="date" stroke="#666" tick={{ fill: '#666', fontSize: 12, fontFamily: 'monospace' }} />
                    <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 12, fontFamily: 'monospace' }} tickFormatter={(value) => `$${value / 1000}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0px' }}
                      itemStyle={{ fontFamily: 'monospace', fontSize: '12px' }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#ff4d00"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#ff4d00' }}
                      activeDot={{ r: 6, fill: '#fff' }}
                      name="Your Portfolio"
                    />
                    <Line
                      type="monotone"
                      dataKey="congressIndex"
                      stroke="#ffffff"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Congressional Index"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="grid md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-[#171717] border-2 border-white/10 p-8">
                <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-8 flex items-center gap-2">
                  <PieChart size={16} /> Sector Allocation
                </h3>
                <div className="h-64 mb-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={sectorAllocation}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {sectorAllocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0px' }}
                        itemStyle={{ fontFamily: 'monospace', fontSize: '12px', color: '#fff' }}
                        formatter={(value) => `${value}%`}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {sectorAllocation.map((sector, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-black/20 border border-white/5">
                      <div className="w-3 h-3" style={{ backgroundColor: sector.color }} />
                      <span className="font-mono text-xs text-gray-400 uppercase">
                        {sector.name}: <span className="text-white font-bold">{sector.value}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#171717] border-2 border-white/10 p-8">
                <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-8 flex items-center gap-2">
                  <Shield size={16} /> Risk Analysis
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-black/20 border border-white/5">
                    <span className="font-mono text-sm text-gray-400 uppercase">Beta (vs S&P 500)</span>
                    <span className="font-serif text-xl font-bold text-white">1.23</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-black/20 border border-white/5">
                    <span className="font-mono text-sm text-gray-400 uppercase">Volatility (30d)</span>
                    <span className="font-serif text-xl font-bold text-white">18.4%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-black/20 border border-white/5">
                    <span className="font-mono text-sm text-gray-400 uppercase">Sharpe Ratio</span>
                    <span className="font-serif text-xl font-bold text-white">1.67</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-black/20 border border-white/5">
                    <span className="font-mono text-sm text-gray-400 uppercase">Max Drawdown</span>
                    <span className="font-serif text-xl font-bold text-red-400">-12.3%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mirror' && (
            <div className="bg-[#171717] border-2 border-white/10 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-8 flex items-center gap-2">
                <Eye size={16} /> Congressional Mirror Trades
              </h3>
              <div className="space-y-4">
                {recentTrades.slice(0, 5).map((trade, index) => (
                  <div key={index} className="flex items-center justify-between p-6 bg-black/20 border border-white/5 hover:border-white/20 transition-colors group">
                    <div className="flex items-center gap-6">
                      <div className="px-3 py-1 bg-white/10 border border-white/10 text-xs font-mono font-bold uppercase text-white">
                        {trade.type}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-serif text-lg font-bold text-white group-hover:text-[#ff4d00] transition-colors">{trade.ticker}</h4>
                          <span className="text-xs font-mono text-gray-500 uppercase">• {trade.transaction_date}</span>
                        </div>
                        <div className="text-xs font-mono text-gray-400 uppercase">
                          Following <span className="text-white font-bold">{trade.representative}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs font-bold text-green-400 uppercase mb-1 flex items-center justify-end gap-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div> Following
                      </div>
                      <div className="font-mono text-xs text-gray-500 uppercase">{trade.amount}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
