"use client"

import { useState } from "react"
import { Search, TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"

// Mock data for congressional net worth
const netWorthData = [
  {
    id: 1,
    name: "Nancy Pelosi",
    party: "Democrat",
    chamber: "House",
    state: "CA",
    currentNetWorth: 114500000,
    previousNetWorth: 106400000,
    change: 8100000,
    changePercent: "+7.6%",
    lastUpdated: "2024-01-15",
    majorAssets: ["Real Estate", "Stock Portfolio", "Business Interests"],
    riskLevel: "High",
  },
  {
    id: 2,
    name: "Rick Scott",
    party: "Republican",
    chamber: "Senate",
    state: "FL",
    currentNetWorth: 259700000,
    previousNetWorth: 232100000,
    change: 27600000,
    changePercent: "+11.9%",
    lastUpdated: "2024-01-12",
    majorAssets: ["Healthcare Investments", "Real Estate", "Private Equity"],
    riskLevel: "Very High",
  },
  {
    id: 3,
    name: "Mark Warner",
    party: "Democrat",
    chamber: "Senate",
    state: "VA",
    currentNetWorth: 214100000,
    previousNetWorth: 238900000,
    change: -24800000,
    changePercent: "-10.4%",
    lastUpdated: "2024-01-10",
    majorAssets: ["Tech Investments", "Venture Capital", "Real Estate"],
    riskLevel: "High",
  },
  {
    id: 4,
    name: "Suzan DelBene",
    party: "Democrat",
    chamber: "House",
    state: "WA",
    currentNetWorth: 79300000,
    previousNetWorth: 74200000,
    change: 5100000,
    changePercent: "+6.9%",
    lastUpdated: "2024-01-08",
    majorAssets: ["Microsoft Stock", "Real Estate", "Tech Investments"],
    riskLevel: "Medium",
  },
]

const wealthTrends = [
  { year: "2020", avgNetWorth: 8500000, medianNetWorth: 1200000 },
  { year: "2021", avgNetWorth: 9200000, medianNetWorth: 1350000 },
  { year: "2022", avgNetWorth: 8800000, medianNetWorth: 1280000 },
  { year: "2023", avgNetWorth: 10100000, medianNetWorth: 1420000 },
  { year: "2024", avgNetWorth: 11300000, medianNetWorth: 1580000 },
]

const wealthByParty = [
  { party: "Democrat", avgNetWorth: 12400000, count: 267 },
  { party: "Republican", avgNetWorth: 10200000, count: 268 },
]

export default function NetWorthPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterParty, setFilterParty] = useState("all")
  const [filterChamber, setFilterChamber] = useState("all")

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    }
    return `$${(amount / 1000).toFixed(0)}K`
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Congressional Net Worth Tracker</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Home
              </a>
              <a href="/stocks" className="text-muted-foreground hover:text-foreground transition-colors">
                Stock Tracker
              </a>
              <a href="/legislators" className="text-muted-foreground hover:text-foreground transition-colors">
                Legislators
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
                placeholder="Search by legislator name or state..."
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
            <Select value={filterChamber} onValueChange={setFilterChamber}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by chamber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chambers</SelectItem>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="senate">Senate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="individual" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="individual">Individual Wealth</TabsTrigger>
            <TabsTrigger value="trends">Wealth Trends</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-6">
            <div className="grid gap-4">
              {netWorthData.map((member) => (
                <Card key={member.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              member.change > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {member.change > 0 ? (
                              <TrendingUp className="h-6 w-6" />
                            ) : (
                              <TrendingDown className="h-6 w-6" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{member.name}</h3>
                            <Badge variant={member.party === "Democrat" ? "default" : "secondary"}>
                              {member.party}
                            </Badge>
                            <Badge variant="outline">{member.chamber}</Badge>
                            <Badge variant="outline">{member.state}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Updated {member.lastUpdated}
                            </span>
                            <Badge
                              variant={
                                member.riskLevel === "Very High"
                                  ? "destructive"
                                  : member.riskLevel === "High"
                                    ? "secondary"
                                    : "default"
                              }
                            >
                              {member.riskLevel} Risk
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {member.majorAssets.map((asset, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {asset}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <div className="text-2xl font-bold">{formatCurrency(member.currentNetWorth)}</div>
                          <div className="text-sm text-muted-foreground">Current Net Worth</div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-lg font-semibold ${member.change > 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {member.change > 0 ? "+" : ""}
                            {formatCurrency(member.change)}
                          </div>
                          <div className={`text-sm ${member.change > 0 ? "text-green-600" : "text-red-600"}`}>
                            {member.changePercent}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Congressional Wealth Over Time</CardTitle>
                  <CardDescription>Average and median net worth trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={wealthTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Line
                          type="monotone"
                          dataKey="avgNetWorth"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          name="Average Net Worth"
                        />
                        <Line
                          type="monotone"
                          dataKey="medianNetWorth"
                          stroke="hsl(var(--secondary))"
                          strokeWidth={2}
                          name="Median Net Worth"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Wealth by Political Party</CardTitle>
                  <CardDescription>Average net worth comparison</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={wealthByParty}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="party" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="avgNetWorth" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Wealth Statistics</CardTitle>
                  <CardDescription>Congressional wealth overview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Wealthiest Member</span>
                    <span className="font-semibold">Rick Scott ($259.7M)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Average Net Worth</span>
                    <span className="font-semibold">$11.3M</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Median Net Worth</span>
                    <span className="font-semibold">$1.58M</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Members Worth {">"}$50M</span>
                    <span className="font-semibold">27 (5%)</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Wealth Changes</CardTitle>
                  <CardDescription>Recent net worth movements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Biggest Gainer</span>
                    <span className="font-semibold text-green-600">Rick Scott (+$27.6M)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Biggest Loser</span>
                    <span className="font-semibold text-red-600">Mark Warner (-$24.8M)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Members with Gains</span>
                    <span className="font-semibold text-green-600">312 (58%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Members with Losses</span>
                    <span className="font-semibold text-red-600">223 (42%)</span>
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
