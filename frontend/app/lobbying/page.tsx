"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Building2, DollarSign, Users, FileText, TrendingUp, ExternalLink, BarChart3, PieChart } from "lucide-react"
import {
  TopSpender,
  TopLobbyingFirm,
  Industry,
  LobbyistRecipient,
  parseTopSpenders,
  parseTopLobbyingFirms,
  parseIndustries,
  parseLobbyistRecipients,
  formatCurrency
} from "@/lib/csvUtils"
import { getRecentFilings, getRegistrants, Filing, Registrant } from "@/lib/services/lobbying"

// Get the current year for filtering recent data
const currentYear = new Date().getFullYear()

export default function LobbyingPage() {
  const [filings, setFilings] = useState<Filing[]>([])
  const [registrants, setRegistrants] = useState<Registrant[]>([])
  const [topSpenders, setTopSpenders] = useState<TopSpender[]>([])
  const [topFirms, setTopFirms] = useState<TopLobbyingFirm[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [recipients, setRecipients] = useState<LobbyistRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedYear, setSelectedYear] = useState(currentYear.toString())
  const [selectedPeriod, setSelectedPeriod] = useState("all")
  const [activeTab, setActiveTab] = useState("filings")

  useEffect(() => {
    const fetchLobbyingData = async () => {
      try {
        setLoading(true)

        // Fetch API data and CSV data in parallel
        const [
          filingsData,
          registrantsData,
          topSpendersResponse,
          topFirmsResponse,
          industriesResponse,
          recipients2024Response,
          recipients2022Response
        ] = await Promise.all([
          // API data via service
          getRecentFilings(1, 25),
          getRegistrants(1, 25),
          // CSV data
          fetch('/data/Top Spenders.csv'),
          fetch('/data/Top Lobbying Firms.csv'),
          fetch('/data/Industries.csv'),
          fetch('/data/Top Recipients of Contributions from Lobbyists, 2024 Cycle.csv'),
          fetch('/data/Top Recipients of Contributions from Lobbyists, 2022 Cycle.csv')
        ])

        // Process CSV data
        const topSpendersText = await topSpendersResponse.text()
        const topFirmsText = await topFirmsResponse.text()
        const industriesText = await industriesResponse.text()
        const recipients2024Text = await recipients2024Response.text()
        const recipients2022Text = await recipients2022Response.text()

        // Parse CSV data
        const parsedTopSpenders = parseTopSpenders(topSpendersText)
        const parsedTopFirms = parseTopLobbyingFirms(topFirmsText)
        const parsedIndustries = parseIndustries(industriesText)
        const parsedRecipients2024 = parseLobbyistRecipients(recipients2024Text, '2024')
        const parsedRecipients2022 = parseLobbyistRecipients(recipients2022Text, '2022')

        // Set state
        setFilings(filingsData.results || [])
        setRegistrants(registrantsData.results || [])
        setTopSpenders(parsedTopSpenders)
        setTopFirms(parsedTopFirms)
        setIndustries(parsedIndustries)
        setRecipients([...parsedRecipients2024, ...parsedRecipients2022])
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#ff4d00] selection:text-white pb-20">



      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">

        {/* Page Title */}
        <div className="mb-12">
          <h2 className="font-serif text-5xl md:text-6xl font-black text-white mb-4 leading-none tracking-tight">
            INFLUENCE <span className="text-[#ff4d00]">TRACKER</span>
          </h2>
          <p className="font-mono text-gray-400 max-w-xl text-sm uppercase tracking-wide">
            Follow the flow of money and political influence. Comprehensive data from Senate filings and historical spending records.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b-2 border-white/10 mb-8 overflow-x-auto">
          {['filings', 'spenders', 'firms', 'industries', 'recipients'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-4 font-mono text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === tab
                ? 'text-[#ff4d00]'
                : 'text-gray-500 hover:text-white'
                }`}
            >
              {tab === 'filings' ? 'Recent Filings' : tab === 'spenders' ? 'Top Spenders' : tab === 'firms' ? 'Top Firms' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#ff4d00]"></div>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-12 h-12 border-4 border-[#ff4d00] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error ? (
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
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 group-focus-within:text-[#ff4d00] transition-colors" size={18} />
                      <input
                        type="text"
                        placeholder="SEARCH ORGANIZATIONS..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#171717] border-2 border-white/10 px-12 py-3 text-white font-mono text-sm font-bold placeholder:text-gray-600 focus:outline-none focus:border-[#ff4d00] transition-all uppercase tracking-wider"
                      />
                    </div>

                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full md:w-48 bg-[#171717] border-2 border-white/10 px-4 py-3 text-white font-mono text-sm font-bold uppercase focus:border-[#ff4d00] outline-none appearance-none cursor-pointer"
                    >
                      <option value={currentYear.toString()}>{currentYear}</option>
                      <option value={(currentYear - 1).toString()}>{currentYear - 1}</option>
                      <option value={(currentYear - 2).toString()}>{currentYear - 2}</option>
                    </select>

                    <button
                      onClick={() => window.location.reload()}
                      className="px-6 py-3 bg-white/5 border-2 border-white/10 text-white font-mono text-sm font-bold uppercase hover:bg-[#ff4d00] hover:text-black hover:border-[#ff4d00] transition-all"
                    >
                      Refresh
                    </button>
                  </div>

                  {/* Organization Cards */}
                  <div className="grid gap-6">
                    {filteredOrgs.map((org) => (
                      <div key={org.id} className="bg-[#171717] border-2 border-white/10 p-8 hover:border-[#ff4d00]/50 transition-all duration-300 group">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="w-2 h-2 bg-[#ff4d00] rounded-full"></span>
                              <span className="font-mono text-xs text-[#ff4d00] font-bold uppercase tracking-widest">Registrant</span>
                              <span className="font-mono text-xs text-gray-500 uppercase border border-white/10 px-2 py-0.5">{org.registrant.state_display || "Federal"}</span>
                            </div>
                            <h3 className="font-serif text-3xl font-bold text-white mb-2">{org.registrant.name}</h3>
                            <div className="flex items-center gap-4 font-mono text-xs text-gray-400 uppercase">
                              <span>{org.filings.length} filings this year</span>
                              <span className="text-gray-700">|</span>
                              <span>{org.clientCount} clients</span>
                            </div>
                          </div>

                          <a
                            href={org.registrant.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 border border-white/20 text-xs font-mono font-bold uppercase hover:bg-white hover:text-black transition-colors flex items-center gap-2"
                          >
                            View Details <ExternalLink size={12} />
                          </a>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                          <div className="p-4 bg-black/20 border border-white/5">
                            <div className="flex items-center gap-2 mb-2 text-gray-500">
                              <DollarSign size={14} />
                              <span className="font-mono text-xs uppercase">Total Income</span>
                            </div>
                            <div className="font-serif text-xl font-bold text-white">
                              {org.totalIncome > 0 ? formatCurrency(org.totalIncome) : 'N/A'}
                            </div>
                          </div>

                          <div className="p-4 bg-black/20 border border-white/5">
                            <div className="flex items-center gap-2 mb-2 text-gray-500">
                              <FileText size={14} />
                              <span className="font-mono text-xs uppercase">Filings</span>
                            </div>
                            <div className="font-serif text-xl font-bold text-white">{org.filings.length}</div>
                          </div>

                          <div className="p-4 bg-black/20 border border-white/5">
                            <div className="flex items-center gap-2 mb-2 text-gray-500">
                              <Users size={14} />
                              <span className="font-mono text-xs uppercase">Clients</span>
                            </div>
                            <div className="font-serif text-xl font-bold text-white">{org.clientCount}</div>
                          </div>

                          <div className="p-4 bg-black/20 border border-white/5">
                            <div className="flex items-center gap-2 mb-2 text-gray-500">
                              <TrendingUp size={14} />
                              <span className="font-mono text-xs uppercase">Issue Areas</span>
                            </div>
                            <div className="font-serif text-xl font-bold text-white">{org.issueAreas.length}</div>
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

              {/* Top Spenders Tab */}
              {activeTab === 'spenders' && (
                <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {topSpenders.slice(0, 20).map((spender, index) => (
                    <div key={index} className="bg-[#171717] border-2 border-white/10 p-6 flex items-center justify-between hover:border-[#ff4d00]/50 transition-colors group">
                      <div className="flex items-center gap-6">
                        <div className="w-10 h-10 bg-[#ff4d00]/10 border border-[#ff4d00]/30 flex items-center justify-center font-mono font-bold text-[#ff4d00]">
                          #{index + 1}
                        </div>
                        <div>
                          <h4 className="font-serif text-xl font-bold text-white group-hover:text-[#ff4d00] transition-colors">{spender.client}</h4>
                          <div className="w-full h-1 bg-gray-800 mt-2 rounded-full overflow-hidden w-48 md:w-64">
                            <div
                              className="h-full bg-[#ff4d00]"
                              style={{ width: `${(spender.totalSpent / topSpenders[0]?.totalSpent) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xl font-bold text-white">{formatCurrency(spender.totalSpent)}</div>
                        <div className="font-mono text-xs text-gray-500 uppercase">Total Spent</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Top Firms Tab */}
              {activeTab === 'firms' && (
                <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {topFirms.slice(0, 20).map((firm, index) => (
                    <div key={index} className="bg-[#171717] border-2 border-white/10 p-6 flex items-center justify-between hover:border-[#ff4d00]/50 transition-colors group">
                      <div className="flex items-center gap-6">
                        <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center font-mono font-bold text-white">
                          #{index + 1}
                        </div>
                        <div>
                          <h4 className="font-serif text-xl font-bold text-white group-hover:text-[#ff4d00] transition-colors">{firm.firm}</h4>
                          <div className="w-full h-1 bg-gray-800 mt-2 rounded-full overflow-hidden w-48 md:w-64">
                            <div
                              className="h-full bg-white"
                              style={{ width: `${(firm.totalIncome / topFirms[0]?.totalIncome) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xl font-bold text-white">{formatCurrency(firm.totalIncome)}</div>
                        <div className="font-mono text-xs text-gray-500 uppercase">Total Income</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Industries Tab */}
              {activeTab === 'industries' && (
                <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {industries.slice(0, 20).map((industry, index) => (
                    <div key={index} className="bg-[#171717] border-2 border-white/10 p-6 flex items-center justify-between hover:border-[#ff4d00]/50 transition-colors group">
                      <div className="flex items-center gap-6">
                        <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center font-mono font-bold text-white">
                          #{index + 1}
                        </div>
                        <div>
                          <h4 className="font-serif text-xl font-bold text-white group-hover:text-[#ff4d00] transition-colors">{industry.name}</h4>
                          <div className="w-full h-1 bg-gray-800 mt-2 rounded-full overflow-hidden w-48 md:w-64">
                            <div
                              className="h-full bg-[#ff4d00]"
                              style={{ width: `${(industry.total / industries[0]?.total) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xl font-bold text-white">{formatCurrency(industry.total)}</div>
                        <div className="font-mono text-xs text-gray-500 uppercase">Total Spending</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recipients Tab */}
              {activeTab === 'recipients' && (
                <div className="grid md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-6 flex items-center gap-2">
                      <Users size={16} /> 2024 Election Cycle
                    </h3>
                    <div className="space-y-4">
                      {recipients.filter(r => r.cycle === '2024').slice(0, 10).map((recipient, index) => (
                        <div key={index} className="bg-[#171717] border-2 border-white/10 p-4 flex items-center justify-between hover:border-[#ff4d00]/50 transition-colors">
                          <div>
                            <div className="font-serif font-bold text-white">{recipient.recipient}</div>
                            <div className="text-[10px] font-mono text-gray-500 uppercase">
                              Inc. Family: {formatCurrency(recipient.fromLobbyistsFamily)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-[#ff4d00]">{formatCurrency(recipient.fromLobbyists)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-mono text-xs font-black text-white uppercase mb-6 flex items-center gap-2">
                      <Users size={16} /> 2022 Election Cycle
                    </h3>
                    <div className="space-y-4">
                      {recipients.filter(r => r.cycle === '2022').slice(0, 10).map((recipient, index) => (
                        <div key={index} className="bg-[#171717] border-2 border-white/10 p-4 flex items-center justify-between hover:border-white transition-colors">
                          <div>
                            <div className="font-serif font-bold text-white">{recipient.recipient}</div>
                            <div className="text-[10px] font-mono text-gray-500 uppercase">
                              Inc. Family: {formatCurrency(recipient.fromLobbyistsFamily)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-white">{formatCurrency(recipient.fromLobbyists)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
