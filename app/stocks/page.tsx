"use client"

import { useState } from "react"
import { Search, TrendingUp, Calendar, Building, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock data for congressional stock trades
const stockTrades = [
  {
    id: 1,
    legislator: "Nancy Pelosi",
    party: "Democrat",
    chamber: "House",
    stock: "NVDA",
    company: "NVIDIA Corporation",
    action: "Buy",
    amount: "$1M - $5M",
    date: "2024-01-15",
    price: "$850.00",
    currentPrice: "$875.50",
    change: "+3.0%",
    disclosure: "45 days late",
  },
  {
    id: 2,
    legislator: "Dan Crenshaw",
    party: "Republican",
    chamber: "House",
    stock: "TSLA",
    company: "Tesla Inc",
    action: "Sell",
    amount: "$250K - $500K",
    date: "2024-01-12",
    price: "$240.00",
    currentPrice: "$220.15",
    change: "-8.3%",
    disclosure: "On time",
  },
  {
    id: 3,
    legislator: "Josh Gottheimer",
    party: "Democrat",
    chamber: "House",
    stock: "MSFT",
    company: "Microsoft Corporation",
    action: "Buy",
    amount: "$100K - $250K",
    date: "2024-01-10",
    price: "$420.00",
    currentPrice: "$435.80",
    change: "+3.8%",
    disclosure: "On time",
  },
]

const topStocks = [
  { symbol: "NVDA", name: "NVIDIA", price: "$875.50", change: "+2.5%", trades: 12 },
  { symbol: "TSLA", name: "Tesla", price: "$220.15", change: "-1.2%", trades: 8 },
  { symbol: "MSFT", name: "Microsoft", price: "$435.80", change: "+0.8%", trades: 15 },
  { symbol: "AAPL", name: "Apple", price: "$195.20", change: "+1.1%", trades: 22 },
  { symbol: "GOOGL", name: "Alphabet", price: "$142.30", change: "-0.5%", trades: 6 },
]

export default function StocksPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterParty, setFilterParty] = useState("all")
  const [filterAction, setFilterAction] = useState("all")

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
            <Select value={filterParty} onValueChange={setFilterParty}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Parties</SelectItem>
                <SelectItem value="democrat">Democrat</SelectItem>
                <SelectItem value="republican">Republican</SelectItem>
              </SelectContent>
            </Select>
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
            <div className="grid gap-4">
              {stockTrades.map((trade) => (
                <Card key={trade.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              trade.action === "Buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {trade.action === "Buy" ? (
                              <ArrowUpRight className="h-6 w-6" />
                            ) : (
                              <ArrowDownRight className="h-6 w-6" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{trade.legislator}</h3>
                            <Badge variant={trade.party === "Democrat" ? "default" : "secondary"}>{trade.party}</Badge>
                            <Badge variant="outline">{trade.chamber}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <Building className="h-4 w-4" />
                              {trade.stock} - {trade.company}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {trade.date}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-medium">
                              {trade.action}: {trade.amount}
                            </span>
                            <span>Price: ${trade.price}</span>
                            <span
                              className={`font-medium ${
                                trade.change.startsWith("+") ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {trade.change}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <div className="text-lg font-semibold">${trade.currentPrice}</div>
                          <div className="text-sm text-muted-foreground">Current Price</div>
                        </div>
                        <Badge variant={trade.disclosure === "On time" ? "default" : "destructive"}>
                          {trade.disclosure}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                    <CardDescription>{stock.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{stock.price}</div>
                      <div
                        className={`font-medium ${stock.change.startsWith("+") ? "text-green-600" : "text-red-600"}`}
                      >
                        {stock.change}
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
                  <CardDescription>Congressional trading activity overview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total Trades This Month</span>
                    <span className="font-semibold">127</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Buy Orders</span>
                    <span className="font-semibold text-green-600">78 (61%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Sell Orders</span>
                    <span className="font-semibold text-red-600">49 (39%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Late Disclosures</span>
                    <span className="font-semibold text-orange-600">23 (18%)</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Sectors</CardTitle>
                  <CardDescription>Most traded sectors by Congress</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Technology</span>
                    <span className="font-semibold">42 trades</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Healthcare</span>
                    <span className="font-semibold">28 trades</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Financial Services</span>
                    <span className="font-semibold">21 trades</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Energy</span>
                    <span className="font-semibold">18 trades</span>
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
