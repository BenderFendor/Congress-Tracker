"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, ChevronDown, ChevronUp, FileText, Filter, Landmark } from "lucide-react"
import { ArchiveHero, ArchiveMetrics, ArchivePage, ArchivePanel, ArchiveSearch } from "@/components/ui/archive-ui"

type CongressBill = {
  id: string
  congress: number
  latestAction: { actionDate: string; text: string } | null
  number: string
  originChamber: string
  title: string
  type: string
  updateDate: string
  url: string
}

type BillDetail = {
  sponsors?: Array<{ bioguide_id?: string; name: string }>
  actions?: Array<{ action_date?: string; action_text: string }>
  committees?: Array<{ committee_id: string; name: string }>
  text_versions?: Array<{ url: string }>
}

export default function BillsPage() {
  const [bills, setBills] = useState<CongressBill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedChamber, setSelectedChamber] = useState("all")
  const [sortBy, setSortBy] = useState("recent")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [details, setDetails] = useState<Record<string, BillDetail | null>>({})

  useEffect(() => {
    async function fetchBills() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4020"}/api/bills?limit=100`)
        if (!response.ok) throw new Error(`Failed to fetch bills: ${response.statusText}`)
        const data = await response.json()
        setBills((data.bills || []).map((bill: Record<string, unknown>) => ({
          id: String(bill.bill_id || ""),
          congress: Number(bill.congress || 0),
          latestAction: bill.latest_action_text ? { actionDate: String(bill.latest_action_date || ""), text: String(bill.latest_action_text) } : null,
          number: String(bill.bill_number || ""),
          originChamber: String(bill.origin_chamber || ""),
          title: String(bill.title || ""),
          type: String(bill.bill_type || "").toUpperCase(),
          updateDate: String(bill.latest_action_date || bill.introduced_date || ""),
          url: String(bill.url || ""),
        })))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load bills")
      } finally {
        setLoading(false)
      }
    }

    fetchBills()
  }, [])

  const filteredBills = useMemo(() => {
    return bills
      .filter((bill) => {
        const search = searchTerm.toLowerCase()
        const matchesSearch = bill.title?.toLowerCase().includes(search) || bill.number?.toLowerCase().includes(search)
        const chamber = bill.originChamber?.toLowerCase()
        const matchesChamber = selectedChamber === "all" || chamber === selectedChamber
        return matchesSearch && matchesChamber
      })
      .sort((a, b) => {
        const dateA = new Date(a.updateDate || a.latestAction?.actionDate || 0).getTime()
        const dateB = new Date(b.updateDate || b.latestAction?.actionDate || 0).getTime()
        if (sortBy === "title") return a.title.localeCompare(b.title)
        return dateB - dateA
      })
  }, [bills, searchTerm, selectedChamber, sortBy])

  const houseBills = bills.filter((bill) => bill.originChamber === "House").length
  const senateBills = bills.filter((bill) => bill.originChamber === "Senate").length
  const recentActions = bills.filter((bill) => bill.latestAction?.actionDate).length

  async function toggleBill(bill: CongressBill) {
    const key = bill.id || bill.url || `${bill.type}-${bill.number}`
    setExpanded((current) => ({ ...current, [key]: !current[key] }))
    if (details[key] || !bill.id) return

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4020"}/api/bills/${encodeURIComponent(bill.id)}`)
    if (!response.ok) {
      setDetails((current) => ({ ...current, [key]: null }))
      return
    }
    const data = await response.json()
    setDetails((current) => ({ ...current, [key]: data || null }))
  }

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Bills"
        title="Legislative"
        accent="Stream."
        description="Real-time visibility into proposed legislation, chamber origin, latest actions, sponsors, committees, and bill text availability."
        mode="files"
        aside={
          <div>
            <div className="archive-panel-kicker">Bills overview</div>
            <div className="mt-5 grid place-items-center">
              <div className="grid h-36 w-36 place-items-center rounded-full border-[18px] border-accent/75 bg-card text-center">
                <span className="font-serif text-3xl">{bills.length || "..."}</span>
                <span className="-mt-8 text-xs text-muted-foreground">Total bills</span>
              </div>
            </div>
          </div>
        }
      />

      <ArchiveSearch value={searchTerm} onChange={setSearchTerm} placeholder="Search bills, keywords, sponsors, or topics">
        <select value={selectedChamber} onChange={(event) => setSelectedChamber(event.target.value)}>
          <option value="all">All Chambers</option>
          <option value="house">House</option>
          <option value="senate">Senate</option>
        </select>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="recent">Most Recent</option>
          <option value="title">Title A-Z</option>
        </select>
        <button className="inline-flex h-[3.2rem] items-center gap-2 border border-border bg-card px-4 text-sm font-semibold text-accent">
          <Filter size={15} /> More Filters
        </button>
      </ArchiveSearch>

      <ArchiveMetrics
        metrics={[
          { label: "Loaded bills", value: loading ? "..." : bills.length, detail: "Congress.gov feed", icon: <FileText size={20} /> },
          { label: "House origin", value: houseBills, detail: "Introduced in House", icon: <Landmark size={20} /> },
          { label: "Senate origin", value: senateBills, detail: "Introduced in Senate", icon: <Landmark size={20} /> },
          { label: "Latest actions", value: recentActions, detail: "With action dates", icon: <Calendar size={20} /> },
        ]}
      />

      <div className="archive-content archive-grid-two">
        <ArchivePanel title="Bill results" kicker="Legislative journey">
          {loading ? (
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          ) : error ? (
            <p className="py-10 text-sm text-red-500">{error}</p>
          ) : filteredBills.length === 0 ? (
            <p className="py-10 text-sm text-muted-foreground">No bills match the current filters.</p>
          ) : (
            <div className="archive-list">
              {filteredBills.slice(0, 40).map((bill, index) => {
                const key = bill.url || `${bill.type}-${bill.number}-${index}`
                const isExpanded = expanded[key]
                const detail = details[key]
                return (
                  <div key={key} className="archive-row">
                    <div className="grid gap-4 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-center">
                      <div>
                        <div className="font-mono text-lg font-bold text-accent">{bill.type}.{bill.number}</div>
                        <span className="archive-chip mt-2">{bill.originChamber || "Congress"}</span>
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-serif text-2xl text-foreground">{bill.title}</h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{bill.latestAction?.text || "No latest action listed."}</p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Calendar size={13} /> Updated {bill.updateDate || "N/A"}</span>
                          <span>Action {bill.latestAction?.actionDate || "N/A"}</span>
                        </div>
                      </div>
                      <button onClick={() => toggleBill(bill)} className="inline-flex items-center gap-2 border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-accent hover:text-accent">
                        Details {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                    {isExpanded ? (
                      <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm text-muted-foreground md:grid-cols-4">
                        <div><span className="archive-metric-label">Sponsors</span><strong className="mt-1 block text-foreground">{detail?.sponsors?.length ?? "Loading"}</strong></div>
                        <div><span className="archive-metric-label">Actions</span><strong className="mt-1 block text-foreground">{detail?.actions?.length ?? "Loading"}</strong></div>
                        <div><span className="archive-metric-label">Committees</span><strong className="mt-1 block text-foreground">{detail?.committees?.length ?? "N/A"}</strong></div>
                        <div><span className="archive-metric-label">Text versions</span><strong className="mt-1 block text-foreground">{detail?.text_versions?.length ?? "Loading"}</strong></div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </ArchivePanel>

        <ArchivePanel title="Trending topics" kicker="From loaded titles">
          <div className="space-y-4">
            {["Health", "Security", "Tax", "Technology", "Energy"].map((topic) => {
              const count = bills.filter((bill) => bill.title.toLowerCase().includes(topic.toLowerCase())).length
              return (
                <div key={topic}>
                  <div className="mb-1 flex justify-between text-sm"><span>{topic}</span><span>{count}</span></div>
                  <div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(8, (count / Math.max(1, bills.length)) * 100)}%` }} /></div>
                </div>
              )
            })}
          </div>
        </ArchivePanel>
      </div>
    </ArchivePage>
  )
}
