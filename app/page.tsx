import { Search, TrendingUp, Users, FileText, DollarSign, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Eye className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Congress Accountability Tracker</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="/legislators" className="text-muted-foreground hover:text-foreground transition-colors">
                Legislators
              </a>
              <a href="/bills" className="text-muted-foreground hover:text-foreground transition-colors">
                Bills
              </a>
              <a href="/lobbying" className="text-muted-foreground hover:text-foreground transition-colors">
                Lobbying
              </a>
              <a href="/stocks" className="text-muted-foreground hover:text-foreground transition-colors">
                Stock Tracker
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

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-6 text-balance">
            Transparency in Government
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto text-pretty">
            Track political influence, campaign finance, and legislative activity through interactive data
            visualizations. Hold your representatives accountable with comprehensive insights into money and politics.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input placeholder="Search legislators, bills, or organizations..." className="pl-10 py-3 text-lg" />
              <Button className="absolute right-2 top-1/2 transform -translate-y-1/2">Search</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12 text-foreground">Explore Government Data</h3>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <Users className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Legislator Profiles</CardTitle>
                <CardDescription>
                  View comprehensive profiles of Congress members including voting records, donors, and sponsored
                  legislation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <a href="/legislators">Browse Legislators</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <FileText className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Bill Explorer</CardTitle>
                <CardDescription>
                  Discover connections between legislation and the corporations, industries, and lobbying firms that
                  influence them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <a href="/bills">Explore Bills</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <DollarSign className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Campaign Finance</CardTitle>
                <CardDescription>
                  Track campaign contributions and see which organizations are funding your representatives.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <a href="/visualizations">View Donations</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <TrendingUp className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Lobbying Activity</CardTitle>
                <CardDescription>
                  Search by corporation or lobbying firm to see which politicians and bills they're trying to influence.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <a href="/lobbying">Search Lobbying</a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* New Financial Tracking Feature Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <TrendingUp className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Stock Tracker</CardTitle>
                <CardDescription>
                  Monitor congressional stock trades and track potential conflicts of interest in real-time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <a href="/stocks">Track Trades</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <DollarSign className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Net Worth Tracker</CardTitle>
                <CardDescription>
                  Analyze changes in congressional net worth and asset disclosures over time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <a href="/networth">View Net Worth</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <FileText className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Portfolio Management</CardTitle>
                <CardDescription>
                  Build and track your own portfolio while monitoring congressional trading patterns.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <a href="/portfolio">Manage Portfolio</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">535</div>
              <div className="text-muted-foreground">Congress Members Tracked</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">15,000+</div>
              <div className="text-muted-foreground">Bills Analyzed</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">$2.1B</div>
              <div className="text-muted-foreground">Campaign Contributions Tracked</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Eye className="h-6 w-6 text-primary" />
                <span className="font-bold text-foreground">Congress Tracker</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Promoting government transparency through data visualization and accountability tracking.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Explore</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="/legislators" className="hover:text-foreground transition-colors">
                    Legislators
                  </a>
                </li>
                <li>
                  <a href="/bills" className="hover:text-foreground transition-colors">
                    Bills
                  </a>
                </li>
                <li>
                  <a href="/visualizations" className="hover:text-foreground transition-colors">
                    Campaign Finance
                  </a>
                </li>
                <li>
                  <a href="/lobbying" className="hover:text-foreground transition-colors">
                    Lobbying
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    API Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Data Sources
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Methodology
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    About
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Support
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Feedback
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 Congress Accountability Tracker. Built for government transparency.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
