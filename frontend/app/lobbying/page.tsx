"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, RefreshCw } from "lucide-react"
import {
  ArchiveMetrics,
  ArchivePage,
  ArchiveSearch,
  DataState,
  EvidenceSpine,
} from "@/components/ui/archive-ui"
import { formatCompactCurrency } from "@/lib/format"
import { CompactMasthead, SankeyFlowVisual } from "@/components/ui/mockup-visuals"
import { fetchLobbyingFilings, type FilingCardItem } from "@/lib/services/lobbying"

const currentYear = new Date().getFullYear()

function FilingRow({ item }: { item: FilingCardItem }) {
  const amount = item.reportedAmount == null
    ? "Not published"
    : formatCompactCurrency(item.reportedAmount)
  const filedAt = item.filedAt
    ? new Date(item.filedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "Date unavailable"

  return (
    <article className="border-b border-border py-5 last:border-b-0">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)_auto] md:items-center">
        <div className="min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-wider text-accent">Registrant</div>
          <h2 className="mt-1 font-serif text-xl font-semibold text-foreground">{item.registrantName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Client: {item.clientName || "Not published"}
          </p>
          {item.topIssueAreas.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.topIssueAreas.slice(0, 5).map((issue: string) => (
                <span key={issue} className="border border-border bg-muted/30 px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground">
                  {issue}
                </span>
              ))}
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-1">
          <div><dt className="font-mono text-[10px] uppercase text-muted-foreground">{item.reportedAmountLabel}</dt><dd className="mt-1 font-semibold text-foreground">{amount}</dd></div>
          <div><dt className="font-mono text-[10px] uppercase text-muted-foreground">Filed</dt><dd className="mt-1 text-foreground">{filedAt}</dd></div>
        </dl>
        <Link href={`/lobbying/${encodeURIComponent(item.filingUuid)}`} className="archive-link justify-self-start md:justify-self-end">
          Inspect filing <ExternalLink size={14} />
        </Link>
      </div>
    </article>
  )
}

export default function LobbyingPage() {
  const [search, setSearch] = useState("")
  const [year, setYear] = useState(currentYear)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filingItems, setFilingItems] = useState<FilingCardItem[]>([])
  const [hasMore, setHasMore] = useState(false)

  const loadFilings = useCallback(async (limit = 24) => {
    const data = await fetchLobbyingFilings(year, search || undefined, limit, 0)
    setFilingItems(data.items)
    setHasMore(data.hasMore)
  }, [year, search])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    loadFilings()
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Lobbying filing request failed")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [loadFilings])

  const refresh = () => {
    setLoading(true)
    setError(null)
    loadFilings()
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Lobbying filing request failed"))
      .finally(() => setLoading(false))
  }

  const metrics = [
    { label: "Cycle year", value: year, detail: "Selected filing year" },
    { label: "Rows loaded", value: filingItems.length, detail: "Current result window" },
    { label: "Source", value: "LDA", detail: "Senate disclosure records" },
    { label: "Coverage", value: error ? "Failed" : loading ? "Loading" : "Loaded", detail: "Request status" },
  ]

  return (
    <ArchivePage>
      <CompactMasthead
        eyebrow="Senate filing intelligence"
        title="Lobbying"
        accent="flow."
        description="Follow public lobbying records from registrant to client and issue area. Amounts remain unavailable when the source filing does not publish one."
        visual={<SankeyFlowVisual />}
      />

      <ArchiveMetrics metrics={metrics} />
      <ArchiveSearch value={search} onChange={setSearch} placeholder="Search registrants">
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="sr-only">Filing year</span>
          <select name="filing-year" value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="Filing year">
            {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button type="button" onClick={refresh} className="inline-flex min-h-12 items-center justify-center gap-2 border border-border bg-card px-4 text-sm font-bold text-foreground disabled:opacity-50" disabled={loading}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </ArchiveSearch>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <section className="archive-panel" aria-labelledby="lobbying-results-title">
          <div className="archive-panel-head">
            <div><div className="archive-panel-kicker">Raw public records</div><h2 id="lobbying-results-title">Recent filings</h2></div>
          </div>
          <div className="px-5 pb-2">
            {loading ? (
              <DataState title="Loading lobbying filings" description="Requesting the selected year and registrant filter from the canonical backend." />
            ) : error ? (
              <DataState kind="error" title="Lobbying filings unavailable" description={`${error}. The failed request is not presented as a genuine empty result.`} />
            ) : filingItems.length === 0 ? (
              <DataState
                title="No filings match this view"
                description="The selected year and registrant filter returned no loaded records. This is not presented as evidence of no lobbying activity."
                action={year > currentYear - 3 ? <button type="button" className="archive-link" onClick={() => setYear(year - 1)}>View {year - 1} filings</button> : undefined}
              />
            ) : (
              <>
                {filingItems.map((item) => <FilingRow key={item.filingUuid} item={item} />)}
                {hasMore && (
                  <button type="button" className="my-5 min-h-11 border border-border bg-card px-4 text-sm font-bold text-foreground" onClick={() => { setLoading(true); loadFilings(filingItems.length + 24).catch((requestError) => setError(String(requestError))).finally(() => setLoading(false)) }}>
                    Load more filings
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <EvidenceSpine
          identifier={`LDA filings / ${year}`}
          source="Senate Lobbying Disclosure Act filings"
          status={error ? "Request failed" : loading ? "Loading" : "Loaded"}
          coverage="Registrant, client, issue code, filing date, and reported income or expense when published"
        >
          <p className="text-xs text-muted-foreground">Aggregated sector and influence-flow graphics remain hidden until canonical endpoints can support them with source-backed totals.</p>
        </EvidenceSpine>
      </div>
    </ArchivePage>
  )
}
