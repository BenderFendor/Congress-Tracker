import Link from "next/link"
import { ExternalLink, FileText, Vote as VoteIcon } from "lucide-react"
import { ArchivePanel } from "@/components/ui/archive-ui"
import type { MemberLegislationItem, MemberLegislationPage, MemberLegislationResponse } from "@/lib/services/legislators"
import type { MemberVotesResult, Vote } from "@/lib/services/voting"
import type { LegislationSection } from "./types"
import { RecordCount } from "./member-dossier-ui"

function isBillIdentifier(value: string) {
  return /^[a-z]+\d+-\d+$/i.test(value)
}

function voteTone(position: string) {
  const normalized = position.toLowerCase()
  if (["yea", "aye", "yes"].includes(normalized)) return "border-emerald-500/60 bg-emerald-500/5"
  if (["nay", "no"].includes(normalized)) return "border-red-500/60 bg-red-500/5"
  if (normalized.includes("present")) return "border-amber-500/60 bg-amber-500/5"
  return "border-border bg-card/50"
}

export function MemberVotesSection({ votes }: { votes: MemberVotesResult }) {
  const summary = votes.summary

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Recorded votes", summary?.total_votes],
          ["Missed votes", summary?.missed_votes],
          ["Missed rate", summary?.missed_vote_pct == null ? null : `${summary.missed_vote_pct.toFixed(1)}%`],
          ["Party-majority alignment", summary?.party_line_pct == null ? null : `${summary.party_line_pct.toFixed(1)}%`],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-border border-t-2 border-t-accent bg-card p-4">
            <div className="font-serif text-3xl font-semibold text-foreground">{value ?? "Not available"}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <ArchivePanel title="Roll-call positions" kicker="Measure-aware official records" action={<RecordCount value={votes.votes.length} label="loaded" />}>
        <div className="space-y-3">
          {votes.votes.map((vote, index) => <VoteRow key={`${vote.bill.bill_id}-${vote.date}-${index}`} vote={vote} />)}
        </div>
      </ArchivePanel>

      {votes.provenance.warnings.length > 0 ? (
        <div className="border border-amber-500/40 bg-amber-500/5 p-4 text-sm leading-6 text-muted-foreground">
          {votes.provenance.warnings.join(" ")}
        </div>
      ) : null}
    </div>
  )
}

