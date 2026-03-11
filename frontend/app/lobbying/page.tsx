"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Building2, DollarSign, Users, FileText, TrendingUp, ExternalLink, HardHat } from "lucide-react"
import { getRecentFilings, getRegistrants, Filing, Registrant } from "@/lib/services/lobbying"

// Get the current year for filtering recent data
const currentYear = new Date().getFullYear()

export default function LobbyingPage() {
  const [filings, setFilings] = useState<Filing[]>([])
  const [registrants, setRegistrants] = useState<Registrant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedYear, setSelectedYear] = useState(currentYear.toString())
  const [activeTab, setActiveTab] = useState("filings")

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  useEffect(() => {
    const fetchLobbyingData = async () => {
      try {
        setLoading(true)

        // Fetch API data
        const [
          filingsData,
          registrantsData
        ] = await Promise.all([
          getRecentFilings(1, 25),
          getRegistrants(1, 25)
        ])

        setFilings(filingsData.results || [])
        setRegistrants(registrantsData.results || [])
      } catch (e: any) {
        console.error("Lobbying data fetch error:", e)
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    fetchLobbyingData()
  }, [])

  // Group filings by registrant for better display
  const registrantFilings = new Map<number, Filing[]>()
  filings.forEach(filing => {
    const registrantId = filing.registrant.id
    if (!registrantFilings.has(registrantId)) {
      registrantFilings.set(registrantId, [])
    }
    registrantFilings.get(registrantId)?.push(filing)
  })

  // Create combined data for display
  const lobbyingOrganizations = Array.from(registrantFilings.entries()).map(([registrantId, orgFilings]) => {
    const registrant = orgFilings[0].registrant
    const totalIncome = orgFilings.reduce((sum, filing) => sum + (filing.income || 0), 0)
    const totalExpenses = orgFilings.reduce((sum, filing) => sum + (filing.expenses || 0), 0)
    const uniqueClients = new Set(orgFilings.map(f => f.client?.name).filter(Boolean))
    const allIssues = new Set(
      orgFilings.flatMap(f =>
        f.lobbying_activities?.map(a => a.general_issue_area_display).filter(Boolean) || []
      )
    )

    return {
      id: registrantId,
      registrant,
      filings: orgFilings,
      totalIncome,
      totalExpenses,
      clientCount: uniqueClients.size,
      issueAreas: Array.from(allIssues).slice(0, 5), // Top 5 issues
      mostRecentFiling: orgFilings[0]
    }
  })

  const filteredOrgs = lobbyingOrganizations.filter((org) => {
    const matchesSearch =
      org.registrant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.issueAreas.some(issue => issue && issue.toLowerCase().includes(searchTerm.toLowerCase()))

    return matchesSearch
  })

  const getIssueColor = (issue: string) => {
    const colors = [
      "border-blue-500/50 text-blue-400 bg-blue-900/20",
      "border-green-500/50 text-green-400 bg-green-900/20",
      "border-purple-500/50 text-purple-400 bg-purple-900/20",
      "border-orange-500/50 text-orange-400 bg-orange-900/20",
      "border-red-500/50 text-red-400 bg-red-900/20",
      "border-yellow-500/50 text-yellow-400 bg-yellow-900/20",
      "border-pink-500/50 text-pink-400 bg-pink-900/20",
      "border-indigo-500/50 text-indigo-400 bg-indigo-900/20"
    ]
    if (!issue || typeof issue !== 'string') {
      return colors[0] // Default to first color
    }
    const index = issue.length % colors.length
    return colors[index]
  }

  const renderWIP = (title: string) => (
    <div className="flex flex-col items-center justify-center py-24 text-center border border-border bg-card rounded-sm shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
      <HardHat size={48} className="text-muted-foreground mb-6" />
      <h3 className="font-serif text-3xl font-bold text-primary mb-4">{title}</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        This view is currently under development as we integrate live data pipelines instead of using static mock data. Please check back later.
      </p>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent text-accent-foreground selection:text-foreground pb-20">



      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">

        {/* Page Title */}
        <div className="mb-12">
          <h2 className="font-serif text-5xl md:text-6xl font-bold text-foreground mb-4 leading-none tracking-tight">
            INFLUENCE <span className="text-accent">TRACKER</span>
          </h2>
          <p className="font-mono text-muted-foreground max-w-xl text-sm uppercase tracking-wide">
            Follow the flow of money and political influence. Comprehensive data from Senate filings.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b-2 border-border mb-8 overflow-x-auto">
          {['filings', 'spenders', 'firms', 'industries', 'recipients'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 font-sans text-sm font-semibold tracking-wide transition-all relative ${activeTab === tab
                ? 'text-accent'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {tab === 'filings' ? 'Recent Filings' : tab === 'spenders' ? 'Top Spenders' : tab === 'firms' ? 'Top Firms' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent text-accent-foreground"></div>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          {loading && activeTab === 'filings' ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error && activeTab === 'filings' ? (
            <div className="flex items-center justify-center h-64 text-red-500 font-mono">
              Error: {error}
            </div>
          ) : (
            <>
              {/* Recent Filings Tab */}
              {activeTab === 'filings' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Filters */}
                  <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative group flex-1">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={18} />
                      <input
                        type="text"
                        placeholder="SEARCH ORGANIZATIONS..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-card border-2 border-border px-12 py-3 text-foreground font-mono text-sm font-bold placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-all uppercase tracking-wider"
                      />
                    </div>

                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full md:w-48 bg-card border-2 border-border px-4 py-3 text-foreground font-sans text-sm font-semibold focus:border-accent outline-none appearance-none cursor-pointer"
                    >
                      <option value={currentYear.toString()}>{currentYear}</option>
                      <option value={(currentYear - 1).toString()}>{currentYear - 1}</option>
                      <option value={(currentYear - 2).toString()}>{currentYear - 2}</option>
                    </select>

                    <button
                      onClick={() => window.location.reload()}
                      className="px-6 py-3 bg-muted border-2 border-border text-foreground font-sans text-sm font-semibold hover:bg-accent hover:text-accent-foreground hover:text-black hover:border-accent transition-all"
                    >
                      Refresh
                    </button>
                  </div>

                  {/* Organization Cards */}
                  <div className="grid gap-6">
                    {filteredOrgs.map((org) => (
                      <div key={org.id} className="bg-card border-2 border-border p-8 hover:border-accent/50 transition-all duration-300 group">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="w-2 h-2 bg-accent text-accent-foreground rounded-full"></span>
                              <span className="font-mono text-xs text-accent font-bold uppercase tracking-wide">Registrant</span>
                              <span className="font-mono text-xs text-muted-foreground uppercase border border-border px-2 py-0.5">{org.registrant.state_display || "Federal"}</span>
                            </div>
                            <h3 className="font-serif text-3xl font-bold text-foreground mb-2">{org.registrant.name}</h3>
                            <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground uppercase">
                              <span>{org.filings.length} filings this year</span>
                              <span className="text-gray-700">|</span>
                              <span>{org.clientCount} clients</span>
                            </div>
                          </div>

                          <a
                            href={org.registrant.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 border border-border text-xs font-mono font-bold uppercase hover:bg-card hover:text-black transition-colors flex items-center gap-2"
                          >
                            View Details <ExternalLink size={12} />
                          </a>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                          <div className="p-4 bg-muted border border-white/5">
                            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                              <DollarSign size={14} />
                              <span className="font-sans text-xs text-muted-foreground">Total Income</span>
                            </div>
                            <div className="font-serif text-xl font-bold text-foreground">
                              {org.totalIncome > 0 ? formatCurrency(org.totalIncome) : 'N/A'}
                            </div>
                          </div>

                          <div className="p-4 bg-muted border border-white/5">
                            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                              <FileText size={14} />
                              <span className="font-sans text-xs text-muted-foreground">Filings</span>
                            </div>
                            <div className="font-serif text-xl font-bold text-foreground">{org.filings.length}</div>
                          </div>

                          <div className="p-4 bg-muted border border-white/5">
                            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                              <Users size={14} />
                              <span className="font-sans text-xs text-muted-foreground">Clients</span>
                            </div>
                            <div className="font-serif text-xl font-bold text-foreground">{org.clientCount}</div>
                          </div>

                          <div className="p-4 bg-muted border border-white/5">
                            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                              <TrendingUp size={14} />
                              <span className="font-sans text-xs text-muted-foreground">Issue Areas</span>
                            </div>
                            <div className="font-serif text-xl font-bold text-foreground">{org.issueAreas.length}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {org.issueAreas.map((issue, index) => (
                            <span key={index} className={`px-2 py-1 border text-[10px] font-mono font-bold uppercase ${getIssueColor(issue)}`}>
                              {issue}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'spenders' && renderWIP("Top Spenders")}
              {activeTab === 'firms' && renderWIP("Top Lobbying Firms")}
              {activeTab === 'industries' && renderWIP("Industry Spend")}
              {activeTab === 'recipients' && renderWIP("Top Recipients")}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
