"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, Plus, Eye, EyeOff, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

// Mock portfolio data
const portfolioHoldings = [
  {
    id: 1,
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    shares: 50,
    avgCost: 420.5,
    currentPrice: 875.5,
    value: 43775,
    dayChange: 2.5,
    totalReturn: 54.1,
    congressionalActivity: "High",
    recentTrades: 12,
  },
  {
    id: 2,
    symbol: "MSFT",
    name: "Microsoft Corporation",
    shares: 100,
    avgCost: 380.25,
    currentPrice: 435.8,
    value: 43580,
    dayChange: 0.8,
    totalReturn: 14.6,
    congressionalActivity: "Medium",
    recentTrades: 8,
  },
  {
    id: 3,
    symbol: "AAPL",
    name: "Apple Inc",
    shares: 200,
    avgCost: 185.75,
    currentPrice: 195.2,
    value: 39040,
    dayChange: 1.1,
    totalReturn: 5.1,
    congressionalActivity: "High",
    recentTrades: 15,
  },
]

const portfolioPerformance = [
  { date: "Jan", value: 95000, congressIndex: 98000 },
  { date: "Feb", value: 102000, congressIndex: 105000 },
  { date: "Mar", value: 98000, congressIndex: 101000 },
  { date: "Apr", value: 115000, congressIndex: 118000 },
  { date: "May", value: 126355, congressIndex: 125000 },
]

const sectorAllocation = [
  { name: "Technology", value: 65, color: "hsl(var(--primary))" },
  { name: "Healthcare", value: 20, color: "hsl(var(--secondary))" },
  { name: "Financial", value: 10, color: "hsl(var(--accent))" },
  { name: "Energy", value: 5, color: "hsl(var(--muted))" },
]

const congressionalMirrorTrades = [
  {
    legislator: "Nancy Pelosi",
    stock: "NVDA",
    action: "Buy",
    date: "2024-01-15",
    yourPosition: "Following",
    performance: "+12.3%",
  },
  {
    legislator: "Josh Gottheimer",
    stock: "MSFT",
    action: "Buy",
    date: "2024-01-10",
    yourPosition: "Following",
    performance: "+3.8%",
  },
]

export default function PortfolioPage() {
  const [isAddStockOpen, setIsAddStockOpen] = useState(false)
  const [newStock, setNewStock] = useState({ symbol: "", shares: "", price: "" })
  const [watchingCongress, setWatchingCongress] = useState(true)

  const totalValue = portfolioHoldings.reduce((sum, holding) => sum + holding.value, 0)
  const totalCost = portfolioHoldings.reduce((sum, holding) => sum + holding.shares * holding.avgCost, 0)
  const totalReturn = ((totalValue - totalCost) / totalCost) * 100

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Portfolio Management</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Home
              </a>
              <a href="/stocks" className="text-muted-foreground hover:text-foreground transition-colors">
                Stock Tracker
              </a>
              <a href="/networth" className="text-muted-foreground hover:text-foreground transition-colors">
                Net Worth
              </a>
              <a href="/legislators" className="text-muted-foreground hover:text-foreground transition-colors">
                Legislators
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Portfolio Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
              <p className={`text-xs ${totalReturn >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalReturn >= 0 ? "+" : ""}
                {totalReturn.toFixed(1)}% all time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Day Change</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+$1,247</div>
              <p className="text-xs text-green-600">+0.99% today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{portfolioHoldings.length}</div>
              <p className="text-xs text-muted-foreground">Active positions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Congress Mirror</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-primary">Active</div>
                <Button variant="ghost" size="sm" onClick={() => setWatchingCongress(!watchingCongress)}>
                  {watchingCongress ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Following 2 trades</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="holdings" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="holdings">Holdings</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="mirror">Mirror</TabsTrigger>
            </TabsList>

            <Dialog open={isAddStockOpen} onOpenChange={setIsAddStockOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stock
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Stock to Portfolio</DialogTitle>
                  <DialogDescription>Enter the stock details to add to your portfolio</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="symbol" className="text-right">
                      Symbol
                    </Label>
                    <Input
                      id="symbol"
                      value={newStock.symbol}
                      onChange={(e) => setNewStock({ ...newStock, symbol: e.target.value })}
                      className="col-span-3"
                      placeholder="AAPL"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="shares" className="text-right">
                      Shares
                    </Label>
                    <Input
                      id="shares"
                      type="number"
                      value={newStock.shares}
                      onChange={(e) => setNewStock({ ...newStock, shares: e.target.value })}
                      className="col-span-3"
                      placeholder="100"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="price" className="text-right">
                      Price
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      value={newStock.price}
                      onChange={(e) => setNewStock({ ...newStock, price: e.target.value })}
                      className="col-span-3"
                      placeholder="150.00"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddStockOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddStock}>Add Stock</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="holdings" className="space-y-6">
            <div className="grid gap-4">
              {portfolioHoldings.map((holding) => (
                <Card key={holding.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              holding.dayChange > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {holding.dayChange > 0 ? (
                              <TrendingUp className="h-6 w-6" />
                            ) : (
                              <TrendingDown className="h-6 w-6" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{holding.symbol}</h3>
                            <Badge
                              variant={
                                holding.congressionalActivity === "High"
                                  ? "destructive"
                                  : holding.congressionalActivity === "Medium"
                                    ? "secondary"
                                    : "default"
                              }
                            >
                              {holding.congressionalActivity} Activity
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{holding.name}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span>{holding.shares} shares</span>
                            <span>Avg: ${holding.avgCost.toFixed(2)}</span>
                            <span>Current: ${holding.currentPrice.toFixed(2)}</span>
                            <span className="text-muted-foreground">{holding.recentTrades} Congress trades</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <div className="text-xl font-bold">{formatCurrency(holding.value)}</div>
                          <div className={`text-sm ${holding.dayChange > 0 ? "text-green-600" : "text-red-600"}`}>
                            {holding.dayChange > 0 ? "+" : ""}
                            {holding.dayChange}% today
                          </div>
                        </div>
                        <div
                          className={`text-sm font-medium ${
                            holding.totalReturn > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {holding.totalReturn > 0 ? "+" : ""}
                          {holding.totalReturn}% total
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio vs Congressional Index</CardTitle>
                <CardDescription>Compare your performance to congressional trading patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={portfolioPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        name="Your Portfolio"
                      />
                      <Line
                        type="monotone"
                        dataKey="congressIndex"
                        stroke="hsl(var(--secondary))"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Congressional Index"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Sector Allocation</CardTitle>
                  <CardDescription>Portfolio diversification breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
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
                        >
                          {sectorAllocation.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value}%`} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {sectorAllocation.map((sector, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color }} />
                        <span className="text-sm">
                          {sector.name}: {sector.value}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Analysis</CardTitle>
                  <CardDescription>Portfolio risk metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Beta (vs S&P 500)</span>
                    <span className="font-semibold">1.23</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Volatility (30d)</span>
                    <span className="font-semibold">18.4%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Sharpe Ratio</span>
                    <span className="font-semibold">1.67</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Max Drawdown</span>
                    <span className="font-semibold text-red-600">-12.3%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="mirror" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Congressional Mirror Trades</CardTitle>
                <CardDescription>Trades you're following from congressional activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {congressionalMirrorTrades.map((trade, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <Badge variant="outline">{trade.action}</Badge>
                        </div>
                        <div>
                          <div className="font-semibold">{trade.stock}</div>
                          <div className="text-sm text-muted-foreground">
                            Following {trade.legislator} • {trade.date}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">{trade.performance}</div>
                        <div className="text-sm text-muted-foreground">{trade.yourPosition}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
