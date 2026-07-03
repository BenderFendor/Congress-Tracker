"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FileText, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getBillIntel, type BillIntel } from "@/lib/services/bills"
import { formatCurrency, formatDate } from "@/lib/format"
import {
  ArchivePage,
  ArchiveHero,
  ArchivePanel,
  ArchiveMetrics,
} from "@/components/ui/archive-ui"

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

export default function BillDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const rawId = params?.id || ""

  const [data, setData] = useState<BillIntel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBill() {
      if (!rawId) {
        setLoading(false)
        return
      }
      const parsed = parseBillId(rawId)
      if (!parsed) {
        setLoading(false)
        return
      }
      try {
        const result = await getBillIntel(parsed.congress, parsed.billType, parsed.billNumber)
        setData(result)
      } catch (err) {
        console.error("Error loading bill intelligence:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchBill()
  }, [rawId])

  if (loading) {
    return (
      <ArchivePage>
        <div className="py-24 text-center text-muted-foreground">Loading bill intelligence...</div>
      </ArchivePage>
    )
  }

  if (!data || !data.bill) {
    return (
      <ArchivePage>
        <div className="py-12">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="border border-border bg-card p-12 text-center rounded-sm">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Bill Not Found</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Could not retrieve intelligence for identifier <code className="bg-muted px-2 py-0.5 rounded text-xs">{rawId}</code>.
            </p>
          </div>
        </div>
      </ArchivePage>
    )
  }

  const { bill, actions, sponsors, cosponsors, committees, funding_overlay, lobbying_overlay } = data

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
                  <div className="text-sm text-muted-foreground">Total Sponsor Receipts</div>
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(funding_overlay.total_sponsor_receipts)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-mono text-muted-foreground">Data Quality:</span>
                  <span className="px-2.5 py-1 text-xs font-mono font-bold bg-accent/10 text-accent rounded-sm uppercase">
                    {funding_overlay.data_quality}
                  </span>
                </div>
              </div>

              {funding_overlay.top_influence_networks && funding_overlay.top_influence_networks.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Top Influence Networks</h4>
                  <div className="border border-border rounded-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50 border-b border-border font-mono text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="p-3">Network</th>
                          <th className="p-3 text-right">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {funding_overlay.top_influence_networks.map((net) => (
                          <tr key={net.network_slug} className="hover:bg-muted/30">
                            <td className="p-3 font-medium text-foreground">
                              <Link href={`/influence?network=${net.network_slug}`} className="hover:underline">
                                {net.display_name || net.network_slug}
                              </Link>
                            </td>
                            <td className="p-3 text-right font-mono text-foreground">
                              {formatCurrency(net.total_amount)}
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
                  <tr key={`sp-${sp.bioguide_id}`} className="hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">
                      <Link href={`/legislators/${sp.bioguide_id}`} className="hover:underline text-primary">
                        {sp.first_name} {sp.last_name}
                      </Link>
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
                  <tr key={`co-${co.bioguide_id}`} className="hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">
                      <Link href={`/legislators/${co.bioguide_id}`} className="hover:underline text-primary">
                        {co.first_name} {co.last_name}
                      </Link>
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

        {/* Heuristic Lobbying Overlay */}
        <ArchivePanel title="Lobbying Activity Overlay" kicker="Influence Tracking">
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
