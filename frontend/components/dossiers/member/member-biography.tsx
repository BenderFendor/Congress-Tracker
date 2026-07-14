import { ExternalLink, GraduationCap, History, MapPinned, UserRound } from "lucide-react"
import { ArchivePanel } from "@/components/ui/archive-ui"
import type { Legislator } from "@/lib/services/legislators"

function externalIdentifierUrl(scheme: string, value: string) {
  const normalized = scheme.toLowerCase()
  if (normalized === "wikidata") return `https://www.wikidata.org/wiki/${encodeURIComponent(value)}`
  if (normalized === "fec") return `https://www.fec.gov/data/candidate/${encodeURIComponent(value)}/`
  if (normalized === "govtrack") return `https://www.govtrack.us/congress/members/${encodeURIComponent(value)}`
  if (normalized === "votesmart") return `https://justfacts.votesmart.org/candidate/biography/${encodeURIComponent(value)}`
  if (normalized === "ballotpedia") return `https://ballotpedia.org/${encodeURIComponent(value.replaceAll(" ", "_"))}`
  if (normalized === "opensecrets") return `https://www.opensecrets.org/members-of-congress/summary?cid=${encodeURIComponent(value)}`
  return null
}

export function MemberBiographySection({ member }: { member: Legislator }) {
  const hasNarrative = Boolean(member.biography_full || member.biography_summary || member.bio)
  const identifiers = Object.entries(member.identifiers ?? {}).flatMap(([scheme, values]) => values.map((value) => ({ scheme, value })))

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
      <div className="space-y-6">
        <ArchivePanel title="Biography" kicker="Source-backed profile narrative">
          {hasNarrative ? (
            <div className="space-y-4 text-base leading-8 text-muted-foreground">
              {(member.biography_full || member.biography_summary || member.bio).split(/\n{2,}/).map((paragraph, index) => <p key={`${paragraph.slice(0, 32)}-${index}`}>{paragraph}</p>)}
            </div>
          ) : <p className="text-sm leading-6 text-muted-foreground">A sourced biography narrative is not loaded for this member. Missing text is not replaced with generated claims.</p>}
        </ArchivePanel>

        <ArchivePanel title="Congressional timeline" kicker="Recorded terms and party history">
          {member.terms?.length ? (
            <ol className="relative border-l border-border pl-6">
              {member.terms.map((term, index) => (
                <li key={`${term.chamber}-${term.state}-${term.start_date}-${index}`} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[1.82rem] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-accent" aria-hidden="true" />
                  <div className="font-serif text-lg font-semibold text-foreground">{term.chamber} · {term.state}{term.district ? ` ${term.district}` : ""}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{term.start_date} – {term.end_date || "present"} · {term.party}</div>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm leading-6 text-muted-foreground">No term timeline is loaded in the current profile response.</p>}
        </ArchivePanel>
      </div>

      <div className="space-y-6">
        <ArchivePanel title="Background" kicker="Independently sourced facts">
          <dl className="space-y-5 text-sm">
            <div className="flex gap-3"><MapPinned size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><div><dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Birthplace / hometown</dt><dd className="mt-1 text-foreground">{[member.birthplace, member.hometown].filter(Boolean).join(" · ") || "Not loaded"}</dd></div></div>
            <div className="flex gap-3"><GraduationCap size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><div><dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Education</dt><dd className="mt-1 text-foreground">{member.education?.length ? member.education.join("; ") : "Not loaded"}</dd></div></div>
            <div className="flex gap-3"><UserRound size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><div><dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Prior employment</dt><dd className="mt-1 text-foreground">{member.prior_employment?.length ? member.prior_employment.join("; ") : "Not loaded"}</dd></div></div>
            <div className="flex gap-3"><History size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><div><dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Current term ends</dt><dd className="mt-1 text-foreground">{member.current_term_end || "Not loaded"}</dd></div></div>
          </dl>
        </ArchivePanel>

        <ArchivePanel title="External identifiers" kicker="Cross-source identity evidence">
          {identifiers.length > 0 ? (
            <div className="space-y-2">
              {identifiers.map(({ scheme, value }) => {
                const url = externalIdentifierUrl(scheme, value)
                const content = <><span className="uppercase text-muted-foreground">{scheme}</span><span className="break-all text-foreground">{value}</span>{url ? <ExternalLink size={13} aria-hidden="true" /> : null}</>
                return url
                  ? <a key={`${scheme}-${value}`} href={url} target="_blank" rel="noreferrer" className="grid min-h-11 grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border font-mono text-[10px] tracking-wide hover:border-accent hover:text-accent">{content}</a>
                  : <div key={`${scheme}-${value}`} className="grid min-h-11 grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border font-mono text-[10px] tracking-wide">{content}</div>
              })}
            </div>
          ) : <p className="text-sm leading-6 text-muted-foreground">No external cross-source identifiers are loaded for this profile.</p>}
        </ArchivePanel>
      </div>
    </div>
  )
}
