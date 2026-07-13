"use client"

/* Design thesis: Evidence River makes every network readable as a sourced path, not a decorative web of implied relationships. */

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Building2, CheckCircle2, ChevronDown, ChevronUp, Filter, Loader2, Network, ShieldAlert } from "lucide-react"

import { InfluenceFlowMap } from "@/components/influence-flow-map"
import { ArchiveMetrics, ArchivePage, ArchivePanel, ArchiveSearch, DataState, EvidenceSpine } from "@/components/ui/archive-ui"
import { CompactMasthead } from "@/components/ui/mockup-visuals"
import { Badge } from "@/components/ui/badge"
import { createLogger } from "@/lib/tracing"
import { filterInfluenceNetworks, influenceDossierPath } from "@/lib/influence-search.mjs"
import { getInfluenceNetworkFinancials, getInfluenceNetworks, type InfluenceNetworkFinancials, type InfluenceNetworkSummary } from "@/lib/services/influence"

const log = createLogger("InfluencePage")
const CYCLES = [2026, 2024, 2022]

export default function InfluenceWorkbenchPage() {
  const [networks, setNetworks] = useState<InfluenceNetworkSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedCycle, setSelectedCycle] = useState(2026)
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)
  const [financials, setFinancials] = useState<Record<string, InfluenceNetworkFinancials | null>>({})
  const [financialErrors, setFinancialErrors] = useState<Record<string, string>>({})
  const [financialLoading, setFinancialLoading] = useState<Record<string, boolean>>({})
  const requested = useRef(new Set<string>())

  useEffect(() => {
    let active = true
    getInfluenceNetworks()
      .then((data) => {
        if (!active) return
        setNetworks(data)
        setExpandedSlug(data.find((network) => network.network_slug === "aipac")?.network_slug ?? data[0]?.network_slug ?? null)
      })
      .catch((reason) => {
        log.error("Failed to fetch influence networks", { error: String(reason) })
        if (active) setError(reason instanceof Error ? reason.message : "Influence network request failed")
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!expandedSlug) return
    const requestKey = `${expandedSlug}:${selectedCycle}`
    if (requested.current.has(requestKey)) return
    requested.current.add(requestKey)
    let active = true
    setFinancialLoading((current) => ({ ...current, [requestKey]: true }))
    getInfluenceNetworkFinancials(expandedSlug, selectedCycle)
      .then((data) => {
        if (!active) return
        setFinancials((current) => ({ ...current, [requestKey]: data }))
        setFinancialErrors((current) => {
          const next = { ...current }
          delete next[requestKey]
          return next
        })
      })
      .catch((reason) => {
        log.error("Failed to fetch influence financials", { slug: expandedSlug, cycle: selectedCycle, error: String(reason) })
        if (active) setFinancialErrors((current) => ({ ...current, [requestKey]: reason instanceof Error ? reason.message : "Financial aggregate request failed" }))
      })
      .finally(() => { if (active) setFinancialLoading((current) => ({ ...current, [requestKey]: false })) })
    return () => { active = false }
  }, [expandedSlug, selectedCycle])

  const categories = useMemo(() => Array.from(new Set(networks.map((network) => network.category).filter(Boolean))).sort(), [networks])
  const filteredNetworks = useMemo(() => {
    return filterInfluenceNetworks(networks, searchQuery, selectedCategory) as InfluenceNetworkSummary[]
  }, [networks, searchQuery, selectedCategory])
  const committeeCount = networks.reduce((total, network) => total + (network.committees?.length ?? 0), 0)

  return (
    <ArchivePage>
      <CompactMasthead
        eyebrow="Campaign-finance evidence workbench"
        title="Influence networks"
        accent="decoded."
        description="Follow verified political networks from their public committee identities to direct contributions, independent spending, and source-linked federal candidates. Every amount comes from loaded FEC records."
      />

      <ArchiveMetrics metrics={[
        { label: "Tracked networks", value: networks.length || "Unavailable", detail: "Configured network definitions", icon: <Network size={20} /> },
        { label: "Verified committees", value: committeeCount || "Unavailable", detail: "Deterministic OpenFEC identities", icon: <Building2 size={20} /> },
        { label: "Identity confidence", value: networks.length ? `${networks.filter((network) => network.confidence === "verified" || network.confidence === "high").length}/${networks.length}` : "Unavailable", detail: "Verified or high-confidence networks", icon: <CheckCircle2 size={20} /> },
        { label: "Financial cycle", value: selectedCycle, detail: "Selected federal reporting cycle", icon: <Filter size={20} /> },
      ]} />

      <section className="mb-7 border-y border-border bg-card/70 p-4" aria-label="Influence network filters">
        <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_auto_auto] md:items-center">
          <ArchiveSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search network name, acronym, or description" />
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Network category
            <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="h-11 min-w-48 border border-border bg-background px-3 text-xs text-foreground">
              <option value="all">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Election cycle
            <select value={selectedCycle} onChange={(event) => setSelectedCycle(Number(event.target.value))} className="h-11 min-w-36 border border-border bg-background px-3 text-xs text-foreground">
              {CYCLES.map((cycle) => <option key={cycle} value={cycle}>{cycle} cycle</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{filteredNetworks.length} of {networks.length} networks in view. LDA lobbying records are intentionally excluded from these FEC flows.</p>
      </section>

      {error ? <DataState kind="error" title="Influence networks unavailable" description={`${error}. An API failure is not shown as an empty network.`} /> : null}

      <ArchivePanel title="Verified network dossiers" kicker="Select a network to open its evidence path">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={20} /> Loading network identities</div>
        ) : filteredNetworks.length === 0 ? (
          <DataState kind="empty" title="No matching networks" description="Clear the search or choose a different category. No records were removed from the source set." />
        ) : (
          <div className="grid gap-4 p-4 md:p-6">
            {filteredNetworks.map((network) => {
              const expanded = expandedSlug === network.network_slug
              const requestKey = `${network.network_slug}:${selectedCycle}`
              const isAipac = network.network_slug === "aipac"
              return (
                <article className={`border bg-background transition-colors ${expanded ? "border-primary" : "border-border hover:border-primary/40"}`} key={network.network_slug}>
                  <button type="button" className="grid min-h-24 w-full gap-3 p-4 text-left md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-5" aria-expanded={expanded} aria-label={`${expanded ? "Close" : "Open"} evidence map for ${network.display_name}`} onClick={() => setExpandedSlug(expanded ? null : network.network_slug)}>
                    <span>
                      <span className="mb-2 flex flex-wrap items-center gap-2">
                        <strong className="font-serif text-lg text-foreground md:text-xl">{network.display_name}</strong>
                        <Badge variant="secondary">{network.category.replaceAll("_", " ")}</Badge>
                        <Badge variant="outline">{network.confidence}</Badge>
                      </span>
                      <span className="block max-w-4xl text-xs leading-6 text-muted-foreground">{network.description}</span>
                      {network.aliases?.length ? <span className="mt-2 block text-[10px] uppercase tracking-wide text-muted-foreground">Also indexed as: {network.aliases.join(" · ")}</span> : null}
                    </span>
                    <span className="flex items-center justify-between gap-5 border-t border-border pt-3 md:border-0 md:pt-0">
                      <span className="text-xs"><b className="block font-mono text-base text-foreground">{network.committees?.length ?? 0}</b><span className="text-muted-foreground">verified committees</span></span>
                      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide">{expanded ? "Close map" : "Open map"}{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                    </span>
                  </button>
                  {isAipac && expanded ? <div className="mx-4 mb-4 flex gap-3 border border-amber-600/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-200"><ShieldAlert className="mt-0.5 shrink-0" size={17} /><p><strong>Disclosure boundary:</strong> opaque 501(c)(4) donor sources are not attributed. This map shows only deterministic committee links and public FEC transactions.</p></div> : null}
                  {expanded ? (
                    <div className="border-t border-border p-3 md:p-5">
                      {financialLoading[requestKey] ? <div className="flex items-center justify-center gap-2 border border-border py-16 text-xs text-muted-foreground"><Loader2 className="animate-spin" size={18} /> Loading {selectedCycle} financial records</div> : (
                        <InfluenceFlowMap network={{ ...network, source_citation: network.source_citation ?? "OpenFEC", committees: network.committees ?? [] }} financials={financials[requestKey]} cycle={selectedCycle} financialError={financialErrors[requestKey]} compact />
                      )}
                      <div className="mt-3 flex justify-end"><Link className="inline-flex min-h-11 items-center border border-primary bg-primary px-4 text-xs font-bold uppercase tracking-wide text-primary-foreground" href={influenceDossierPath(network)}>Open full dossier</Link></div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </ArchivePanel>

      <EvidenceSpine identifier={expandedSlug ?? "Influence network directory"} source="OpenFEC committees, contributions, and independent expenditure records" status={error ? "Request failed" : loading ? "Loading" : "Loaded"} coverage={`${networks.length} configured networks; financial coverage is reported independently for each selected cycle`} />
    </ArchivePage>
  )
}
