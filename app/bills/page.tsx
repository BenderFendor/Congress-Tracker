"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Calendar, FileText, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Bill {
  congress: number
  latestAction: {
    actionDate: string
    text: string
  } | null
  number: string
  originChamber: string
  title: string
  type: string
  updateDate: string
  url: string
  legislationUrl?: string
}

interface BillDetails {
  sponsors?: Array<{
    bioguideId?: string
    fullName: string
    url: string
  }>
  actions?: {
    count: number
    url: string
  }
  committees?: {
    count: number
    url: string
  }
  committeeReports?: Array<{
    citation: string
    url: string
  }>
  textVersions?: {
    count: number
    url: string
  }
  titles?: {
    count: number
    url: string
  }
}

interface MemberDetails {
  bioguideId: string
  directOrderName: string
  honorificName?: string
  state: string
  partyHistory?: Array<{
    partyName: string
  }>
  officialWebsiteUrl?: string
  addressInformation?: {
    city: string
    district?: string
    zipCode?: string
  }
  birthYear?: number
  currentMember: boolean
  updateDate?: string
  sponsoredLegislation?: {
    count: number
    url: string
  }
  cosponsoredLegislation?: {
    count: number
    url: string
  }
  terms?: Array<{
    chamber: string
    memberType: string
    congress: number
    stateName: string
    stateCode: string
    startYear: number
    endYear?: number
  }>
  depiction?: {
    attribution: string
    imageUrl: string
  }
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [details, setDetails] = useState<Record<string, BillDetails | null>>({})
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({})
  const [detailsError, setDetailsError] = useState<Record<string, string | null>>({})
  const [memberDetails, setMemberDetails] = useState<Record<string, MemberDetails>>({})
  const [memberLoading, setMemberLoading] = useState<Record<string, boolean>>({})
  const [memberError, setMemberError] = useState<Record<string, string | null>>({})
  const [titlesData, setTitlesData] = useState<Record<string, any>>({})
  const [committeesData, setCommitteesData] = useState<Record<string, any>>({})
  const [actionsData, setActionsData] = useState<Record<string, any>>({})

