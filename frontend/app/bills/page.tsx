"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Calendar, FileText, ExternalLink, ChevronDown, ChevronUp, Info } from "lucide-react"

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

  const filteredBills = bills.filter((bill) => {
    const matchesSearch =
      bill.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.number?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#ff4d00] selection:text-white pb-20">



      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">

        {/* Search & Filter Section */}
        <div className="mb-12 animate-stagger-item delay-1">
          <div className="flex flex-col lg:flex-row gap-6 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#ff4d00]" size={20} />
              <input
                type="text"
                placeholder="SEARCH LEGISLATION..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#171717] border-2 border-white/10 px-12 py-4 text-white font-mono font-bold placeholder:text-gray-600 focus:outline-none focus:border-[#ff4d00] transition-all uppercase tracking-wider"
              />
            </div>
            <button className="flex items-center justify-center gap-2 bg-white/5 border-2 border-white/10 px-8 py-4 font-mono font-bold uppercase hover:bg-white/10 hover:border-[#ff4d00] transition-all text-[#ff4d00]">
              <Filter size={16} />
              Advanced Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#171717] border-2 border-white/10 px-4 py-3 text-white font-mono text-sm uppercase focus:border-[#ff4d00] outline-none appearance-none"
            >
              <option value="all">All Statuses</option>
              <option value="committee">Committee Review</option>
              <option value="passed">Passed</option>
              <option value="signed">Signed into Law</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#171717] border-2 border-white/10 px-4 py-3 text-white font-mono text-sm uppercase focus:border-[#ff4d00] outline-none appearance-none"
            >
              <option value="all">All Categories</option>
              <option value="environment">Environment</option>
              <option value="healthcare">Healthcare</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="tax policy">Tax Policy</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#171717] border-2 border-white/10 px-4 py-3 text-white font-mono text-sm uppercase focus:border-[#ff4d00] outline-none appearance-none"
            >
              <option value="recent">Most Recent</option>
              <option value="lobbying">Lobbying Spend</option>
              <option value="cosponsors">Most Cosponsors</option>
              <option value="donations">Related Donations</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="mb-6 flex items-center gap-2 text-gray-500 font-mono text-xs uppercase tracking-widest">
          <div className="w-2 h-2 bg-[#ff4d00] rounded-full animate-pulse"></div>
          Showing {filteredBills.length} of {bills.length} bills
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-[#ff4d00] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 font-mono text-center py-20">{error}</div>
        ) : (
          <div className="space-y-6">
            {filteredBills.map((bill, idx) => (
              <div key={bill.number + bill.type + idx} className="bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-all duration-300 group animate-stagger-item">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="font-mono text-xs font-black bg-white/10 px-2 py-1 text-[#ff4d00] uppercase">
                        {bill.type}.{bill.number}
                      </span>
                      <span className={`font-mono text-xs font-bold px-2 py-1 uppercase ${bill.originChamber === 'Senate' ? 'text-blue-400 bg-blue-900/20' :
                        bill.originChamber === 'House' ? 'text-green-400 bg-green-900/20' : 'text-gray-400'
                        }`}>
                        {bill.originChamber}
                      </span>
                    </div>

                    <h2 className="font-serif text-2xl font-bold text-white mb-3 group-hover:text-[#ff4d00] transition-colors leading-tight">
                      {bill.title}
                    </h2>

                    <p className="font-mono text-sm text-gray-400 mb-4 border-l-2 border-white/20 pl-4">
                      {bill.latestAction?.text || "No recent action."}
                    </p>

                    <div className="flex flex-wrap items-center gap-6 text-xs font-mono font-bold text-gray-500 uppercase">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        Updated: {bill.updateDate}
                      </div>
                      <div className="flex items-center gap-2">
                        <Info size={14} />
                        Action: {bill.latestAction?.actionDate || "N/A"}
                      </div>
                    </div>
                  </div>

                  <button
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

                          // Auto-load titles, committees, actions
                          const billDetails = data.bill
                          const fetchSubResource = async (subUrl: string, setter: any) => {
                            try {
                              const r = await fetch(`/api/congress-proxy?url=${encodeURIComponent(subUrl)}`)
                              if (r.ok) {
                                const data = await r.json()
                                setter((prev: any) => ({ ...prev, [bill.url]: data }))
                              }
                            } catch (e) { console.error(e) }
                          }

                          if (billDetails.titles?.url) fetchSubResource(billDetails.titles.url, setTitlesData);
                          if (billDetails.committees?.url) fetchSubResource(billDetails.committees.url, setCommitteesData);
                          if (billDetails.actions?.url) fetchSubResource(billDetails.actions.url, setActionsData);

                          // Auto-load sponsor member details
                          if (billDetails.sponsors && billDetails.sponsors.length > 0) {
                            billDetails.sponsors.forEach(async (sponsor: any) => {
                              if (sponsor.bioguideId && !memberDetails[sponsor.bioguideId]) {
                                setMemberLoading(prev => ({ ...prev, [sponsor.bioguideId]: true }));
                                try {
                                  const memberUrl = `https://api.congress.gov/v3/member/${sponsor.bioguideId}`;
                                  const memberRes = await fetch(`/api/congress-proxy?url=${encodeURIComponent(memberUrl)}`);
                                  if (memberRes.ok) {
                                    const memberData = await memberRes.json();
                                    setMemberDetails(prev => ({ ...prev, [sponsor.bioguideId]: memberData.member }));
                                    setExpanded(prev => ({ ...prev, [sponsor.bioguideId]: true }));
                                  }
                                } catch (e: any) {
                                  setMemberError(prev => ({ ...prev, [sponsor.bioguideId]: e.message }));
                                } finally {
                                  setMemberLoading(prev => ({ ...prev, [sponsor.bioguideId]: false }));
                                }
                              }
                            });
                          }
                        } catch (e: any) {
                          setDetailsError((prev) => ({ ...prev, [bill.url]: e.message }))
                        } finally {
                          setDetailsLoading((prev) => ({ ...prev, [bill.url]: false }))
                        }
                      }
                    }}
                    className="flex items-center gap-2 px-6 py-3 border border-white/20 hover:bg-[#ff4d00] hover:text-black hover:border-[#ff4d00] transition-all font-mono text-xs font-bold uppercase tracking-widest"
                  >
                    {expanded[bill.url] ? "Hide Details" : "View Details"}
                    {expanded[bill.url] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Expanded Details */}
                {expanded[bill.url] && (
                  <div className="mt-8 pt-8 border-t-2 border-white/10 animate-fadeInUp">
                    {detailsLoading[bill.url] && <div className="font-mono text-xs text-[#ff4d00] animate-pulse">LOADING INTELLIGENCE...</div>}
                    {detailsError[bill.url] && <div className="text-red-500 font-mono text-xs">{detailsError[bill.url]}</div>}

                    {details[bill.url] && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                          <div>
                            <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-2">Metadata</h3>
                            <div className="space-y-2">
                              <a href={bill.legislationUrl} target="_blank" rel="noopener noreferrer" className="block font-mono text-xs text-white hover:text-[#ff4d00] underline decoration-white/30 underline-offset-4">
                                Official Congress.gov Page <ExternalLink size={10} className="inline ml-1" />
                              </a>
                              <a href="#" onClick={e => { e.preventDefault(); window.open(`/api/congress-proxy?url=${encodeURIComponent(bill.url + '?format=json')}`, '_blank') }} className="block font-mono text-xs text-gray-500 hover:text-white underline decoration-white/10 underline-offset-4">
                                Raw JSON Data
                              </a>
                            </div>
                          </div>

                          {details[bill.url]?.sponsors && details[bill.url]!.sponsors!.length > 0 && (
                            <div>
                              <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-2">Sponsors</h3>
                              <ul className="space-y-1">
                                {details[bill.url]!.sponsors!.map((s: any, i: number) => (
                                  <li key={i} className="font-serif text-sm text-white">{s.fullName}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {committeesData[bill.url] && (
                            <div>
                              <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-2">Committees</h3>
                              <ul className="space-y-1">
                                {committeesData[bill.url].committees?.map((c: any, i: number) => (
                                  <li key={i} className="font-mono text-xs text-gray-400">{c.name}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="lg:col-span-2 space-y-6">
                          {actionsData[bill.url] && (
                            <div>
                              <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-4">Recent Actions</h3>
                              <div className="space-y-4 border-l border-white/10 pl-4">
                                {actionsData[bill.url].actions?.slice(0, 5).map((action: any, i: number) => (
                                  <div key={i} className="relative">
                                    <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-white/20"></div>
                                    <p className="font-serif text-sm text-white mb-1">{action.text}</p>
                                    <span className="font-mono text-[10px] text-gray-500 uppercase">{action.actionDate}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Member Cards Grid */}
                          {details[bill.url]?.sponsors?.some(s => s.bioguideId && memberDetails[s.bioguideId]) && (
                            <div className="pt-6 border-t border-white/10">
                              <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-4">Sponsor Profiles</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {details[bill.url]!.sponsors!.map((s, i) => {
                                  if (!s.bioguideId || !memberDetails[s.bioguideId]) return null;
                                  const m = memberDetails[s.bioguideId];
                                  const isDem = m.partyHistory?.[0]?.partyName === 'Democratic';
                                  const isRep = m.partyHistory?.[0]?.partyName === 'Republican';
                                  const partyColor = isDem ? 'border-blue-500' : isRep ? 'border-red-500' : 'border-yellow-500';

                                  return (
                                    <div key={s.bioguideId} className={`bg-black border-l-4 ${partyColor} p-4 flex gap-4 items-start`}>
                                      {m.depiction?.imageUrl && (
                                        <img src={m.depiction.imageUrl} alt={m.directOrderName} className="w-12 h-12 object-cover grayscale contrast-125" />
                                      )}
                                      <div>
                                        <h4 className="font-serif font-bold text-white leading-none mb-1">{m.directOrderName}</h4>
                                        <p className="font-mono text-xs text-gray-500 uppercase mb-2">{m.state} — {m.partyHistory?.[0]?.partyName}</p>
                                        <div className="flex gap-2 text-[10px] font-mono font-bold text-gray-600">
                                          <span>BORN: {m.birthYear}</span>
                                          <span>•</span>
                                          <span>{m.currentMember ? 'ACTIVE' : 'INACTIVE'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center mt-12 mb-20">
          <button className="px-8 py-4 bg-white/5 border-2 border-white/10 hover:bg-[#ff4d00] hover:text-black hover:border-[#ff4d00] transition-all font-mono text-sm font-bold uppercase tracking-widest">
            Load More Legislation
          </button>
        </div>

      </div>
    </div>
  )
}
