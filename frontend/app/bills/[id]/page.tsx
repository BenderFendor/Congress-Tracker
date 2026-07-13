"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createLogger } from "@/lib/tracing"
import { ArrowLeft, FileText, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getBillIntel, type BillIntel } from "@/lib/services/bills"
import { formatCurrency, formatDate } from "@/lib/format"
import {
  ArchivePage,
  ArchiveHero,
  ArchivePanel,
  ArchiveMetrics,
  DataState,
} from "@/components/ui/archive-ui"

type BillPageState =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "not_found" }
  | { kind: "error"; message: string }
  | { kind: "loaded"; data: BillIntel }

function parseBillId(rawId: string): { congress: number; billType: string; billNumber: number } | null {
  const cleaned = decodeURIComponent(rawId).toLowerCase().trim()

  // Format 1: hr1-119 or s123-118
  let match = cleaned.match(/^([a-z]+)(\d+)-(\d+)$/)
  if (match) {
    return { billType: match[1], billNumber: parseInt(match[2], 10), congress: parseInt(match[3], 10) }
  }

  // Format 2: 119-hr-1 or 118-s-123
  match = cleaned.match(/^(\d+)-([a-z]+)-(\d+)$/)
  if (match) {
    return { congress: parseInt(match[1], 10), billType: match[2], billNumber: parseInt(match[3], 10) }
  }

  // Format 3: hr-1-119
  match = cleaned.match(/^([a-z]+)-(\d+)-(\d+)$/)
  if (match) {
    return { billType: match[1], billNumber: parseInt(match[2], 10), congress: parseInt(match[3], 10) }
  }

  return null
}

const log = createLogger("BillPage")

