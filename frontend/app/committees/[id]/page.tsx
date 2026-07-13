"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createLogger } from "@/lib/tracing"
import { ArrowLeft, ArrowUpRight, Crown, ExternalLink, Landmark, MapPin, RefreshCw, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCommittee, type Committee } from "@/lib/services/committees"
import { formatDate } from "@/lib/format"
import {
  ArchivePage,
  ArchiveHero,
  ArchivePanel,
  ArchiveMetrics,
  DataState,
} from "@/components/ui/archive-ui"
import { MemberPortrait } from "@/components/ui/member-identity"

type CommitteePageState =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "not_found" }
  | { kind: "error"; message: string }
  | { kind: "loaded"; committee: Committee }

const log = createLogger("CommitteeDetailPage")

type CommitteeMember = NonNullable<Committee["members"]>[number]

function memberName(member: CommitteeMember) {
  return `${member.first_name} ${member.last_name}`.replace(/\s+/g, " ").trim() || "Name unavailable"
}

function isLeadership(member: CommitteeMember) {
  const title = member.title?.toLowerCase() || ""
  return title.includes("chair") || title.includes("ranking")
}

function CommitteeMemberCard({ member, committeeChamber, priority = false }: { member: CommitteeMember; committeeChamber: string; priority?: boolean }) {
  const name = memberName(member)
  const party = member.party || "Party unavailable"
  const partyKey = party.toLowerCase()
  const partyClass = partyKey.includes("democrat") ? "democrat" : partyKey.includes("republican") ? "republican" : "other"
  const location = [member.state, member.district ? `District ${member.district}` : null].filter(Boolean).join(" · ") || "Location unavailable"
  const chamber = member.chamber || committeeChamber || "Chamber unavailable"
  const profileHref = member.bioguide_id ? `/legislators/${member.bioguide_id}` : null

  const content = (
    <article className={`committee-member-card ${isLeadership(member) ? "is-leadership" : ""}`}>
      <div className="committee-member-portrait" aria-hidden="true">
        <MemberPortrait
          bioguideId={member.bioguide_id}
          name={name}
          className="contents"
          imageClassName="h-full w-full object-cover object-[center_20%]"
          fallbackClassName="grid h-full w-full place-items-center"
          width={280}
          height={350}
          priority={priority}
          ariaHidden
        />
        <div className={`committee-party-flag ${partyClass}`}>{party}</div>
      </div>

      <div className="committee-member-copy">
        <div className="committee-member-role">
          {isLeadership(member) ? <Crown size={13} aria-hidden="true" /> : <Users size={13} aria-hidden="true" />}
          {member.title || "Committee member"}
        </div>
        <h3>{name}</h3>
        <div className="committee-member-facts">
          <span><MapPin size={13} aria-hidden="true" />{location}</span>
          <span><Landmark size={13} aria-hidden="true" />{chamber}</span>
        </div>
        <div className="committee-member-footer">
          <span>{member.rank == null ? "Roster rank unavailable" : `Roster rank ${member.rank}`}</span>
          {profileHref ? <span className="committee-profile-cue">Open profile <ArrowUpRight size={13} aria-hidden="true" /></span> : null}
        </div>
      </div>
    </article>
  )

  return profileHref ? (
    <Link href={profileHref} className="committee-member-link" aria-label={`View ${name}'s legislator profile`}>
      {content}
    </Link>
  ) : content
}