function VoteRow({ vote }: { vote: Vote }) {
  const content = (
    <div className={`grid gap-4 border-l-4 p-4 transition-colors hover:bg-card md:grid-cols-[minmax(0,1fr)_9rem] ${voteTone(vote.position)}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{vote.bill.number}</span>
          {vote.date ? <span>· {vote.date}</span> : null}
          {vote.result ? <span>· {vote.result}</span> : null}
        </div>
        <h3 className="mt-2 font-serif text-lg font-semibold leading-snug text-foreground">{vote.bill.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{vote.question || vote.description}</p>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3 md:block md:border-l md:border-t-0 md:pl-4 md:pt-0 md:text-right">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Position</span>
        <strong className="font-serif text-xl text-foreground md:mt-2 md:block">{vote.position}</strong>
      </div>
    </div>
  )

  return isBillIdentifier(vote.bill.bill_id)
    ? <Link href={`/bills/${vote.bill.bill_id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{content}</Link>
    : content
}

export function MemberLegislationSection({
  legislation,
  loading,
  onPage,
}: {
  legislation: MemberLegislationResponse
  loading: boolean
  onPage: (section: LegislationSection, offset: number) => void
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-border bg-card p-4"><div className="font-serif text-3xl font-semibold">{legislation.pagination.sponsor.total.toLocaleString()}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Sponsored bills</div></div>
        <div className="border border-border bg-card p-4"><div className="font-serif text-3xl font-semibold">{legislation.pagination.cosponsor.total.toLocaleString()}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Cosponsored bills</div></div>
        <div className="border border-border bg-card p-4"><div className="font-serif text-3xl font-semibold">{legislation.pagination.related_items.total.toLocaleString()}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Related records</div></div>
      </div>

      {legislation.latest_attempt && legislation.latest_attempt.status !== "success" ? (
        <div className="border border-amber-500/40 bg-amber-500/5 p-4 text-sm leading-6 text-muted-foreground">
          Latest refresh state: <strong className="text-foreground">{legislation.latest_attempt.status}</strong>
          {legislation.latest_attempt.error_message ? ` — ${legislation.latest_attempt.error_message}` : "."}
        </div>
      ) : null}

      <LegislationCollection title="Sponsored legislation" kicker="Primary sponsorship" items={legislation.sponsor} page={legislation.pagination.sponsor} section="sponsor" loading={loading} onPage={onPage} />
      <LegislationCollection title="Cosponsored legislation" kicker="Joined sponsorship" items={legislation.cosponsor} page={legislation.pagination.cosponsor} section="cosponsor" loading={loading} onPage={onPage} />

      <ArchivePanel title="Related legislative records" kicker="Amendments and linked items">
        {legislation.related_items.length > 0 ? (
          <div className="divide-y divide-border border-y border-border">
            {legislation.related_items.map((item, index) => (
              <div key={`${item.source_url}-${index}`} className="grid gap-3 py-4 md:grid-cols-[8rem_minmax(0,1fr)_auto]">
                <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{item.item_kind}</div>
                <div>
                  <div className="font-serif text-lg font-semibold text-foreground">{item.title || `${item.item_type || "Record"} ${item.item_number || ""}`}</div>
                  {item.latest_action_text ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.latest_action_text}</p> : null}
                </div>
                <a href={item.source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-accent hover:underline">
                  Source <ExternalLink size={13} aria-hidden="true" />
                </a>
              </div>
            ))}
          </div>
        ) : <p className="text-sm leading-6 text-muted-foreground">No related amendment or linked-item rows are loaded for this page.</p>}
        <Pager page={legislation.pagination.related_items} loading={loading} label="related records" onPage={(offset) => onPage("related_items", offset)} />
      </ArchivePanel>
    </div>
  )
}

function LegislationCollection({
  title,
  kicker,
  items,
  page,
  section,
  loading,
  onPage,
}: {
  title: string
  kicker: string
  items: MemberLegislationItem[]
  page: MemberLegislationPage
  section: LegislationSection
  loading: boolean
  onPage: (section: LegislationSection, offset: number) => void
}) {
  return (
    <ArchivePanel title={title} kicker={kicker} action={<RecordCount value={page.total} label="total" />}>
      {items.length > 0 ? (
        <div className="divide-y divide-border border-y border-border">
          {items.map((bill) => (
            <article key={`${bill.bill_id}-${bill.sponsor_type}`} className="grid gap-4 py-5 md:grid-cols-[8rem_minmax(0,1fr)_minmax(220px,0.65fr)]">
              <div>
                <Link href={`/bills/${bill.bill_id}`} className="font-mono text-xs font-bold uppercase tracking-wide text-accent hover:underline">{bill.bill_id}</Link>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{bill.sponsor_type}</div>
              </div>
              <div>
                <Link href={`/bills/${bill.bill_id}`} className="font-serif text-lg font-semibold leading-snug text-foreground hover:text-accent">{bill.title}</Link>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{bill.status}</p>
              </div>
              <div className="border-l-2 border-accent/50 pl-4">
                <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Latest action</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{bill.latest_action_text || "No latest action is loaded."}</p>
                {bill.latest_action_date ? <div className="mt-2 font-mono text-[10px] text-muted-foreground">{bill.latest_action_date}</div> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 py-5 text-sm text-muted-foreground"><FileText size={18} aria-hidden="true" /> No rows are loaded on this page.</div>
      )}
      <Pager page={page} loading={loading} label={title.toLowerCase()} onPage={(offset) => onPage(section, offset)} />
    </ArchivePanel>
  )
}

function Pager({ page, loading, label, onPage }: { page: MemberLegislationPage; loading: boolean; label: string; onPage: (offset: number) => void }) {
  const first = page.total === 0 ? 0 : page.offset + 1
  const last = Math.min(page.total, page.offset + page.limit)
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4" aria-busy={loading}>
      <button type="button" disabled={loading || page.offset === 0} onClick={() => onPage(Math.max(0, page.offset - page.limit))} className="min-h-10 border border-border bg-card px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
      <button type="button" disabled={loading || !page.has_more} onClick={() => onPage(page.offset + page.limit)} className="min-h-10 border border-border bg-card px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{first.toLocaleString()}–{last.toLocaleString()} of {page.total.toLocaleString()} {label}</span>
      {loading ? <VoteIcon size={14} className="animate-pulse text-accent" aria-hidden="true" /> : null}
    </div>
  )
}