export default function BillDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const rawId = params?.id || ""

  const [state, setState] = useState<BillPageState>({ kind: "loading" })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function fetchBill() {
      setState({ kind: "loading" })
      if (!rawId) {
        setState({ kind: "invalid" })
        return
      }
      const parsed = parseBillId(rawId)
      if (!parsed) {
        setState({ kind: "invalid" })
        return
      }
      try {
        const result = await getBillIntel(parsed.congress, parsed.billType, parsed.billNumber, controller.signal)
        setState(result ? { kind: "loaded", data: result } : { kind: "not_found" })
      } catch (err) {
        if (controller.signal.aborted) return
        log.error("Error loading bill intelligence", { error: String(err) })
        setState({ kind: "error", message: err instanceof Error ? err.message : "Bill detail request failed" })
      }
    }
    void fetchBill()
    return () => controller.abort()
  }, [rawId, retryKey])

  if (state.kind === "loading") {
    return (
      <ArchivePage>
        <div className="py-24 text-center text-muted-foreground">Loading bill intelligence...</div>
      </ArchivePage>
    )
  }

  if (state.kind === "invalid" || state.kind === "not_found" || state.kind === "error") {
    const isError = state.kind === "error"
    const title = state.kind === "invalid" ? "Invalid Bill Identifier" : isError ? "Bill Details Unavailable" : "Bill Not Found"
    const description = state.kind === "invalid"
      ? "Use a bill identifier such as hr1-119 or 119-hr-1."
      : isError
        ? `${state.message}. The record's existence has not been determined.`
        : `No bill was returned for identifier ${rawId}.`
    return (
      <ArchivePage>
        <div className="py-12">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <DataState
            kind={isError ? "error" : "empty"}
            title={title}
            description={description}
            action={<div className="flex flex-wrap gap-3">{isError ? <Button size="sm" onClick={() => setRetryKey((key) => key + 1)}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button> : null}<Button asChild variant="outline" size="sm"><Link href="/bills">Browse bills</Link></Button></div>}
          />
        </div>
      </ArchivePage>
    )
  }

  const data = state.data
  const {
    bill,
    actions,
    sponsors,
    cosponsors,
    committees,
    amendments,
    funding_overlay,
    lobbying_overlay,
    lobbying_bill_links,
  } = data
  const totalSponsorReceipts = funding_overlay?.reduce((sum, sponsor) => sum + sponsor.direct_receipts, 0) ?? 0
  const fundingCycle = funding_overlay?.[0]?.cycle
  const topInfluenceNetworks = Array.from(
    (funding_overlay ?? []).reduce((networks, sponsor) => {
      for (const network of sponsor.top_networks) {
        const current = networks.get(network.network_slug) ?? {
          network_slug: network.network_slug,
          direct_contributions: 0,
          independent_supporting: 0,
          independent_opposing: 0,
        }
        current.direct_contributions += network.direct_contributions
        current.independent_supporting += network.independent_supporting
        current.independent_opposing += network.independent_opposing
        networks.set(network.network_slug, current)
      }
      return networks
    }, new Map<string, { network_slug: string; direct_contributions: number; independent_supporting: number; independent_opposing: number }>()).values()
  ).sort((left, right) => (
    right.direct_contributions + right.independent_supporting + right.independent_opposing
  ) - (
    left.direct_contributions + left.independent_supporting + left.independent_opposing
  ))
  const fundingQuality = funding_overlay?.some((sponsor) => sponsor.data_quality === "missing_crosswalk")
    ? "missing_crosswalk"
    : "crosswalk_loaded"

  const metrics = [
    { label: "Congress", value: `${bill.congress}th` },
    { label: "Status", value: bill.status || "Unknown" },
    { label: "Sponsors", value: (sponsors?.length || 0) + (cosponsors?.length || 0) },
    { label: "Actions", value: actions?.length || 0 },
  ]

  return (
    <ArchivePage>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>

      <ArchiveHero
        eyebrow={`Bill Intelligence / ${bill.bill_id || rawId.toUpperCase()}`}
        title={bill.title || `Bill #${bill.bill_number}`}
        accent={bill.policy_area ? `(${bill.policy_area})` : ""}
        description={bill.latest_action_text ? `Latest action: ${bill.latest_action_text}` : "Comprehensive legislative and financial intelligence report."}
        mode="files"
      />

      <ArchiveMetrics metrics={metrics} />

      <div className="space-y-8 mt-8">
        {/* Sponsor Funding Overlay */}
        {funding_overlay && (
          <ArchivePanel title="Sponsor Funding Overlay" kicker="Campaign Finance">
            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
                <div>
                  <div className="text-sm text-muted-foreground">Direct sponsor campaign receipts{fundingCycle ? ` · ${fundingCycle} cycle` : ""}</div>
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(totalSponsorReceipts)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Data Quality:</span>
                  <span className="px-2.5 py-1 text-xs font-mono font-bold bg-accent/10 text-accent rounded-sm uppercase">
                    {fundingQuality}
                  </span>
                </div>
              </div>

              {topInfluenceNetworks.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Source-linked influence networks</h4>
                  <p className="mb-3 text-xs leading-5 text-muted-foreground">Direct contributions are money received by sponsor campaigns. Independent support and opposition are outside spending and are reported separately.</p>
                  <div className="border border-border rounded-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50 border-b border-border font-mono text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="p-3">Network</th>
                          <th className="p-3 text-right">Direct contributions</th>
                          <th className="p-3 text-right">Independent support</th>
                          <th className="p-3 text-right">Independent opposition</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {topInfluenceNetworks.map((net) => (
                          <tr key={net.network_slug} className="hover:bg-muted/30">
                            <td className="p-3 font-medium text-foreground">
                              <Link href={`/influence?network=${net.network_slug}`} className="hover:underline">
                                {net.network_slug}
                              </Link>
                            </td>
                            <td className="p-3 text-right font-mono text-foreground">
                              {formatCurrency(net.direct_contributions)}
                            </td>
                            <td className="p-3 text-right font-mono text-foreground">
                              {formatCurrency(net.independent_supporting)}
                            </td>
                            <td className="p-3 text-right font-mono text-foreground">
                              {formatCurrency(net.independent_opposing)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </ArchivePanel>
        )}

        {/* Sponsors and Cosponsors Table */}
        <ArchivePanel title="Sponsors & Cosponsors" kicker="Legislative Backing">
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border font-mono text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Legislator</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Party</th>
                  <th className="p-3">State</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sponsors && sponsors.map((sp) => (
                  <tr key={`sp-${sp.bioguide_id ?? sp.name}`} className="hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">
                      {sp.bioguide_id ? <Link href={`/legislators/${sp.bioguide_id}`} className="hover:underline text-primary">{sp.name}</Link> : sp.name}
                    </td>
                    <td className="p-3 text-xs font-mono uppercase text-accent font-semibold">
                      {sp.sponsor_type || "Sponsor"}
                    </td>
                    <td className="p-3">{sp.party || "-"}</td>
                    <td className="p-3">{sp.state || "-"}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(sp.sponsorship_date)}</td>
                  </tr>
                ))}
                {cosponsors && cosponsors.map((co) => (
                  <tr key={`co-${co.bioguide_id ?? co.name}`} className="hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">
                      {co.bioguide_id ? <Link href={`/legislators/${co.bioguide_id}`} className="hover:underline text-primary">{co.name}</Link> : co.name}
                    </td>
                    <td className="p-3 text-xs font-mono uppercase text-muted-foreground">Cosponsor</td>
                    <td className="p-3">{co.party || "-"}</td>
                    <td className="p-3">{co.state || "-"}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(co.sponsorship_date)}</td>
                  </tr>
                ))}
                {(!sponsors || sponsors.length === 0) && (!cosponsors || cosponsors.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No sponsor records found for this bill.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ArchivePanel>

        <ArchivePanel title="Amendments" kicker="Normalized Congress.gov records">
          <div className="border-t border-border overflow-x-auto">
            {amendments.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border font-mono text-xs uppercase text-muted-foreground">
                  <tr><th className="p-3">Amendment</th><th className="p-3">Sponsor</th><th className="p-3">Latest action</th><th className="p-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {amendments.map((amendment, index) => (
                    <tr key={`${amendment.amendment_type ?? "amendment"}-${amendment.amendment_number ?? index}`}>
                      <td className="p-3 align-top"><div className="font-semibold">{[amendment.amendment_type, amendment.amendment_number].filter(Boolean).join(" ") || "Number unavailable"}</div><div className="mt-1 text-muted-foreground">{amendment.description || "No description supplied by Congress.gov."}</div></td>
                      <td className="p-3 align-top">{amendment.sponsor_name || "Not supplied"}</td>
                      <td className="p-3 align-top"><div className="font-mono text-xs text-muted-foreground">{formatDate(amendment.latest_action_date)}</div><div className="mt-1">{amendment.latest_action_text || "No action text supplied."}</div></td>
                      <td className="p-3 align-top font-mono text-xs uppercase">{amendment.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="p-6 text-sm text-muted-foreground">No normalized amendment records are loaded for this bill.</div>}
          </div>
        </ArchivePanel>

        {/* Lifecycle Timeline (Actions) */}
        <ArchivePanel title="Lifecycle Timeline" kicker="Actions">
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border font-mono text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Chamber</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {actions && actions.length > 0 ? (
                  actions.map((act, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatDate(act.action_date)}
                      </td>
                      <td className="p-3 uppercase text-xs font-mono text-foreground">{act.chamber || "-"}</td>
                      <td className="p-3 text-foreground">{act.action_text}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-muted-foreground">
                      No recorded actions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ArchivePanel>

        {/* Committee Referrals */}
        <ArchivePanel title="Committee Referrals" kicker="Jurisdiction">
          <div className="p-6">
            {committees && committees.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {committees.map((com) => (
                  <Link
                    key={com.committee_id}
                    href={`/committees/${com.committee_id}`}
                    className="block p-4 border border-border rounded-sm hover:border-primary transition-colors bg-card"
                  >
                    <div className="text-xs font-mono uppercase text-muted-foreground mb-1">
                      {com.chamber} Chamber
                    </div>
                    <div className="font-semibold text-foreground">{com.name}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No committee referrals recorded.</div>
            )}
          </div>
        </ArchivePanel>

        <ArchivePanel title="Explicit Bill Citations in LDA Filings" kicker="Direct evidence">
          <div className="p-6">
            {lobbying_bill_links.length > 0 ? (
              <div className="space-y-3">
                {lobbying_bill_links.map((link) => (
                  <Link key={`${link.filing_uuid}-${link.matched_bill_text ?? "citation"}`} href={`/lobbying/${encodeURIComponent(link.filing_uuid)}`} className="block border border-border bg-card p-4 transition-colors hover:border-accent">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{link.client_name || "Client not supplied"}</span><span className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs uppercase text-emerald-500">Direct LDA citation</span></div>
                    <div className="mt-2 text-sm text-muted-foreground">Registrant: {link.registrant_name || "Not supplied"}</div>
                    <div className="mt-1 font-mono text-xs">Matched text: {link.matched_bill_text || "Explicit bill identifier"}</div>
                  </Link>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground">No explicit bill citation is loaded from an LDA filing. Keyword suggestions below are not direct evidence.</div>}
          </div>
        </ArchivePanel>

        {/* Heuristic Lobbying Overlay */}
        <ArchivePanel title="Related Lobbying Suggestions" kicker="Heuristic, not direct evidence">
          <div className="p-6">
            {lobbying_overlay && lobbying_overlay.length > 0 ? (
              <div className="space-y-4">
                {lobbying_overlay.map((lob, i) => (
                  <div key={i} className="p-4 border border-border rounded-sm bg-card">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <span className="font-semibold text-foreground">{lob.issue_display}</span>
                      <span className="px-2 py-0.5 text-xs font-mono bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded uppercase">
                        confidence={lob.confidence || "heuristic"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{lob.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No heuristic lobbying matches detected for this bill.</div>
            )}
          </div>
        </ArchivePanel>

        {/* Bill Text Versions */}
        <ArchivePanel title="Bill Text & References" kicker="Documents">
          <div className="p-6 flex flex-wrap gap-4 items-center">
            {bill.url && (
              <a
                href={bill.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-sm bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors"
              >
                <FileText className="h-4 w-4 text-accent" /> Official Congress.gov Text
              </a>
            )}
            <a
              href={`https://www.congress.gov/bill/${bill.congress}th-congress/${bill.bill_type === "hr" ? "house-bill" : bill.bill_type === "s" ? "senate-bill" : `${bill.bill_type}-bill`}/${bill.bill_number}/text`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-sm bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors"
            >
              <FileText className="h-4 w-4 text-primary" /> View Full Text Repository
            </a>
          </div>
        </ArchivePanel>
      </div>
    </ArchivePage>
  )
}
