import Link from "next/link"
import { ExternalLink, Network } from "lucide-react"
import { ArchivePanel } from "@/components/ui/archive-ui"
import type { RelationshipEvidence, RelationshipsResponse } from "@/lib/services/relationships"

function relationLabel(value: string) {
  return value.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
}

function tierDescription(tier: RelationshipEvidence["evidence_tier"]) {
  if (tier === "direct") return "Explicitly stated by the cited source record."
  if (tier === "derived") return "Calculated from source-backed identifiers or records under a documented rule."
  return "Context for further research; not presented as an observed relationship."
}

function relatedHref(key: string) {
  const [kind, value] = key.split(":", 2)
  if (!value) return null
  if (kind === "organization") return `/organizations/${encodeURIComponent(value)}`
  if (kind === "member") return `/legislators/${encodeURIComponent(value)}`
  if (kind === "bill") return `/bills/${encodeURIComponent(value)}`
  if (kind === "committee") return `/committees/${encodeURIComponent(value)}`
  if (kind === "network") return `/influence/${encodeURIComponent(value)}`
  return null
}

export function MemberConnectionsSection({ response }: { response: RelationshipsResponse }) {
  const grouped = {
    direct: response.relationships.filter((relationship) => relationship.evidence_tier === "direct"),
    derived: response.relationships.filter((relationship) => relationship.evidence_tier === "derived"),
    contextual: response.relationships.filter((relationship) => relationship.evidence_tier === "contextual"),
  }

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card/40 p-4 text-sm leading-6 text-muted-foreground">
        Relationship rows are divided by evidence tier. Direct, derived, and contextual records are not merged into a single score, and contextual similarity is not presented as proof of influence or causation.
      </div>

      {(["direct", "derived", "contextual"] as const).map((tier) => (
        <ArchivePanel
          key={tier}
          title={`${tier.charAt(0).toUpperCase()}${tier.slice(1)} evidence`}
          kicker={tierDescription(tier)}
          action={<span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{grouped[tier].length} rows</span>}
        >
          {grouped[tier].length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {grouped[tier].map((relationship) => <RelationshipCard key={relationship.relationship_id} relationship={relationship} />)}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">No {tier} relationship rows are loaded for this member.</p>
          )}
        </ArchivePanel>
      ))}
    </div>
  )
}

function RelationshipCard({ relationship }: { relationship: RelationshipEvidence }) {
  const href = relatedHref(relationship.object_key)
  return (
    <article className="h-full border border-border bg-card/50 p-4 transition-colors hover:border-accent/60">
      <div className="flex items-start gap-3">
        <Network size={17} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0">
          <div className="font-serif text-lg font-semibold text-foreground">{relationLabel(relationship.relation_type)}</div>
          <div className="mt-1 break-all font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{relationship.object_key}</div>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-muted-foreground">Confidence</dt><dd className="mt-1 font-mono text-foreground">{relationship.confidence}</dd></div>
        <div><dt className="text-muted-foreground">Source</dt><dd className="mt-1 font-mono text-foreground">{relationship.source}</dd></div>
      </dl>
      {relationship.observed_at ? <p className="mt-3 text-xs text-muted-foreground">Observed {relationship.observed_at}</p> : null}
      <div className="mt-3 flex flex-wrap gap-4">
        {href ? <Link href={href} className="inline-flex min-h-10 items-center font-mono text-[10px] font-semibold uppercase tracking-wide text-accent hover:underline">Open related dossier</Link> : null}
        {relationship.source_url ? <a href={relationship.source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-accent hover:underline">Source record <ExternalLink size={12} aria-hidden="true" /></a> : null}
      </div>
    </article>
  )
}
