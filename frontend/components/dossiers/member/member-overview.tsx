import Link from "next/link"
import { Building2, CalendarDays, ExternalLink, Landmark, MapPin, Phone, Vote } from "lucide-react"
import { ArchivePanel } from "@/components/ui/archive-ui"
import type { Legislator } from "@/lib/services/legislators"
import type { MemberDossierResources, MemberTab } from "./types"

function serviceYears(startDate?: string | null, reportedYears?: number | null) {
  if (reportedYears != null && Number.isFinite(reportedYears)) return Math.max(0, Math.floor(reportedYears))
  if (!startDate) return null
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const now = new Date()
  let years = now.getFullYear() - start.getFullYear()
  const beforeAnniversary = now.getMonth() < start.getMonth()
    || (now.getMonth() === start.getMonth() && now.getDate() < start.getDate())
  if (beforeAnniversary) years -= 1
  return Math.max(0, years)
}

function committeeLabel(committee: NonNullable<Legislator["committees"]>[number]) {
  if (typeof committee === "string") return committee
  return committee.name || committee.committee_id || "Committee record"
}

export function MemberOverview({
  member,
  resources,
  onSelectTab,
}: {
  member: Legislator
  resources: MemberDossierResources
  onSelectTab: (tab: MemberTab) => void
}) {
  const years = serviceYears(member.service_start, member.years_in_office)
  const committeeCount = member.committees?.length ?? 0
  const loadedChannels = Object.entries(resources)
    .filter(([key, resource]) => key !== "profile" && resource.status === "loaded")
    .length
  const voteSummary = member.vote_summary

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.65fr)]">
      <div className="space-y-6">
        <ArchivePanel title="Public role" kicker="Verified identity and service">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="border-l-2 border-accent bg-card/60 p-4">
              <MapPin size={17} className="text-accent" aria-hidden="true" />
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Constituency</div>
              <div className="mt-1 font-serif text-xl font-semibold text-foreground">
                {member.current_state || member.state}{member.current_district ? ` · ${member.current_district}` : ""}
              </div>
            </div>
            <div className="border-l-2 border-accent bg-card/60 p-4">
              <Landmark size={17} className="text-accent" aria-hidden="true" />
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Chamber</div>
              <div className="mt-1 font-serif text-xl font-semibold text-foreground">{member.current_chamber || member.chamber}</div>
            </div>
            <div className="border-l-2 border-accent bg-card/60 p-4">
              <CalendarDays size={17} className="text-accent" aria-hidden="true" />
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Service</div>
              <div className="mt-1 font-serif text-xl font-semibold text-foreground">{years == null ? "Not loaded" : `${years} years`}</div>
            </div>
            <div className="border-l-2 border-accent bg-card/60 p-4">
              <Building2 size={17} className="text-accent" aria-hidden="true" />
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Committees</div>
              <div className="mt-1 font-serif text-xl font-semibold text-foreground">{committeeCount || "Not loaded"}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 border-t border-border pt-5 md:grid-cols-2">
            <div>
              <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Official contact</h3>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {member.office_address ? <p>{member.office_address}</p> : <p>Office address not loaded.</p>}
                {member.phone ? (
                  <a className="inline-flex items-center gap-2 text-foreground hover:text-accent" href={`tel:${member.phone}`}>
                    <Phone size={14} aria-hidden="true" /> {member.phone}
                  </a>
                ) : null}
                {member.website_url || member.url ? (
                  <a className="flex w-fit items-center gap-2 text-foreground hover:text-accent" href={member.website_url || member.url} target="_blank" rel="noreferrer">
                    Official website <ExternalLink size={14} aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </div>
            <div>
              <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Dossier coverage</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {loadedChannels} evidence channels are currently loaded in this browser session. Other sections load only when opened, reducing initial requests and keeping failures isolated.
              </p>
            </div>
          </div>
        </ArchivePanel>

        <ArchivePanel
          title="Committee assignments"
          kicker="Institutional position"
          action={committeeCount > 0 ? <span className="font-mono text-xs text-muted-foreground">{committeeCount} records</span> : undefined}
        >
          {committeeCount > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {member.committees?.map((committee, index) => {
                const id = typeof committee === "string" ? null : committee.committee_id
                const content = (
                  <div className="h-full border border-border bg-card/50 p-4 transition-colors hover:border-accent/60">
                    <div className="font-serif text-lg font-semibold text-foreground">{committeeLabel(committee)}</div>
                    {typeof committee !== "string" ? (
                      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {committee.title ? <span>{committee.title}</span> : null}
                        {committee.chamber ? <span>· {committee.chamber}</span> : null}
                        {committee.congress ? <span>· {committee.congress}th Congress</span> : null}
                      </div>
                    ) : null}
                  </div>
                )
                return id ? <Link key={`${id}-${index}`} href={`/committees/${id}`}>{content}</Link> : <div key={`${committeeLabel(committee)}-${index}`}>{content}</div>
              })}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">Committee assignments are not loaded for this profile. This does not imply the member has no assignments.</p>
          )}
        </ArchivePanel>
      </div>

      <div className="space-y-6">
        <ArchivePanel title="Vote record" kicker="Current Congress snapshot">
          {voteSummary ? (
            <div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border bg-card p-4">
                  <div className="font-serif text-3xl font-semibold text-foreground">{voteSummary.total_votes?.toLocaleString() ?? "—"}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Recorded votes</div>
                </div>
                <div className="border border-border bg-card p-4">
                  <div className="font-serif text-3xl font-semibold text-foreground">{voteSummary.missed_vote_pct == null ? "—" : `${voteSummary.missed_vote_pct.toFixed(1)}%`}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Missed</div>
                </div>
              </div>
              <button type="button" onClick={() => onSelectTab("votes")} className="mt-4 inline-flex min-h-10 items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-accent hover:underline">
                <Vote size={15} aria-hidden="true" /> Inspect roll calls
              </button>
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">No vote summary is loaded in the profile response. Open the Votes section to request the canonical roll-call endpoint.</p>
          )}
        </ArchivePanel>

        <ArchivePanel title="Research paths" kicker="Continue through evidence">
          <div className="space-y-2">
            {([
              ["funding", "Campaign-finance channels"],
              ["bills", "Sponsored and cosponsored legislation"],
              ["trades", "Reported disclosure transactions"],
              ["connections", "Typed relationship evidence"],
              ["disclosures", "Source filings and reported holdings"],
            ] as Array<[MemberTab, string]>).map(([tab, label]) => (
              <button
                type="button"
                key={tab}
                onClick={() => onSelectTab(tab)}
                className="flex min-h-11 w-full items-center justify-between border-b border-border px-1 text-left text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <span>{label}</span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </ArchivePanel>
      </div>
    </div>
  )
}