  useEffect(() => {
    const fetchBills = async () => {
      try {
        const url = "https://api.congress.gov/v3/bill"
        const res = await fetch(`/api/congress-proxy?url=${encodeURIComponent(url)}`)
        if (!res.ok) throw new Error("Failed to fetch bills")
        const data = await res.json()
        setBills(data.bills || [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchBills()
  }, [])

  if (loading) return <div className="p-8 text-center">Loading bills...</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>

  const filteredBills = bills.filter((bill) => {
    const matchesSearch =
      bill.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.number?.toLowerCase().includes(searchTerm.toLowerCase())
    // No status/category in API, so always true
    return matchesSearch
  })

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "signed into law":
        return "default"
      case "passed senate":
      case "passed house":
        return "secondary"
      case "committee review":
      case "house review":
        return "outline"
      default:
        return "outline"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Bill Explorer</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Home
              </a>
              <a href="/legislators" className="text-muted-foreground hover:text-foreground transition-colors">
                Legislators
              </a>
              <a href="/lobbying" className="text-muted-foreground hover:text-foreground transition-colors">
                Lobbying
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                placeholder="Search bills by title, number, or sponsor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="lg:w-auto bg-transparent">
              <Filter className="h-4 w-4 mr-2" />
              Advanced Search
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="committee">Committee Review</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="signed">Signed into Law</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="environment">Environment</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="infrastructure">Infrastructure</SelectItem>
                <SelectItem value="tax policy">Tax Policy</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="lobbying">Lobbying Spend</SelectItem>
                <SelectItem value="cosponsors">Most Cosponsors</SelectItem>
                <SelectItem value="donations">Related Donations</SelectItem>
              </SelectContent>
            </Select>

            <Button className="w-full">Apply Filters</Button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-muted-foreground">
            Showing {filteredBills.length} of {bills.length} bills
          </p>
        </div>

        {/* Bill Cards */}
        <div className="grid gap-6">
          {filteredBills.map((bill, idx) => (
            <Card key={bill.number + bill.type + idx} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className="font-mono">
                        {bill.type}.{bill.number}
                      </Badge>
                      <Badge
                        className={
                          bill.originChamber === 'Senate'
                            ? 'bg-blue-700 text-white'
                            : bill.originChamber === 'House'
                            ? 'bg-green-700 text-white'
                            : 'bg-gray-500 text-white'
                        }
                      >
                        {bill.originChamber}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl mb-2">{bill.title}</CardTitle>
                    <CardDescription className="text-base mb-4">
                      {bill.latestAction?.text || "No recent action."}
                    </CardDescription>
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          Last Updated {bill.updateDate}
                        </span>
                        <span>Action Date: {bill.latestAction?.actionDate || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setExpanded((prev) => ({ ...prev, [bill.url]: !prev[bill.url] }))
                          if (!details[bill.url] && !detailsLoading[bill.url]) {
                            setDetailsLoading((prev) => ({ ...prev, [bill.url]: true }))
                            setDetailsError((prev) => ({ ...prev, [bill.url]: null }))
                            try {
                              const url = `${bill.url}?format=json`
                              const res = await fetch(`/api/congress-proxy?url=${encodeURIComponent(url)}`)
                              if (!res.ok) throw new Error("Failed to fetch bill details")
                              const data = await res.json()
                              setDetails((prev) => ({ ...prev, [bill.url]: data.bill }))
                              
                              // Auto-load titles and committees data
                              const billDetails = data.bill
                              if (billDetails.titles?.url) {
                                try {
                                  const titlesRes = await fetch(`/api/congress-proxy?url=${encodeURIComponent(billDetails.titles.url)}`)
                                  if (titlesRes.ok) {
                                    const titlesData = await titlesRes.json()
                                    setTitlesData((prev) => ({ ...prev, [bill.url]: titlesData }))
                                  }
                                } catch (e) {
                                  console.error('Failed to fetch titles:', e)
                                }
                              }
                              
                              if (billDetails.committees?.url) {
                                try {
                                  const committeesRes = await fetch(`/api/congress-proxy?url=${encodeURIComponent(billDetails.committees.url)}`)
                                  if (committeesRes.ok) {
                                    const committeesData = await committeesRes.json()
                                    setCommitteesData((prev) => ({ ...prev, [bill.url]: committeesData }))
                                  }
                                } catch (e) {
                                  console.error('Failed to fetch committees:', e)
                                }
                              }
                            } catch (e: any) {
                              setDetailsError((prev) => ({ ...prev, [bill.url]: e.message }))
                            } finally {
                              setDetailsLoading((prev) => ({ ...prev, [bill.url]: false }))
                            }
                          }
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {expanded[bill.url] ? "Hide Details" : "View Details"}
                      </Button>
                  {expanded[bill.url] && (
                    <div className="mt-4">
                      <div className="rounded-lg bg-gray-900 text-white p-4 shadow-inner">
                        {detailsLoading[bill.url] && <div>Loading...</div>}
                        {detailsError[bill.url] && <div className="text-red-400">{detailsError[bill.url]}</div>}
                        {details[bill.url] && details[bill.url] !== null && (() => {
                          const d = details[bill.url]
                          if (!d) return null
                          return (
                            <div>
                              <div className="mb-2 flex flex-col gap-1">
                                <a href={bill.legislationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-semibold">Congress.gov Bill Page</a>
                                <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(bill.url + '?format=json')}`,'_blank')}} className="text-xs text-blue-300 underline">API: Bill JSON</a>
                              </div>
                              <div className="mb-2">
                                <strong>Title:</strong> {bill.title}
                              </div>
                              {d.sponsors && d.sponsors.length > 0 && (
                                <div className="mb-2">
                                  <strong>Sponsors:</strong>
                                  <ul className="list-none ml-0">
                                    {d.sponsors.map((s, i) => (
                                      <li key={i} className="mb-2">
                                        <span className="flex items-center gap-2">
                                          <a href="#" onClick={async e => {
                                            e.preventDefault();
                                            if (!s.bioguideId) return;
                                            setMemberLoading(prev => ({ ...prev, [s.bioguideId!]: true }));
                                            setMemberError(prev => ({ ...prev, [s.bioguideId!]: null }));
                                            try {
                                              const url = `https://api.congress.gov/v3/member/${s.bioguideId}`;
                                              const res = await fetch(`/api/congress-proxy?url=${encodeURIComponent(url)}`);
                                              if (!res.ok) throw new Error('Failed to fetch member details');
                                              const data = await res.json();
                                              setMemberDetails(prev => ({ ...prev, [s.bioguideId!]: data.member }));
                                            } catch (e: any) {
                                              setMemberError(prev => ({ ...prev, [s.bioguideId!]: e.message }));
                                            } finally {
                                              setMemberLoading(prev => ({ ...prev, [s.bioguideId!]: false }));
                                            }
                                            setExpanded(prev => ({ ...prev, [s.bioguideId!]: !prev[s.bioguideId!] }));
                                          }} className="text-blue-400 underline cursor-pointer font-semibold hover:text-blue-300 transition-colors">
                                            {s.fullName}
                                          </a>
                                          <span className="ml-2 text-xs">
                                            <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(s.url)}`,'_blank')}} className="text-blue-300 underline">API</a>
                                          </span>
                                        </span>
                                        {s.bioguideId && memberLoading[s.bioguideId] && <div className="ml-4 text-xs">Loading member...</div>}
                                        {s.bioguideId && memberError[s.bioguideId] && <div className="ml-4 text-red-400 text-xs">{memberError[s.bioguideId]}</div>}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {d.actions && d.actions.url && (
                                <div className="mb-2">
                                  <strong>Actions:</strong> <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(d.actions!.url)}`,'_blank')}} className="text-blue-400 underline">View Actions ({d.actions.count})</a>
                                  <span className="ml-2 text-xs">
                                    <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(d.actions!.url)}`,'_blank')}} className="text-blue-300 underline">API</a>
                                  </span>
                                </div>
                              )}
                              {committeesData[bill.url] && (
                                <div className="mb-2">
                                  <strong>Committees:</strong> <span className="text-sm text-blue-300">
                                    {committeesData[bill.url].committees?.map((committee: any) => committee.name).join(', ') || 'None'}
                                  </span>
                                </div>
                              )}
                              {d.committeeReports && d.committeeReports.length > 0 && (
                                <div className="mb-2">
                                  <strong>Committee Reports:</strong>
                                  <ul className="list-disc ml-5">
                                    {d.committeeReports.map((r, i) => (
                                      <li key={i}>
                                        <span className="text-blue-400">{r.citation}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {d.textVersions && d.textVersions.url && (
                                <div className="mb-2">
                                  <strong>Text Versions:</strong> <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(d.textVersions!.url)}`,'_blank')}} className="text-blue-400 underline">View Text ({d.textVersions.count})</a>
                                  <span className="ml-2 text-xs">
                                    <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(d.textVersions!.url)}`,'_blank')}} className="text-blue-300 underline">API</a>
                                  </span>
                                </div>
                              )}
                              {titlesData[bill.url] && (
                                <div className="mb-2">
                                  <strong>Titles:</strong> <span className="text-sm text-blue-300">
                                    {titlesData[bill.url].titles?.map((title: any) => title.titleType).join(', ') || 'None'}
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                      
                      {/* Member subcards - outside the bill details container */}
                      {details[bill.url]?.sponsors?.map((s, i) => (
                        s.bioguideId && expanded[s.bioguideId] && (() => {
                          const m = memberDetails[s.bioguideId];
                          if (!m) return null;
                          let partyColor = '#374151';
                          const party = m.partyHistory && m.partyHistory.length > 0 ? m.partyHistory[0].partyName : '';
                          if (party === 'Democratic') partyColor = '#2563eb';
                          else if (party === 'Republican') partyColor = '#dc2626';
                          else if (party === 'Independent') partyColor = '#ca8a04';
                          return (
                            <div key={s.bioguideId} className="mt-4 rounded-lg overflow-hidden shadow-xl flex items-start gap-3 min-w-80 max-w-lg bg-black border-2 p-3" style={{ borderColor: partyColor }}>
                              {/* Member Photo */}
                              <div className="flex-shrink-0">
                                {m.depiction?.imageUrl && (
                                  <img
                                    src={m.depiction.imageUrl}
                                    alt={m.directOrderName}
                                    className="w-16 h-16 rounded-full border-2 shadow-lg object-cover"
                                    style={{ borderColor: partyColor }}
                                    loading="lazy"
                                  />
                                )}
                              </div>
                              
                              {/* Member Info */}
                              <div className="flex-1 min-w-0">
                                <div 
                                  className="font-bold text-lg text-white truncate"
                                  style={{ 
                                    textShadow: `2px 2px 4px ${partyColor}40, 0 0 8px ${partyColor}20`,
                                    color: '#fff'
                                  }}
                                >
                                  {m.directOrderName}
                                  {m.honorificName && (
                                    <span className="text-sm text-gray-300 ml-1">({m.honorificName})</span>
                                  )}
                                </div>
                                
                                <div 
                                  className="text-sm mb-1"
                                  style={{ 
                                    textShadow: `1px 1px 2px ${partyColor}60`,
                                    color: '#e5e7eb'
                                  }}
                                >
                                  {m.state} ({m.terms && m.terms.length > 0 ? m.terms[0].stateCode : 'N/A'})
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-2">
                                  <span 
                                    className="inline-block px-2 py-1 rounded-full font-semibold text-xs text-white"
                                    style={{ 
                                      background: partyColor,
                                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                                    }}
                                  >
                                    {party}
                                  </span>
                                  {m.officialWebsiteUrl && (
                                    <a 
                                      href={m.officialWebsiteUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-blue-300 underline text-xs hover:text-blue-200"
                                      style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                                    >
                                      Website
                                    </a>
                                  )}
                                </div>
                                
                                <div className="mt-2 space-y-1">
                                  <div 
                                    className="text-xs"
                                    style={{ 
                                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                                      color: '#d1d5db'
                                    }}
                                  >
                                    Born: {m.birthYear || 'N/A'}
                                  </div>
                                  <div 
                                    className="text-xs"
                                    style={{ 
                                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                                      color: '#d1d5db'
                                    }}
                                  >
                                    Current: {m.currentMember ? 'Yes' : 'No'}
                                  </div>
                                  {m.sponsoredLegislation && (
                                    <div className="text-xs">
                                      <a 
                                        href="#" 
                                        onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(m.sponsoredLegislation!.url)}`,'_blank')}} 
                                        className="text-blue-300 underline hover:text-blue-200"
                                        style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                                      >
                                        Sponsored: {m.sponsoredLegislation.count}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Load More */}
        <div className="text-center mt-8">
          <Button variant="outline" size="lg">
            Load More Bills
          </Button>
        </div>
      </div>
    </div>
  )
}
