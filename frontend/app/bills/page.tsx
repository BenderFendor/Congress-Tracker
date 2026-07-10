"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, ChevronDown, ChevronUp, ExternalLink, FileText, Landmark, X } from "lucide-react"
import { ArchivePage, ArchivePanel, ArchiveSearch, DataState, EvidenceSpine } from "@/components/ui/archive-ui"
import { BillFlowVisual, CompactMasthead } from "@/components/ui/mockup-visuals"

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeBillIdentifier(value: string): string {
  return value.toLowerCase().replace(/[.\s-]/g, "")
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
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({})
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({})
  const [selectedBillKey, setSelectedBillKey] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(40)

  useEffect(() => {
    let cancelled = false
    async function fetchBills() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4020"}/api/bills?limit=100`)
        if (!response.ok) throw new Error(`Failed to fetch bills: ${response.statusText}`)
        const data: unknown = await response.json()
        if (!isRecord(data) || !Array.isArray(data.bills) || !data.bills.every(isRecord)) {
          throw new Error("Bill response did not match the expected record list")
        }
        if (cancelled) return
        setBills(data.bills.map((bill) => ({
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
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load bills")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchBills()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredBills = useMemo(() => {
    return bills
      .filter((bill) => {
        const search = searchTerm.trim().toLowerCase()
        const identifier = `${bill.type}.${bill.number}`
        const matchesSearch = bill.title?.toLowerCase().includes(search) ||
          normalizeBillIdentifier(identifier).includes(normalizeBillIdentifier(search))
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
  const activeFilterCount = Number(Boolean(searchTerm.trim())) + Number(selectedChamber !== "all") + Number(sortBy !== "recent")

  function billKey(bill: CongressBill) {
    return bill.id || bill.url || `${bill.type}-${bill.number}-${bill.congress}`
  }

  async function toggleBill(bill: CongressBill) {
    const key = billKey(bill)
    setSelectedBillKey(key)
    setExpanded((current) => ({ ...current, [key]: !current[key] }))
    if (details[key] || detailLoading[key] || !bill.id) return

    setDetailLoading((current) => ({ ...current, [key]: true }))
    setDetailErrors((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4020"}/api/bills/${encodeURIComponent(bill.id)}`)
      if (!response.ok) throw new Error(`Bill detail request failed (${response.status})`)
      const data = await response.json()
      setDetails((current) => ({ ...current, [key]: data || null }))
    } catch (detailError) {
      setDetailErrors((current) => ({
        ...current,
        [key]: detailError instanceof Error ? detailError.message : "Bill details are unavailable",
      }))
    } finally {
      setDetailLoading((current) => ({ ...current, [key]: false }))
    }
  }

  function clearFilters() {
    setSearchTerm("")
    setSelectedChamber("all")
    setSortBy("recent")
    setVisibleCount(40)
  }

  const selectedBill = selectedBillKey
    ? bills.find((bill) => billKey(bill) === selectedBillKey) ?? null
    : null

  return (
    <ArchivePage>
      <CompactMasthead
        eyebrow="Legislative intelligence"
        title="Legislative"
        accent="stream."
        description="Search official bill records, inspect their latest actions, and open source-linked sponsor, committee, and text details."
        visual={
          <BillFlowVisual
            steps={["Filed", "Committee", "House", "Senate", "Enacted"]}
            activeStep={1}
          />
        }
      />

      <ArchiveSearch value={searchTerm} onChange={(value) => { setSearchTerm(value); setVisibleCount(40) }} placeholder="Search bill titles or identifiers">
        <select aria-label="Filter bills by chamber" value={selectedChamber} onChange={(event) => { setSelectedChamber(event.target.value); setVisibleCount(40) }}>
          <option value="all">All Chambers</option>
          <option value="house">House</option>
          <option value="senate">Senate</option>
        </select>
        <select aria-label="Sort bills" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setVisibleCount(40) }}>
          <option value="recent">Most Recent</option>
          <option value="title">Title A-Z</option>
        </select>
      </ArchiveSearch>

      <div className="mx-auto -mt-3 mb-4 flex w-[calc(100%-2rem)] max-w-[106rem] flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        <strong className="text-foreground">{filteredBills.length} results</strong>
        {selectedChamber !== "all" ? <span className="archive-chip">Chamber: {selectedChamber}</span> : null}
        {sortBy !== "recent" ? <span className="archive-chip">Sort: title</span> : null}
        {searchTerm.trim() ? <span className="archive-chip">Query: {searchTerm.trim()}</span> : null}
        {activeFilterCount > 0 ? (
          <button className="ml-auto inline-flex min-h-10 items-center gap-1 px-2 font-semibold text-accent" onClick={clearFilters}>
            <X size={14} /> Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>

      <div className="archive-content archive-grid-two">
        <ArchivePanel title="Bill results" kicker="Legislative records" action={<span className="font-mono text-xs text-muted-foreground">Showing {Math.min(visibleCount, filteredBills.length)} of {filteredBills.length}</span>}>
          {loading ? (
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          ) : error ? (
            <DataState kind="error" title="Bill stream unavailable" description={`${error}. The page is not treating this request failure as an empty legislative record.`} />
          ) : filteredBills.length === 0 ? (
            <DataState title="No bills match these filters" description="Clear the search or change the chamber filter to return to the loaded legislative stream." />
          ) : (
            <div className="archive-list">
              {filteredBills.slice(0, visibleCount).map((bill) => {
                const key = billKey(bill)
                const isExpanded = expanded[key]
                const detail = details[key]
                return (
                  <article key={key} className={`archive-row ${selectedBillKey === key ? "border-accent/60 bg-accent/5" : ""}`}>
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
                      <button aria-expanded={Boolean(isExpanded)} aria-controls={`bill-detail-${key}`} onClick={() => toggleBill(bill)} className="inline-flex min-h-11 items-center justify-center gap-2 border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-accent hover:text-accent">
                        Details {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                    {isExpanded ? (
                      detailErrors[key] ? (
                        <div id={`bill-detail-${key}`}><DataState kind="error" title="Bill details unavailable" description={detailErrors[key]} /></div>
                      ) : detailLoading[key] ? (
                        <output id={`bill-detail-${key}`} className="mt-4 block border-t border-border pt-4 text-sm text-muted-foreground">Loading source-linked bill details...</output>
                      ) : (
                        <div id={`bill-detail-${key}`} className="mt-4 grid gap-4 border-t border-border pt-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                          <div><span className="archive-metric-label">Sponsor</span><strong className="mt-1 block text-foreground">{detail?.sponsors?.[0]?.name || "Not listed"}</strong></div>
                          <div><span className="archive-metric-label">Actions</span><strong className="mt-1 block text-foreground">{detail?.actions?.length ?? 0}</strong></div>
                          <div><span className="archive-metric-label">Committees</span><strong className="mt-1 block text-foreground">{detail?.committees?.map((committee) => committee.name).join(", ") || "Not listed"}</strong></div>
                          <div><span className="archive-metric-label">Text versions</span><strong className="mt-1 block text-foreground">{detail?.text_versions?.length ?? 0}</strong></div>
                        </div>
                      )
                    ) : null}
                  </article>
                )
              })}
              {visibleCount < filteredBills.length ? (
                <button className="min-h-11 border border-border px-4 py-3 text-sm font-semibold text-foreground hover:border-accent hover:text-accent" onClick={() => setVisibleCount((count) => count + 40)}>
                  Show 40 more bills
                </button>
              ) : null}
            </div>
          )}
        </ArchivePanel>

        <div className="grid content-start gap-4 lg:sticky lg:top-36 lg:self-start">
          <ArchivePanel title={selectedBill ? `${selectedBill.type}.${selectedBill.number}` : "Bill evidence"} kicker={selectedBill ? "Selected record" : "Provenance"}>
            <EvidenceSpine
              identifier={selectedBill?.id}
              source="Congress.gov via CongressTracker API"
              status={error ? "API request failed" : loading ? "Loading" : selectedBill ? "Record selected" : "Stream loaded"}
              updated={selectedBill?.updateDate}
              coverage={selectedBill ? (details[billKey(selectedBill)] ? "Details loaded" : "Summary record loaded") : `${bills.length} records in the current response`}
              sourceUrl={selectedBill?.url}
            >
              <p className="text-sm leading-6 text-muted-foreground">
                Counts describe the current API response. Open a bill to inspect the fields available for that record.
              </p>
            </EvidenceSpine>
          </ArchivePanel>

          <ArchivePanel title="Stream coverage" kicker="Current response">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="archive-metric-label">Loaded</dt><dd className="mt-1 font-mono text-xl text-foreground"><FileText className="mr-1 inline" size={16} />{bills.length}</dd></div>
              <div><dt className="archive-metric-label">Dated actions</dt><dd className="mt-1 font-mono text-xl text-foreground"><Calendar className="mr-1 inline" size={16} />{recentActions}</dd></div>
              <div><dt className="archive-metric-label">House</dt><dd className="mt-1 font-mono text-xl text-foreground"><Landmark className="mr-1 inline" size={16} />{houseBills}</dd></div>
              <div><dt className="archive-metric-label">Senate</dt><dd className="mt-1 font-mono text-xl text-foreground"><Landmark className="mr-1 inline" size={16} />{senateBills}</dd></div>
            </dl>
            {selectedBill?.url ? <a className="archive-link mt-5" href={selectedBill.url} target="_blank" rel="noreferrer">Open official record <ExternalLink size={14} /></a> : null}
          </ArchivePanel>
        </div>
      </div>
    </ArchivePage>
  )
}
