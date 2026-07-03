"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ExternalLink, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCommittee, type Committee } from "@/lib/services/committees"
import { formatDate } from "@/lib/format"
import {
  ArchivePage,
  ArchiveHero,
  ArchivePanel,
  ArchiveMetrics,
} from "@/components/ui/archive-ui"

export default function CommitteeDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id || ""

  const [committee, setCommittee] = useState<Committee | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCommittee() {
      if (!id) {
        setLoading(false)
        return
      }
      try {
        const data = await getCommittee(id)
        setCommittee(data)
      } catch (err) {
        console.error("Error loading committee details:", err)
      } finally {
        setLoading(false)
      }
    }
    loadCommittee()
  }, [id])

  if (loading) {
    return (
      <ArchivePage>
        <div className="py-24 text-center text-muted-foreground">Loading committee profile...</div>
      </ArchivePage>
    )
  }

  if (!committee) {
    return (
      <ArchivePage>
        <div className="py-12">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="border border-border bg-card p-12 text-center rounded-sm">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Committee Not Found</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Could not retrieve intelligence for committee identifier <code className="bg-muted px-2 py-0.5 rounded text-xs">{id}</code>.
            </p>
          </div>
        </div>
      </ArchivePage>
    )
  }

  const members = committee.members || []
  const bills = committee.bills || []

  const chairOrRanking = members.find((m) => m.title && m.title.toLowerCase().includes("chair"))
  const chairName = chairOrRanking ? `${chairOrRanking.first_name} ${chairOrRanking.last_name}` : "N/A"

  const metrics = [
    { label: "Chamber", value: committee.chamber },
    { label: "Roster Size", value: members.length },
    { label: "Referred Bills", value: bills.length },
    { label: "Chair / Leadership", value: chairName },
  ]

  return (
    <ArchivePage>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>

      <ArchiveHero
        eyebrow={`Congressional Committee / ${committee.committee_id}`}
        title={committee.name}
        accent={committee.chamber ? `(${committee.chamber})` : ""}
        description={committee.jurisdiction || "Official congressional standing committee overseeing federal policies, legislative markups, and executive investigations."}
        mode="capitol"
        actions={
          committee.url ? (
            <a
              href={committee.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-sm bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-primary" /> Official Committee Website
            </a>
          ) : undefined
        }
      />

      <ArchiveMetrics metrics={metrics} />

      <div className="space-y-8 mt-8">
        {/* Jurisdiction Details */}
        {committee.jurisdiction && (
          <ArchivePanel title="Policy Jurisdiction" kicker="Mandate">
            <div className="p-6 text-sm text-foreground leading-relaxed">
              {committee.jurisdiction}
            </div>
          </ArchivePanel>
        )}

        {/* Member Roster Table */}
        <ArchivePanel title="Committee Membership Roster" kicker="Legislators">
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border font-mono text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Legislator</th>
                  <th className="p-3">Title / Role</th>
                  <th className="p-3">Party</th>
                  <th className="p-3">State / District</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.length > 0 ? (
                  members
                    .slice()
                    .sort((a, b) => (a.rank || 999) - (b.rank || 999))
                    .map((m) => (
                      <tr key={m.bioguide_id} className="hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs text-muted-foreground">
                          {m.rank !== undefined ? `#${m.rank}` : "-"}
                        </td>
                        <td className="p-3 font-medium text-foreground">
                          <Link href={`/legislators/${m.bioguide_id}`} className="hover:underline text-primary">
                            {m.first_name} {m.last_name}
                          </Link>
                        </td>
                        <td className="p-3 text-xs font-mono uppercase text-accent font-semibold">
                          {m.title || "Member"}
                        </td>
                        <td className="p-3">{m.party || "-"}</td>
                        <td className="p-3">
                          {m.state}{m.district ? `-${m.district}` : ""}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No member roster loaded for this committee.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ArchivePanel>

        {/* Referred Bills Table */}
        <ArchivePanel title="Referred Legislation" kicker="Active Docket">
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border font-mono text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Bill Identifier</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Latest Action Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bills.length > 0 ? (
                  bills.map((b, idx) => {
                    const billSlug = b.bill_id || `${b.bill_type || "hr"}${b.bill_number}-${b.congress || 119}`
                    return (
                      <tr key={b.bill_id || idx} className="hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs font-semibold uppercase text-accent">
                          <Link href={`/bills/${billSlug}`} className="hover:underline">
                            {b.bill_id || `${b.bill_type?.toUpperCase() || "HR"} ${b.bill_number}`}
                          </Link>
                        </td>
                        <td className="p-3 font-medium text-foreground max-w-xl">
                          <Link href={`/bills/${billSlug}`} className="hover:underline text-primary line-clamp-2">
                            {b.title || "Untitled Bill"}
                          </Link>
                        </td>
                        <td className="p-3 text-xs font-mono uppercase text-muted-foreground">
                          {b.status || "In Committee"}
                        </td>
                        <td className="p-3 text-xs font-mono text-muted-foreground">
                          {formatDate(b.latest_action_date)}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      No referred bills recorded for this committee.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ArchivePanel>
      </div>
    </ArchivePage>
  )
}
