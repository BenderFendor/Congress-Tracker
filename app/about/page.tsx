import { ArrowLeft, Users, Target, Shield, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <a href="/" className="flex items-center">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </a>
              </Button>
              <div className="flex items-center space-x-2">
                <Users className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">About</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Mission Statement */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-6">Our Mission</h2>
          <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed mb-6">
            We believe democracy thrives when citizens have access to clear, accurate information 
            about their government. Our platform provides transparency tools to help Americans 
            track money, influence, and accountability in Congress.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardContent className="pt-6">
                <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Transparency</h3>
                <p className="text-sm text-muted-foreground">
                  Bringing government data into the light with clear, accessible visualizations
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <Target className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Accountability</h3>
                <p className="text-sm text-muted-foreground">
                  Tracking the connections between money, influence, and legislative action
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <Globe className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Accessibility</h3>
                <p className="text-sm text-muted-foreground">
                  Making complex government data understandable for every American citizen
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* What We Track */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-foreground mb-6">What We Track</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Financial Relationships</CardTitle>
                <CardDescription>
                  Following the money that flows through American politics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Campaign Contributions</h4>
                    <p className="text-sm text-muted-foreground">
                      Track donations from individuals, PACs, and corporations to Congressional candidates 
                      and political action committees.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Stock Trading</h4>
                    <p className="text-sm text-muted-foreground">
                      Monitor members of Congress' stock trades and potential conflicts of interest 
                      with their legislative responsibilities.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Net Worth Changes</h4>
                    <p className="text-sm text-muted-foreground">
                      Analyze how legislators' personal wealth changes during their time in office 
                      based on financial disclosure reports.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Legislative Influence</CardTitle>
                <CardDescription>
                  Understanding who shapes policy and how
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Lobbying Activity</h4>
                    <p className="text-sm text-muted-foreground">
                      Track lobbying spending, firms, and the issues they focus on to understand 
                      influence patterns in Congress.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Bill Tracking</h4>
                    <p className="text-sm text-muted-foreground">
                      Follow legislation from introduction to final passage, including voting patterns 
                      and amendment activity.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Committee Activity</h4>
                    <p className="text-sm text-muted-foreground">
                      Monitor committee hearings, markups, and the legislators who shape policy 
                      before it reaches the floor.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Our Approach */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-foreground mb-6">Our Approach</h3>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Non-Partisan Commitment</CardTitle>
                <CardDescription>
                  We track all members of Congress equally, regardless of party affiliation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our platform is designed to be strictly non-partisan. We present data about all 
                  members of Congress using the same methods and standards. Our goal is to inform 
                  citizens, not to advocate for any political position or party. Users can form 
                  their own opinions based on the facts we present.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Open Source Commitment</CardTitle>
                <CardDescription>
                  Transparency includes how we build and maintain our platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    We believe in radical transparency, which includes making our code and methods 
                    available for public review. Our commitment to open source ensures that:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Anyone can verify our data processing methods</li>
                    <li>Technical improvements can come from the community</li>
                    <li>Our algorithms and analysis are publicly auditable</li>
                    <li>Similar projects can build on our work</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data-Driven Insights</CardTitle>
                <CardDescription>
                  Letting the data speak without editorial bias
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We focus on presenting government data clearly and accurately, with visualizations 
                  that help users understand complex relationships and patterns. We provide context 
                  and explanations, but we don't tell users what to think about the information. 
                  Our role is to make government data accessible, not to interpret its political meaning.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contact & Feedback */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-foreground mb-6">Get Involved</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Feedback & Suggestions</CardTitle>
                <CardDescription>
                  Help us improve government transparency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  We welcome feedback from users about how we can better serve the goal of 
                  government transparency. Whether you've found an error, have a feature suggestion, 
                  or want to contribute to our open source project, we want to hear from you.
                </p>
                <div className="space-y-2">
                  <Badge variant="outline">Data Quality Reports</Badge>
                  <Badge variant="outline">Feature Requests</Badge>
                  <Badge variant="outline">Technical Contributions</Badge>
                  <Badge variant="outline">Research Partnerships</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Technical Community</CardTitle>
                <CardDescription>
                  For developers and data researchers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Join our technical community to contribute to government transparency tools:
                </p>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm">API Access</h4>
                    <p className="text-xs text-muted-foreground">
                      Use our APIs to build your own transparency tools
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-sm">Data Analysis</h4>
                    <p className="text-xs text-muted-foreground">
                      Collaborate on research and analysis projects
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-sm">Open Source Development</h4>
                    <p className="text-xs text-muted-foreground">
                      Contribute code, documentation, and improvements
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Values Statement */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-0">
          <CardContent className="p-8">
            <h3 className="text-2xl font-bold text-foreground mb-4">Our Values in Action</h3>
            <p className="text-muted-foreground mb-6">
              Democracy works best when citizens have the information they need to hold their 
              representatives accountable. Every data point we track, every visualization we create, 
              and every feature we build serves this fundamental principle.
            </p>
            <p className="text-muted-foreground">
              We're not here to tell you what to think about your government—we're here to give 
              you the tools to think for yourself.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