export default function CommitteeDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id || ""

  const [state, setState] = useState<CommitteePageState>({ kind: "loading" })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function loadCommittee() {
      setState({ kind: "loading" })
      if (!id || !/^[a-z0-9-]+$/i.test(id)) {
        setState({ kind: "invalid" })
        return
      }
      try {
        const data = await getCommittee(id, controller.signal)
        setState(data ? { kind: "loaded", committee: data } : { kind: "not_found" })
      } catch (err) {
        if (controller.signal.aborted) return
        log.error("Error loading committee details:", { error: String(err) })
        setState({ kind: "error", message: err instanceof Error ? err.message : "Committee detail request failed" })
      }
    }
    void loadCommittee()
    return () => controller.abort()
  }, [id, retryKey])

  if (state.kind === "loading") {
    return (
      <ArchivePage>
        <div className="py-24 text-center text-muted-foreground">Loading committee profile...</div>
      </ArchivePage>
    )
  }

  if (state.kind === "invalid" || state.kind === "not_found" || state.kind === "error") {
    const isError = state.kind === "error"
    const title = state.kind === "invalid" ? "Invalid Committee Identifier" : isError ? "Committee Details Unavailable" : "Committee Not Found"
    const description = state.kind === "invalid"
      ? "The committee identifier contains unsupported characters. Open a committee from the directory to use its canonical identifier."
      : isError
        ? `${state.message}. The record's existence has not been determined.`
        : `No committee was returned for identifier ${id}.`
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
            action={<div className="flex flex-wrap gap-3">{isError ? <Button size="sm" onClick={() => setRetryKey((key) => key + 1)}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button> : null}<Button asChild variant="outline" size="sm"><Link href="/committees">Browse committees</Link></Button></div>}
          />
        </div>
      </ArchivePage>
    )
  }

  const committee = state.committee
  const members = (committee.members || []).slice().sort((a, b) => {
    const leadershipOrder = Number(isLeadership(b)) - Number(isLeadership(a))
    return leadershipOrder || (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || memberName(a).localeCompare(memberName(b))
  })
  const bills = committee.bills || []
  const leaders = members.filter(isLeadership)
  const rosterMembers = members.filter((member) => !isLeadership(member))

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

        <ArchivePanel title="Committee Membership Roster" kicker="Legislators">
          {members.length > 0 ? (
            <div className="committee-roster-shell">
              <div className="committee-roster-intro">
                <div>
                  <span className="archive-panel-kicker">Current assignment directory</span>
                  <p>Portraits link directly to each legislator&apos;s full accountability profile. Roles and ranks reflect the loaded committee record.</p>
                </div>
                <div className="committee-roster-count" aria-label={`${members.length} roster members`}>
                  <strong>{members.length}</strong>
                  <span>members</span>
                </div>
              </div>

              {leaders.length > 0 ? (
                <section className="committee-roster-group" aria-labelledby="committee-leadership-heading">
                  <div className="committee-roster-heading">
                    <div><span>01</span><h2 id="committee-leadership-heading">Committee leadership</h2></div>
                    <p>{leaders.length} designated {leaders.length === 1 ? "leader" : "leaders"}</p>
                  </div>
                  <div className="committee-leadership-grid">
                    {leaders.map((member, index) => <CommitteeMemberCard key={`${member.bioguide_id}-${member.title}-${index}`} member={member} committeeChamber={committee.chamber} priority={index < 4} />)}
                  </div>
                </section>
              ) : null}

              {rosterMembers.length > 0 ? (
                <section className="committee-roster-group" aria-labelledby="committee-members-heading">
                  <div className="committee-roster-heading">
                    <div><span>{leaders.length > 0 ? "02" : "01"}</span><h2 id="committee-members-heading">Full roster</h2></div>
                    <p>{rosterMembers.length} voting {rosterMembers.length === 1 ? "member" : "members"}</p>
                  </div>
                  <div className="committee-roster-grid">
                    {rosterMembers.map((member, index) => <CommitteeMemberCard key={`${member.bioguide_id}-${member.title}-${index}`} member={member} committeeChamber={committee.chamber} />)}
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <DataState kind="empty" title="Committee roster unavailable" description="No member assignments are loaded for this committee. This is shown as a coverage gap, not a zero-member committee." />
          )}
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
                      <tr key={`${b.bill_id || "bill"}-${idx}`} className="hover:bg-muted/30">
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
