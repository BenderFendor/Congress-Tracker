"use client"

import { useState } from "react"
import { ArrowLeft, MapPin, DollarSign, FileText, Users, TrendingUp, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"

// Mock data for a detailed legislator profile
const mockLegislator = {
  id: 1,
  name: "Alexandria Ocasio-Cortez",
  party: "Democrat",
  state: "NY",
  district: "14th",
  chamber: "House",
  avatar: "/aoc.jpg",
  bio: "Representative Alexandria Ocasio-Cortez proudly serves New York's 14th Congressional District, which includes parts of the Bronx and Queens.",
  totalDonations: 8500000,
  billsSponsored: 23,
  votingScore: 95,
  committees: ["Financial Services", "Oversight and Reform"],
  topDonors: [
    { name: "ActBlue", amount: 2100000, industry: "Political Action" },
    { name: "Justice Democrats", amount: 850000, industry: "Political Action" },
    { name: "Brand New Congress", amount: 420000, industry: "Political Action" },
    { name: "Democratic Socialists", amount: 380000, industry: "Political Action" },
    { name: "Working Families Party", amount: 290000, industry: "Political Action" },
  ],
  recentBills: [
    { title: "Green New Deal Resolution", status: "Introduced", date: "2023-04-20" },
    { title: "Just Transition for Energy Communities Act", status: "Committee", date: "2023-03-15" },
    { title: "Civilian Climate Corps Act", status: "Passed House", date: "2023-02-28" },
  ],
  votingRecord: [
    { bill: "Infrastructure Investment Act", vote: "Yes", date: "2023-11-15" },
    { bill: "Climate Action Now Act", vote: "Yes", date: "2023-10-22" },
    { bill: "Tax Cuts Extension", vote: "No", date: "2023-09-18" },
    { bill: "Healthcare Reform Bill", vote: "Yes", date: "2023-08-30" },
  ],
}

export default function LegislatorProfilePage() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Search
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-semibold text-foreground">Legislator Profile</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <Avatar className="h-32 w-32">
                <AvatarImage src={mockLegislator.avatar || "/placeholder.svg"} alt={mockLegislator.name} />
                <AvatarFallback className="text-2xl">
                  {mockLegislator.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                  <div>
                    <CardTitle className="text-3xl mb-2">{mockLegislator.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-lg">
                      <Badge
                        variant={mockLegislator.party === "Democrat" ? "default" : "secondary"}
                        className="text-sm"
                      >
                        {mockLegislator.party}
                      </Badge>
                      <span className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {mockLegislator.state}-{mockLegislator.district} • {mockLegislator.chamber}
                      </span>
                    </CardDescription>
                  </div>
                  <Button>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Official Website
                  </Button>
                </div>

                <p className="text-muted-foreground mb-4">{mockLegislator.bio}</p>

                <div className="flex flex-wrap gap-2">
                  {mockLegislator.committees.map((committee, index) => (
                    <Badge key={index} variant="outline">
                      {committee}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-primary" />
                Total Donations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ${(mockLegislator.totalDonations / 1000000).toFixed(1)}M
              </div>
              <p className="text-xs text-muted-foreground">Current election cycle</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <FileText className="h-4 w-4 mr-2 text-primary" />
                Bills Sponsored
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{mockLegislator.billsSponsored}</div>
              <p className="text-xs text-muted-foreground">This session</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Users className="h-4 w-4 mr-2 text-primary" />
                Voting Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{mockLegislator.votingScore}%</div>
              <Progress value={mockLegislator.votingScore} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-primary" />
                Influence Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">8.7</div>
              <p className="text-xs text-muted-foreground">Based on committee positions</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Information Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="donations">Campaign Finance</TabsTrigger>
            <TabsTrigger value="bills">Legislation</TabsTrigger>
            <TabsTrigger value="voting">Voting Record</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Campaign Contributors</CardTitle>
                  <CardDescription>Largest donors in the current election cycle</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockLegislator.topDonors.slice(0, 3).map((donor, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{donor.name}</div>
                          <div className="text-sm text-muted-foreground">{donor.industry}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">${(donor.amount / 1000).toFixed(0)}K</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Legislative Activity</CardTitle>
                  <CardDescription>Bills sponsored or co-sponsored recently</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockLegislator.recentBills.map((bill, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{bill.title}</div>
                          <div className="text-sm text-muted-foreground">{bill.date}</div>
                        </div>
                        <Badge variant="outline">{bill.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="donations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Finance Details</CardTitle>
                <CardDescription>Complete breakdown of campaign contributions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {mockLegislator.topDonors.map((donor, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <div className="font-medium text-lg">{donor.name}</div>
                        <div className="text-sm text-muted-foreground">{donor.industry}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-primary">${(donor.amount / 1000).toFixed(0)}K</div>
                        <div className="text-sm text-muted-foreground">
                          {((donor.amount / mockLegislator.totalDonations) * 100).toFixed(1)}% of total
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bills" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Sponsored Legislation</CardTitle>
                <CardDescription>Bills and resolutions sponsored by this legislator</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockLegislator.recentBills.map((bill, index) => (
                    <div key={index} className="p-4 border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{bill.title}</h4>
                        <Badge variant="outline">{bill.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">Introduced: {bill.date}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="voting" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Voting Record</CardTitle>
                <CardDescription>How this legislator voted on key bills</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockLegislator.votingRecord.map((vote, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <div className="font-medium">{vote.bill}</div>
                        <div className="text-sm text-muted-foreground">{vote.date}</div>
                      </div>
                      <Badge variant={vote.vote === "Yes" ? "default" : "destructive"}>{vote.vote}</Badge>
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
