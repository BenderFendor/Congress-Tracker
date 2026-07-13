"use client"

// Design direction: Evidence ledger. Identity anchors the page while source-typed relationships read as a precise, filterable record trail.
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ArrowUpRight, BadgeCheck, Network, Tags } from "lucide-react"

import { ArchiveHero, ArchiveMetrics, ArchivePage, ArchivePanel, DataState, EvidenceSpine } from "@/components/ui/archive-ui"
import { getOrganization, type OrganizationProfile, type RelationshipEvidence } from "@/lib/services/relationships"

type EvidenceFilter = "all" | RelationshipEvidence["evidence_tier"]

function relationshipLabel(key: string) {
  return key
    .replace(/^member:/, "Member ")
    .replace(/^organization:/, "Organization ")
    .replace(/^bill:/, "Bill ")
    .replace(/^committee:/, "Committee ")
}

export default function OrganizationPage() {
  const { id } = useParams<{ id: string }>()
  const [organization, setOrganization] = useState<OrganizationProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<EvidenceFilter>("all")
  const [limit, setLimit] = useState(25)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getOrganization(id)
      .then((profile) => { if (active) setOrganization(profile) })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : "Organization request failed") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  const relationships = useMemo(() => {
    if (!organization) return []
    return filter === "all"
      ? organization.relationships
      : organization.relationships.filter((relationship) => relationship.evidence_tier === filter)
  }, [filter, organization])
  const visibleRelationships = relationships.slice(0, limit)
  const organizationKey = organization ? `organization:${organization.organization_id}` : ""

  return (
    <ArchivePage>
      <div className="archive-context-bar">
        <Link className="archive-link" href="/search"><ArrowLeft size={14} /> Search records</Link>
        <span>Cross-source organization</span>
      </div>
      <ArchiveHero
        eyebrow="Cross-source organization record"
        title={organization?.canonical_name || "Organization"}
        accent={organization?.organization_type || "evidence"}
        description="Verified identifiers and source-typed relationships across campaign finance, lobbying, disclosures, committees, and legislation."
        mode="network"
        actions={organization?.website_url ? <a className="archive-link" href={organization.website_url} target="_blank" rel="noreferrer">Organization website <ArrowUpRight size={14} /></a> : undefined}
      />
      {loading ? (
        <DataState title="Loading organization evidence" description="Requesting canonical identifiers and relationship records." />
      ) : error ? (
        <DataState kind="error" title="Organization unavailable" description={`${error}. This request failure is not presented as an empty evidence record.`} />
      ) : !organization ? (
        <DataState title="Organization not found" description="No canonical organization matches this identifier." />
      ) : (
        <>
          <ArchiveMetrics metrics={[
            { label: "Identifiers", value: organization.identifiers.length, detail: "Verified source identifiers", icon: <BadgeCheck size={18} /> },
            { label: "Relationships", value: organization.relationships.length, detail: "Current evidence rows", icon: <Network size={18} /> },
            { label: "Evidence filter", value: filter === "all" ? "All tiers" : filter, detail: "Visible relationship scope", icon: <Tags size={18} /> },
            { label: "Coverage", value: organization.provenance?.sources[0]?.status || "Loaded", detail: "Canonical organization contract" },
          ]} />
          <div className="archive-content archive-grid-two">
            <div className="archive-sticky-aside space-y-4">
              <ArchivePanel
                title="Relationship evidence"
                kicker={`${visibleRelationships.length} of ${relationships.length} filtered records shown`}
                action={
                  <div className="organization-filter" aria-label="Filter relationship evidence">
                    {(["all", "direct", "derived", "contextual"] as EvidenceFilter[]).map((tier) => (
                      <button key={tier} type="button" aria-pressed={filter === tier} onClick={() => { setFilter(tier); setLimit(25) }}>{tier}</button>
                    ))}
                  </div>
                }
              >
                {relationships.length === 0 ? (
                  <DataState title="No relationships in this tier" description="The selected evidence tier has no loaded rows. Other tiers remain available above." />
                ) : (
                  <div className="entity-record-list">
                    {visibleRelationships.map((relationship, index) => (
                      <article className="organization-evidence-row" key={relationship.relationship_id} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                        <div className="organization-evidence-tier">{relationship.evidence_tier}</div>
                        <div>
                          <h2>{relationship.relation_type.replaceAll("_", " ")}</h2>
                          <p>{relationshipLabel(relationship.subject_key === organizationKey ? relationship.object_key : relationship.subject_key)}</p>
                          <div className="organization-evidence-meta">
                            <span>{relationship.source}</span>
                            <span>{relationship.confidence} confidence</span>
                            {relationship.observed_at ? <span>{relationship.observed_at}</span> : null}
                          </div>
                        </div>
                        {relationship.source_url ? <a className="archive-link" href={relationship.source_url} target="_blank" rel="noreferrer">Source <ArrowUpRight size={14} /></a> : <span className="text-xs text-muted-foreground">Source URL unavailable</span>}
                      </article>
                    ))}
                    {visibleRelationships.length < relationships.length ? (
                      <button className="entity-load-more" type="button" onClick={() => setLimit((current) => current + 25)}>
                        Load {Math.min(25, relationships.length - visibleRelationships.length)} more relationships
                      </button>
                    ) : null}
                  </div>
                )}
              </ArchivePanel>
            </div>
            <div className="space-y-4">
              <ArchivePanel title="Verified identifiers" kicker="Identity crosswalk">
                <dl className="divide-y divide-border px-4">
                  {organization.identifiers.map((identifier) => (
                    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3 text-sm" key={`${identifier.scheme}:${identifier.value}`}>
                      <dt className="font-mono text-xs uppercase text-muted-foreground">{identifier.scheme}</dt>
                      <dd><strong>{identifier.value}</strong><span className="mt-1 block text-xs text-muted-foreground">{identifier.source}</span></dd>
                    </div>
                  ))}
                </dl>
              </ArchivePanel>
              <EvidenceSpine identifier={String(organization.organization_id)} source="Canonical organization and relationship evidence" status="Loaded" coverage="Identifiers and typed relationship records; identifier overlap alone is not relationship proof" />
            </div>
          </div>
        </>
      )}
    </ArchivePage>
  )
}
