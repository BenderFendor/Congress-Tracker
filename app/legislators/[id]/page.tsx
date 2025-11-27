"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, MapPin, DollarSign, FileText, Users, TrendingUp, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { getLegislator, Legislator } from "@/lib/services/legislators"
import { getMemberVotes, Vote } from "@/lib/services/voting"

export default function LegislatorProfilePage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState("overview")
  const [legislator, setLegislator] = useState<Legislator | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [legData, votesData] = await Promise.all([
          getLegislator(params.id),
          getMemberVotes(params.id)
        ])
        setLegislator(legData)
        setVotes(votesData)
      } catch (error) {
        console.error("Failed to load legislator data", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [params.id])

  if (loading) return <div className="p-8 text-center">Loading profile...</div>
  if (!legislator) return <div className="p-8 text-center">Legislator not found</div>

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
                <AvatarImage src={legislator.avatar || "/placeholder.svg"} alt={legislator.name} />
                <AvatarFallback className="text-2xl">
                  {legislator.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                  <div>
                    <CardTitle className="text-3xl mb-2">{legislator.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-lg">
                      <Badge
                        variant={legislator.party === "D" || legislator.party === "Democrat" ? "default" : "secondary"}
                        className={`text-sm ${legislator.party === "R" || legislator.party === "Republican" ? "bg-red-600 hover:bg-red-700" : ""}`}
                      >
                        {legislator.party === "D" ? "Democrat" : legislator.party === "R" ? "Republican" : legislator.party}
                      </Badge>
                      <span className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {legislator.state}-{legislator.district} • {legislator.chamber}
                      </span>
                    </CardDescription>
                  </div>
                  <Button asChild>
                    <a href={legislator.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Official Website
                    </a>
                  </Button>
                </div>

                <p className="text-muted-foreground mb-4">{legislator.bio}</p>

                <div className="flex flex-wrap gap-2">
                  {legislator.committees.map((committee, index) => (
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
                ${(legislator.totalDonations / 1000000).toFixed(1)}M
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
              <div className="text-2xl font-bold text-primary">{legislator.billsSponsored}</div>
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
              <div className="text-2xl font-bold text-primary">{legislator.votingScore}%</div>
              <Progress value={legislator.votingScore} className="mt-2" />
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
                    {legislator.topDonors.length > 0 ? (
                      legislator.topDonors.slice(0, 3).map((donor, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{donor.name}</div>
                            <div className="text-sm text-muted-foreground">{donor.industry}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">${(donor.amount / 1000).toFixed(0)}K</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">No donor data available</div>
                    )}
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
                    {legislator.recentBills.length > 0 ? (
                      legislator.recentBills.map((bill, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{bill.title}</div>
                            <div className="text-sm text-muted-foreground">{bill.date}</div>
                          </div>
                          <Badge variant="outline">{bill.status}</Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">No recent bills available</div>
                    )}
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
                  {legislator.topDonors.length > 0 ? (
                    legislator.topDonors.map((donor, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                          <div className="font-medium text-lg">{donor.name}</div>
                          <div className="text-sm text-muted-foreground">{donor.industry}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-primary">${(donor.amount / 1000).toFixed(0)}K</div>
                          <div className="text-sm text-muted-foreground">
                            {((donor.amount / legislator.totalDonations) * 100).toFixed(1)}% of total
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No detailed donor data available</div>
                  )}
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
                  {legislator.recentBills.length > 0 ? (
                    legislator.recentBills.map((bill, index) => (
                      <div key={index} className="p-4 border border-border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">{bill.title}</h4>
                          <Badge variant="outline">{bill.status}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">Introduced: {bill.date}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No sponsored legislation data available</div>
                  )}
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
                  {votes.length > 0 ? (
                    votes.map((vote, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div className="flex-1 mr-4">
                          <div className="font-medium">{vote.bill.number}: {vote.bill.title || vote.description}</div>
                          <div className="text-sm text-muted-foreground">{vote.date} • {vote.question}</div>
                        </div>
                        <Badge variant={vote.position === "Yes" ? "default" : vote.position === "No" ? "destructive" : "secondary"}>
                          {vote.position}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No voting record available</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
