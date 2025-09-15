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
  stateCode: string
  partyHistory?: Array<{
    partyName: string
  }>
  imageUrl?: string
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
    startYear: number
    endYear?: number
  }>
  depiction?: {
    attribution: string
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
                                        {/* Member subcard */}
                                        {s.bioguideId && expanded[s.bioguideId] && (() => {
                                          const m = memberDetails[s.bioguideId];
                                          if (!m) return null;
                                          let partyColor = '#374151';
                                          const party = m.partyHistory && m.partyHistory.length > 0 ? m.partyHistory[0].partyName : '';
                                          if (party === 'Democratic') partyColor = '#2563eb';
                                          else if (party === 'Republican') partyColor = '#dc2626';
                                          else if (party === 'Independent') partyColor = '#ca8a04';
                                          return (
                                            <div className="rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row items-stretch max-w-2xl bg-[#10101ab4]">
                                              {/* Party color header */}
                                              <div className="w-full flex items-center gap-4 px-6 py-3" style={{ background: partyColor }}>
                                                <div className="flex-shrink-0">
                                                  {m.imageUrl && (
                                                    <img
                                                      src={m.imageUrl}
                                                      alt={m.directOrderName}
                                                      className="w-20 h-20 rounded-full border-4 border-white shadow-lg object-cover -mt-8 md:mt-0 md:-ml-8"
                                                      style={{ boxShadow: '0 4px 24px 0 rgba(0,0,0,0.5)' }}
                                                      loading="lazy"
                                                    />
                                                  )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="font-bold text-2xl text-white truncate">{m.directOrderName} {m.honorificName ? <span className="text-base text-gray-200">({m.honorificName})</span> : null}</div>
                                                  <div className="text-sm text-blue-100 mb-1">{m.state} ({m.stateCode})</div>
                                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="inline-block px-2 py-1 rounded-full font-semibold text-xs" style={{ background: partyColor, color: '#fff', border: '1px solid #fff' }}>{party}</span>
                                                    {m.officialWebsiteUrl && <a href={m.officialWebsiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-200 underline text-xs">Official Website</a>}
                                                  </div>
                                                </div>
                                              </div>
                                              {/* Card body */}
                                              <div className="flex-1 p-6 flex flex-col gap-2 text-white bg-[#10101ab4]">
                                                <div className="mb-1 text-xs text-gray-200">BioGuide ID: {m.bioguideId}</div>
                                                {m.addressInformation && (
                                                  <div className="mb-1 text-xs text-gray-200">Address: {m.addressInformation.city}{m.addressInformation.district ? `, District ${m.addressInformation.district}` : ''} {m.addressInformation.zipCode || ''}</div>
                                                )}
                                                <div className="mb-1 text-xs text-gray-200">Born: {m.birthYear || 'N/A'}</div>
                                                <div className="mb-1 text-xs text-gray-200">Current Member: {m.currentMember ? 'Yes' : 'No'}</div>
                                                <div className="mb-1 text-xs text-gray-200">Updated: {m.updateDate ? new Date(m.updateDate).toLocaleDateString() : ''}</div>
                                                {m.sponsoredLegislation && (
                                                  <div className="mb-1 text-xs">
                                                    <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(m.sponsoredLegislation!.url)}`,'_blank')}} className="text-blue-200 underline">Sponsored Legislation ({m.sponsoredLegislation.count})</a>
                                                  </div>
                                                )}
                                                {m.cosponsoredLegislation && (
                                                  <div className="mb-1 text-xs">
                                                    <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(m.cosponsoredLegislation!.url)}`,'_blank')}} className="text-blue-200 underline">Cosponsored Legislation ({m.cosponsoredLegislation.count})</a>
                                                  </div>
                                                )}
                                                {m.terms && m.terms.length > 0 && (
                                                  <div className="mb-1 text-xs text-gray-100">Terms:
                                                    <ul className="ml-4 list-disc">
                                                      {m.terms.map((t: any, ti: number) => (
                                                        <li key={ti}>{t.chamber} ({t.memberType}), Congress {t.congress}, {t.stateName} {t.startYear}{t.endYear ? `–${t.endYear}` : ''}</li>
                                                      ))}
                                                    </ul>
                                                  </div>
                                                )}
                                                {m.depiction && m.depiction.attribution && (
                                                  <div className="mb-1 text-xs text-gray-300" dangerouslySetInnerHTML={{ __html: m.depiction.attribution }} />
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                        {s.bioguideId && memberLoading[s.bioguideId] && <div>Loading member...</div>}
                                        {s.bioguideId && memberError[s.bioguideId] && <div className="text-red-400">{memberError[s.bioguideId]}</div>}
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
                              {d.committees && d.committees.url && (
                                <div className="mb-2">
                                  <strong>Committees:</strong> <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(d.committees!.url)}`,'_blank')}} className="text-blue-400 underline">View Committees ({d.committees.count})</a>
                                  <span className="ml-2 text-xs">
                                    <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(d.committees!.url)}`,'_blank')}} className="text-blue-300 underline">API</a>
                                  </span>
                                </div>
                              )}
                              {d.committeeReports && d.committeeReports.length > 0 && (
                                <div className="mb-2">
                                  <strong>Committee Reports:</strong>
                                  <ul className="list-disc ml-5">
                                    {d.committeeReports.map((r, i) => (
                                      <li key={i}>
                                        <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(r.url)}`,'_blank')}} className="text-blue-400 underline">{r.citation}</a>
                                        <span className="ml-2 text-xs">
                                          <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(r.url)}`,'_blank')}} className="text-blue-300 underline">API</a>
                                        </span>
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
                              {d.titles && d.titles.url && (
                                <div className="mb-2">
                                  <strong>Titles:</strong> <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(d.titles!.url)}`,'_blank')}} className="text-blue-400 underline">View Titles ({d.titles.count})</a>
                                  <span className="ml-2 text-xs">
                                    <a href="#" onClick={e => {e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(d.titles!.url)}`,'_blank')}} className="text-blue-300 underline">API</a>
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
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
