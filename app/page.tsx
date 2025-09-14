import { Search, TrendingUp, Users, FileText, DollarSign, Eye, ArrowRight, BarChart3, PieChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Navigation } from "@/components/navigation"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <section className="relative py-24 px-4 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)]" />

        <div className="container mx-auto text-center relative z-10">
          <div className="animate-fade-in">
            <h2 className="text-5xl md:text-7xl font-bold mb-6 text-balance">
              <span className="text-primary font-extrabold">Transparency</span>{" "}
              <span className="text-foreground">in Government</span>
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-4xl mx-auto text-pretty leading-relaxed">
              Track political influence, campaign finance, and legislative activity through interactive data
              visualizations. Hold your representatives accountable with comprehensive insights.
            </p>
          </div>

          <div className="max-w-3xl mx-auto mb-16 animate-slide-up">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
              <div className="relative glass-effect rounded-2xl p-2">
                <div className="flex items-center">
                  <Search className="ml-4 text-muted-foreground h-6 w-6" />
                  <Input
                    placeholder="Search legislators, bills, or organizations..."
                    className="border-0 bg-transparent text-lg py-4 px-4 focus:ring-0 focus:outline-none"
                  />
                  <Button className="mr-2 px-8 py-3 rounded-xl hover-lift">
                    Search
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto animate-scale-in">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">535</div>
              <div className="text-sm text-muted-foreground">Congress Members</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">15K+</div>
              <div className="text-sm text-muted-foreground">Bills Tracked</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">$2.1B</div>
              <div className="text-sm text-muted-foreground">Contributions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">10K+</div>
              <div className="text-sm text-muted-foreground">Stock Trades</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-primary font-extrabold">Explore</span>{" "}
              <span className="text-foreground">Government Data</span>
            </h3>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Comprehensive tools to track political influence and hold representatives accountable
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <Card className="card-hover glass-effect border-0 group">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl">Legislator Profiles</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Comprehensive profiles with voting records, campaign donors, and sponsored legislation analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full hover-lift group bg-transparent" asChild>
                  <a href="/legislators">
                    Browse Legislators
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="card-hover glass-effect border-0 group">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-secondary to-secondary/80 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-8 w-8 text-secondary-foreground" />
                </div>
                <CardTitle className="text-xl">Bill Explorer</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Discover connections between legislation and the organizations that influence them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full hover-lift group bg-transparent" asChild>
                  <a href="/bills">
                    Explore Bills
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="card-hover glass-effect border-0 group">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent/80 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="h-8 w-8 text-accent-foreground" />
                </div>
                <CardTitle className="text-xl">Stock Tracker</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Monitor congressional stock trades and identify potential conflicts of interest.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full hover-lift group bg-transparent" asChild>
                  <a href="/stocks">
                    Track Trades
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="card-hover glass-effect border-0 group">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-chart-1 to-chart-1/80 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl">Net Worth Tracker</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Analyze changes in congressional wealth and asset disclosures over time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full hover-lift group bg-transparent" asChild>
                  <a href="/networth">
                    View Net Worth
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="card-hover glass-effect border-0 group">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-chart-3 to-chart-3/80 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl">Lobbying Activity</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Search corporations and lobbying firms to see their political influence efforts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full hover-lift group bg-transparent" asChild>
                  <a href="/lobbying">
                    Search Lobbying
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="card-hover glass-effect border-0 group">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-chart-4 to-chart-4/80 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <PieChart className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl">Portfolio Management</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Build your portfolio while monitoring congressional trading patterns.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full hover-lift group bg-transparent" asChild>
                  <a href="/portfolio">
                    Manage Portfolio
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <footer className="bg-gradient-to-t from-muted/50 to-background border-t border-border/50 py-16 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                  <Eye className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl text-primary">Congress Tracker</span>
              </div>
              <p className="text-muted-foreground text-lg leading-relaxed max-w-md">
                Promoting government transparency through data visualization and accountability tracking.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-6 text-lg">Explore</h4>
              <ul className="space-y-3">
                {[
                  { name: "Legislators", href: "/legislators" },
                  { name: "Bills", href: "/bills" },
                  { name: "Stock Trades", href: "/stocks" },
                  { name: "Lobbying", href: "/lobbying" },
                ].map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className="text-muted-foreground hover:text-foreground transition-colors duration-300 hover:translate-x-1 inline-block"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-6 text-lg">Resources</h4>
              <ul className="space-y-3">
                {[
                  { name: "API Documentation", href: "#" },
                  { name: "Data Sources", href: "#" },
                  { name: "Methodology", href: "#" },
                  { name: "About", href: "#" },
                ].map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className="text-muted-foreground hover:text-foreground transition-colors duration-300 hover:translate-x-1 inline-block"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 mt-12 pt-8 text-center">
            <p className="text-muted-foreground">
              &copy; 2024 Congress Accountability Tracker. Built for government transparency.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
