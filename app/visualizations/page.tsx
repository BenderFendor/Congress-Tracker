"use client"

import { useState } from "react"
import { TrendingUp, BarChart3, Network, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CampaignFinanceChart } from "@/components/visualizations/campaign-finance-chart"
import { InfluenceNetwork } from "@/components/visualizations/influence-network"
import { LobbyingTimeline } from "@/components/visualizations/lobbying-timeline"

// Mock data for visualizations
const campaignFinanceData = [
  { name: "Tech Industry", amount: 2400000, industry: "Technology" },
  { name: "Healthcare", amount: 1800000, industry: "Healthcare" },
  { name: "Energy", amount: 1600000, industry: "Energy" },
  { name: "Finance", amount: 1400000, industry: "Financial Services" },
  { name: "Defense", amount: 1200000, industry: "Defense" },
]

const pieChartData = [
  { name: "Individual Donors", amount: 4200000 },
  { name: "PACs", amount: 2800000 },
  { name: "Super PACs", amount: 1900000 },
  { name: "Corporate", amount: 1100000 },
]

const networkData = [
  {
    id: "aoc",
    name: "Alexandria Ocasio-Cortez",
    type: "legislator" as const,
    party: "Democrat",
    connections: ["clean-energy", "green-new-deal"],
  },
  {
    id: "clean-energy",
    name: "Clean Energy Coalition",
    type: "organization" as const,
    amount: 850000,
    connections: ["aoc", "green-new-deal"],
  },
  {
    id: "green-new-deal",
    name: "Green New Deal",
    type: "bill" as const,
    connections: ["aoc", "clean-energy"],
  },
]

const timelineData = [
  { date: "Jan 2024", amount: 12000000, bills: 45, organizations: 120 },
  { date: "Feb 2024", amount: 15000000, bills: 52, organizations: 135 },
  { date: "Mar 2024", amount: 18000000, bills: 48, organizations: 142 },
  { date: "Apr 2024", amount: 22000000, bills: 61, organizations: 158 },
  { date: "May 2024", amount: 19000000, bills: 55, organizations: 151 },
  { date: "Jun 2024", amount: 25000000, bills: 67, organizations: 167 },
]

export default function VisualizationsPage() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Data Visualizations</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Home
              </a>
              <a href="/legislators" className="text-muted-foreground hover:text-foreground transition-colors">
                Legislators
              </a>
              <a href="/bills" className="text-muted-foreground hover:text-foreground transition-colors">
                Bills
              </a>
              <a href="/lobbying" className="text-muted-foreground hover:text-foreground transition-colors">
                Lobbying
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-4">Interactive Data Analysis</h2>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Explore the complex relationships between money, politics, and legislation through interactive
            visualizations. Uncover patterns in campaign finance, lobbying activity, and legislative influence.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-primary" />
                Total Lobbying
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">$131M</div>
              <p className="text-xs text-muted-foreground">This quarter</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <BarChart3 className="h-4 w-4 mr-2 text-primary" />
                Active Bills
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">328</div>
              <p className="text-xs text-muted-foreground">Being lobbied</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Network className="h-4 w-4 mr-2 text-primary" />
                Organizations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">1,247</div>
              <p className="text-xs text-muted-foreground">Registered lobbyists</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Clock className="h-4 w-4 mr-2 text-primary" />
                Last Updated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">2h</div>
              <p className="text-xs text-muted-foreground">Ago</p>
            </CardContent>
          </Card>
        </div>

        {/* Visualization Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="finance">Campaign Finance</TabsTrigger>
            <TabsTrigger value="network">Influence Network</TabsTrigger>
            <TabsTrigger value="timeline">Timeline Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6">
              <div className="grid md:grid-cols-2 gap-6">
                <CampaignFinanceChart
                  data={campaignFinanceData}
                  title="Top Industries by Donations"
                  description="Campaign contributions by industry sector"
                />
                <CampaignFinanceChart
                  data={pieChartData}
                  type="pie"
                  title="Donation Sources"
                  description="Breakdown of contribution types"
                />
              </div>
              <LobbyingTimeline
                data={timelineData}
                title="Lobbying Activity Trends"
                description="Monthly lobbying spending and bill targeting"
              />
            </div>
          </TabsContent>

          <TabsContent value="finance" className="mt-6">
            <div className="grid gap-6">
              <div className="grid md:grid-cols-2 gap-6">
                <CampaignFinanceChart
                  data={campaignFinanceData}
                  title="Industry Contributions"
                  description="Total contributions by industry"
                />
                <CampaignFinanceChart
                  data={pieChartData}
                  type="pie"
                  title="Contribution Types"
                  description="Individual vs. organizational giving"
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Campaign Finance Insights</CardTitle>
                  <CardDescription>Key findings from contribution data analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 border border-border rounded-lg">
                      <div className="text-2xl font-bold text-primary mb-2">$10.2M</div>
                      <div className="text-sm text-muted-foreground">Average per legislator</div>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <div className="text-2xl font-bold text-primary mb-2">42%</div>
                      <div className="text-sm text-muted-foreground">From individual donors</div>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <div className="text-2xl font-bold text-primary mb-2">Tech</div>
                      <div className="text-sm text-muted-foreground">Top contributing industry</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="network" className="mt-6">
            <div className="grid gap-6">
              <InfluenceNetwork
                nodes={networkData}
                title="Political Influence Network"
                description="Connections between legislators, organizations, and legislation"
              />

              <Card>
                <CardHeader>
                  <CardTitle>Network Analysis</CardTitle>
                  <CardDescription>Understanding the web of political influence</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-medium mb-2">Key Findings</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>• Technology companies have the most diverse legislative connections</li>
                        <li>• Healthcare lobbying is concentrated on specific committee members</li>
                        <li>• Energy sector shows strong bipartisan engagement patterns</li>
                        <li>• Financial services focus primarily on banking committee legislators</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <div className="grid gap-6">
              <LobbyingTimeline
                data={timelineData}
                title="Lobbying Spending Over Time"
                description="Track how lobbying activity changes throughout the legislative session"
              />

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Seasonal Patterns</CardTitle>
                    <CardDescription>Lobbying activity by time of year</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Q1 (Jan-Mar)</span>
                        <span className="font-bold text-primary">$45M</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Q2 (Apr-Jun)</span>
                        <span className="font-bold text-primary">$66M</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-4">
                        Lobbying typically peaks in Q2 as major legislation moves through committees.
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Bill Targeting Trends</CardTitle>
                    <CardDescription>How many bills are actively lobbied each month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Average Bills/Month</span>
                        <span className="font-bold text-primary">55</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Peak Month</span>
                        <span className="font-bold text-primary">June (67)</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-4">
                        Bill targeting increases as legislative deadlines approach.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
