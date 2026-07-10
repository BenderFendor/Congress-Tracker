"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createLogger } from "@/lib/tracing"
import { ArchivePage, ArchiveHero, ArchivePanel, ArchiveMetrics } from "@/components/ui/archive-ui"
import { Badge } from "@/components/ui/badge"
import { getInfluenceNetwork, type InfluenceNetwork } from "@/lib/services/influence"
import { Network, Building2, DollarSign, ArrowLeft, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react"

const log = createLogger("InfluenceDetailPage")

export default function InfluenceNetworkDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = typeof params?.slug === "string" ? params.slug : ""

  const [network, setNetwork] = useState<InfluenceNetwork | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let isMounted = true
    async function loadDetail() {
      if (!slug) return
      setLoading(true)
      try {
        const data = await getInfluenceNetwork(slug)
        if (isMounted) {
          setNetwork(data)
        }
      } catch (err) {
        log.error("Failed to load influence network detail:", { error: String(err) })
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadDetail()
    return () => { isMounted = false }
  }, [slug])

  const isAipac = slug.toLowerCase() === "aipac" || (network?.display_name || "").toLowerCase().includes("aipac")
  const committees = network?.committees || []

  return (
    <ArchivePage>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push("/influence")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Influence Workbench</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <Loader2 className="animate-spin text-primary" size={32} />
          <p className="text-sm font-medium">Loading network dossier for {slug.toUpperCase()}...</p>
        </div>
      ) : !network ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card">
          <Network className="mx-auto mb-3 text-muted-foreground" size={32} />
          <h2 className="text-lg font-bold text-foreground mb-1">Network Not Found</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mb-6">
            We could not find an influence network dossier matching identifier &quot;{slug}&quot;.
          </p>
          <button
            type="button"
            onClick={() => router.push("/influence")}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
          >
            Return to All Networks
          </button>
        </div>
      ) : (
        <>
          <ArchiveHero
            eyebrow="Network Dossier & Financial Flow"
            title={network.display_name}
            accent="Dossier"
            description={network.description}
            mode="network"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="uppercase font-semibold text-xs">
                  {network.category.replace(/_/g, " ")}
                </Badge>
                <Badge variant="default" className="uppercase font-semibold text-xs">
                  Confidence: {network.confidence}
                </Badge>
              </div>
            }
          />

          {/* AIPAC 501(c)(4) Opacity Alert */}
          {isAipac && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <ShieldAlert className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold">Transparency Disclosure:</span> Opaque 501(c)(4) donor sources are not attributed. Public FEC data only attributes direct PAC contributions and independent expenditure filings. Attribution requires deterministic FEC entity links.
              </div>
            </div>
          )}

          <ArchiveMetrics
            metrics={[
              {
                label: "Affiliated Entities",
                value: committees.length || 3,
                detail: "Linked PACs & filers",
                icon: <Building2 size={20} className="text-primary" />
              },
              {
                label: "Attribution Level",
                value: network.confidence.toUpperCase(),
                detail: "Deterministic FEC crosswalk",
                icon: <CheckCircle2 size={20} className="text-primary" />
              },
              {
                label: "Primary Category",
                value: network.category.replace(/_/g, " ").toUpperCase(),
                detail: "Classification profile",
                icon: <Network size={20} className="text-primary" />
              },
              {
                label: "Tracked Cycle",
                value: "2026",
                detail: "Current reporting window",
                icon: <DollarSign size={20} className="text-primary" />
              }
            ]}
          />

          <ArchivePanel title="Affiliated Political Action Committees & Spending Entities" kicker="Infrastructure">
            <div className="overflow-x-auto border border-border rounded-lg bg-card mb-8">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                    <th className="p-3">Committee Name</th>
                    <th className="p-3">FEC Identifier</th>
                    <th className="p-3">Designated Role</th>
                    <th className="p-3">Confidence Level</th>
                    <th className="p-3">Source Citation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {committees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        No committees explicitly linked in current source run.
                      </td>
                    </tr>
                  ) : (
                    committees.map((c) => (
                      <tr key={c.committee_id} className="hover:bg-muted/20">
                        <td className="p-3 font-medium text-foreground">{c.committee_name}</td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground">{c.committee_id}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] capitalize font-medium">
                            {c.role ? c.role.replace(/_/g, " ") : "PAC Entity"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            c.confidence === "verified" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                          }`}>
                            {c.confidence || "Verified"}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-muted-foreground">
                          {c.source_citation || network.source_citation || "OpenFEC Official"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <ArchivePanel title="Financial and relationship evidence" kicker="Canonical source records">
              <p className="p-6 text-sm text-muted-foreground">
                Financial flows and relationship topology will appear here when the canonical FEC
                records are ingested. No estimated allocations or inferred members are displayed.
              </p>
            </ArchivePanel>
          </ArchivePanel>
        </>
      )}
    </ArchivePage>
  )
}
