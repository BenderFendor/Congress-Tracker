"use client"

import { useState, useEffect } from "react"
import { Search, TrendingUp, Calendar, Building, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getRecentTrades, StockTrade } from "@/lib/services/stocks"

export default function StocksPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterParty, setFilterParty] = useState("all")
  const [filterAction, setFilterAction] = useState("all")
  const [trades, setTrades] = useState<StockTrade[]>([])
  const [loading, setLoading] = useState(true)

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

    // Note: The API data doesn't strictly have "party" in the simple object, 
    // we might need to infer it or fetch it if crucial. 
    // For now, we'll skip party filter or assume it's not available in this simple view.
    // If party is needed, we'd need a mapping of rep -> party.

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
      // Mock price/change for now as we don't have a real-time price API in this service yet
      price: "N/A",
      change: "N/A"
    }))

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Congressional Stock Tracker</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Home
              </a>
              <a href="/legislators" className="text-muted-foreground hover:text-foreground transition-colors">
                Legislators
              </a>
              <a href="/networth" className="text-muted-foreground hover:text-foreground transition-colors">
                Net Worth
              </a>
              <a href="/portfolio" className="text-muted-foreground hover:text-foreground transition-colors">
                Portfolio
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                placeholder="Search by legislator, stock symbol, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* Party filter disabled as data is missing in this feed */}
            {/* <Select value={filterParty} onValueChange={setFilterParty}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Parties</SelectItem>
                <SelectItem value="democrat">Democrat</SelectItem>
                <SelectItem value="republican">Republican</SelectItem>
              </SelectContent>
            </Select> */}
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="trades" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trades">Recent Trades</TabsTrigger>
            <TabsTrigger value="popular">Popular Stocks</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="trades" className="space-y-6">
            {loading ? (
              <div className="text-center py-8">Loading trades...</div>
            ) : (
              <div className="grid gap-4">
                {filteredTrades.map((trade, index) => (
                  <Card key={`${trade.transaction_date}-${trade.ticker}-${index}`} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div
                              className={`w-12 h-12 rounded-full flex items-center justify-center ${trade.type.toLowerCase().includes("purchase") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}
                            >
                              {trade.type.toLowerCase().includes("purchase") ? (
                                <ArrowUpRight className="h-6 w-6" />
                              ) : (
                                <ArrowDownRight className="h-6 w-6" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{trade.representative}</h3>
                              <Badge variant="outline">{trade.district}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                              <span className="flex items-center gap-1">
                                <Building className="h-4 w-4" />
                                {trade.ticker} - {trade.asset_description}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {trade.transaction_date}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="font-medium">
                                {trade.type}: {trade.amount}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={trade.cap_gains_over_200_usd ? "default" : "secondary"}>
                            {trade.cap_gains_over_200_usd ? "Cap Gains > $200" : "Standard"}
                          </Badge>
                          <a href={trade.ptr_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                            View Disclosure
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="popular" className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topStocks.map((stock) => (
                <Card key={stock.symbol} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{stock.symbol}</CardTitle>
                      <Badge variant="outline">{stock.trades} trades</Badge>
                    </div>
                    <CardDescription className="truncate">{stock.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{stock.price}</div>
                      <div className="text-sm text-muted-foreground">
                        Recent Activity Only
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Trading Summary</CardTitle>
                  <CardDescription>Recent congressional trading activity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total Trades Loaded</span>
                    <span className="font-semibold">{trades.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Buy Orders</span>
                    <span className="font-semibold text-green-600">
                      {trades.filter(t => t.type.toLowerCase().includes("purchase")).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Sell Orders</span>
                    <span className="font-semibold text-red-600">
                      {trades.filter(t => t.type.toLowerCase().includes("sale")).length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
