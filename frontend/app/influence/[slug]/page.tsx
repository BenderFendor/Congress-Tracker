"use client"

/* Design thesis: Network Dossier is a source-first campaign-finance brief where the evidence map is the primary reading surface. */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Building2, CheckCircle2, Loader2, Network, ShieldAlert } from "lucide-react"

import { InfluenceFlowMap } from "@/components/influence-flow-map"
import { ArchiveHero, ArchiveMetrics, ArchivePage, DataState, EvidenceSpine } from "@/components/ui/archive-ui"
import { Badge } from "@/components/ui/badge"
import { getInfluenceNetwork, getInfluenceNetworkFinancials, type InfluenceNetwork, type InfluenceNetworkFinancials } from "@/lib/services/influence"
import { createLogger } from "@/lib/tracing"

const log = createLogger("InfluenceDetailPage")
const CYCLES = [2026, 2024, 2022]

export default function InfluenceNetworkDetailPage() {
  const params = useParams()
  const slug = typeof params?.slug === "string" ? params.slug : ""
  const [cycle, setCycle] = useState(2026)
  const [network, setNetwork] = useState<InfluenceNetwork | null>(null)
  const [financials, setFinancials] = useState<InfluenceNetworkFinancials | null>(null)
  const [loading, setLoading] = useState(true)
  const [financialLoading, setFinancialLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [financialError, setFinancialError] = useState<string | undefined>()

  useEffect(() => {
    if (!slug) return
    let active = true
    setLoading(true)
    setError(null)
    getInfluenceNetwork(slug)
      .then((data) => { if (active) setNetwork(data) })
      .catch((reason) => {
        log.error("Failed to load influence network detail", { error: String(reason) })
        if (active) setError(reason instanceof Error ? reason.message : "Network request failed")
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [slug])

  useEffect(() => {
    if (!slug || !network) return
    let active = true
    setFinancialLoading(true)
    setFinancialError(undefined)
    getInfluenceNetworkFinancials(slug, cycle)
      .then((data) => { if (active) setFinancials(data) })
      .catch((reason) => {
        log.error("Failed to load influence financials", { slug, cycle, error: String(reason) })
        if (active) {
          setFinancials(null)
          setFinancialError(reason instanceof Error ? reason.message : "Financial aggregate request failed")
        }
      })
      .finally(() => { if (active) setFinancialLoading(false) })
    return () => { active = false }
  }, [slug, cycle, network])

  return (
    <ArchivePage>
      <Link className="mb-5 inline-flex min-h-11 items-center gap-2 border border-border bg-card px-3 text-xs font-bold uppercase tracking-wide hover:border-primary" href="/influence"><ArrowLeft size={14} /> All influence networks</Link>

      {loading ? <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={22} /> Loading network dossier</div> : error ? (
        <DataState kind="error" title="Network dossier unavailable" description={`${error}. The request failure is not presented as a missing network.`} />
      ) : !network ? (
        <DataState kind="empty" title="Network not found" description={`No configured influence network matches “${slug}”.`} />
      ) : (
        <>
          <ArchiveHero eyebrow="Federal campaign-finance dossier" title={network.display_name} accent="evidence map" description={network.description} mode="network" actions={<div className="flex flex-wrap gap-2"><Badge variant="secondary">{network.category.replaceAll("_", " ")}</Badge><Badge variant="outline">{network.confidence} identity</Badge></div>} />

          {slug === "aipac" ? <div className="mb-6 flex gap-3 border border-amber-600/30 bg-amber-500/10 p-4 text-xs leading-5 text-amber-900 dark:text-amber-200"><ShieldAlert className="mt-0.5 shrink-0" size={18} /><p><strong>Disclosure boundary:</strong> opaque 501(c)(4) donor sources are not attributed. The dossier includes only deterministic committee identities and public FEC transactions.</p></div> : null}

          <ArchiveMetrics metrics={[
            { label: "Verified committees", value: network.committees.length || "Unavailable", detail: "Committee identities in this source run", icon: <Building2 size={20} /> },
            { label: "Identity confidence", value: network.confidence.toUpperCase(), detail: "Network-to-committee crosswalk", icon: <CheckCircle2 size={20} /> },
            { label: "Network category", value: network.category.replaceAll("_", " ").toUpperCase(), detail: "Configured classification", icon: <Network size={20} /> },
            { label: "Financial cycle", value: cycle, detail: "Selected OpenFEC reporting period", icon: <Network size={20} /> },
          ]} />

          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-y border-border bg-card/60 p-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">View reporting cycle</p><p className="mt-1 text-xs text-muted-foreground">Identity membership is cycle-independent. Financial records refresh with this control.</p></div>
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Election cycle<select className="h-11 min-w-36 border border-border bg-background px-3 text-xs text-foreground" value={cycle} onChange={(event) => setCycle(Number(event.target.value))}>{CYCLES.map((option) => <option key={option} value={option}>{option} cycle</option>)}</select></label>
          </div>

          {financialLoading ? <div className="flex items-center justify-center gap-2 border border-border py-24 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={20} /> Loading {cycle} FEC records</div> : <InfluenceFlowMap network={network} financials={financials} cycle={cycle} financialError={financialError} />}

          <EvidenceSpine identifier={network.network_slug} source={network.source_citation || "OpenFEC committee and transaction records"} status={financialError ? "Identity loaded; financial request failed" : financialLoading ? "Financial records loading" : "Loaded"} coverage={`${network.committees.length} verified committee identities; ${cycle} financial aggregate; LDA excluded`} />
        </>
      )}
    </ArchivePage>
  )
}
