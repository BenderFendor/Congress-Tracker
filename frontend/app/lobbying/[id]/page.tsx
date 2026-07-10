"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArchiveHero,
  ArchivePage,
  ArchivePanel,
  DataState,
  EvidenceSpine,
} from "@/components/ui/archive-ui"
import { formatCompactCurrency } from "@/lib/format"
import { getFilingDetail, type LobbyingFiling } from "@/lib/services/lobbying"

function publishedAmount(filing: LobbyingFiling) {
  if (filing.income != null) return { label: "Reported income", value: formatCompactCurrency(filing.income) }
  if (filing.expenses != null) return { label: "Reported expenses", value: formatCompactCurrency(filing.expenses) }
  return { label: "Reported amount", value: "Not published" }
}

export default function LobbyingFilingPage() {
  const { id } = useParams<{ id: string }>()
  const [filing, setFiling] = useState<LobbyingFiling | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getFilingDetail(id)
      .then((record) => { if (active) setFiling(record) })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : "Filing detail request failed") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  const amount = filing ? publishedAmount(filing) : null
  const filedAt = filing?.dt_posted
    ? new Date(filing.dt_posted).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Not published"

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Senate lobbying disclosure filing"
        title={filing?.registrant_name || filing?.client_name || "Lobbying filing"}
        accent={filing ? String(filing.filing_year || "Record") : "Record"}
        description="Inspect the canonical filing fields currently loaded from the public LDA record. Missing amounts and relationships remain explicitly unavailable."
        mode="network"
      />

      {loading ? (
        <DataState title="Loading filing evidence" description="Requesting the canonical LDA record from the backend." />
      ) : error ? (
        <DataState kind="error" title="Filing unavailable" description={error} />
      ) : !filing ? (
        <DataState title="Filing not found" description="No canonical filing record matches this identifier." />
      ) : (
        <div className="archive-grid-two">
          <ArchivePanel title="Filed record" kicker={filing.filing_type || "LDA filing"}>
            <dl className="grid gap-4 p-2 text-sm sm:grid-cols-2">
              <div><dt className="font-mono text-xs uppercase text-muted-foreground">Registrant</dt><dd className="mt-1 font-semibold">{filing.registrant_name || "Not published"}</dd></div>
              <div><dt className="font-mono text-xs uppercase text-muted-foreground">Client</dt><dd className="mt-1 font-semibold">{filing.client_name || "Not published"}</dd></div>
              <div><dt className="font-mono text-xs uppercase text-muted-foreground">Filed</dt><dd className="mt-1">{filedAt}</dd></div>
              <div><dt className="font-mono text-xs uppercase text-muted-foreground">Period</dt><dd className="mt-1">{filing.filing_period || "Not published"}</dd></div>
              <div><dt className="font-mono text-xs uppercase text-muted-foreground">{amount?.label}</dt><dd className="mt-1">{amount?.value}</dd></div>
              <div><dt className="font-mono text-xs uppercase text-muted-foreground">Issue codes</dt><dd className="mt-1">{filing.issue_codes.length > 0 ? filing.issue_codes.join(", ") : "Not published"}</dd></div>
            </dl>
          </ArchivePanel>
          <EvidenceSpine
            identifier={filing.filing_uuid}
            source="Senate Lobbying Disclosure Act filing"
            status="Loaded"
            updated={filing.dt_posted}
            coverage="Registrant, client, filing period, issue codes, and reported amount fields when published"
          />
        </div>
      )}

      <Link href="/lobbying" className="archive-link mt-6">Return to lobbying filings</Link>
    </ArchivePage>
  )
}
