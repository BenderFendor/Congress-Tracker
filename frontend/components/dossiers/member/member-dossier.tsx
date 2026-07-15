"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ArrowLeft, ExternalLink, Landmark, MapPin, ShieldCheck } from "lucide-react"
import { ArchivePage, DataState, EvidenceSpine } from "@/components/ui/archive-ui"
import { EvidenceDownloadMenu } from "@/components/ui/evidence-download-menu"
import { MemberPortrait } from "@/components/ui/member-identity"
import { DossierTabs, ResourceBoundary, SectionFrame } from "./member-dossier-ui"
import { MemberOverview } from "./member-overview"
import { MemberFundingSection } from "./member-funding"
import { MemberLegislationSection, MemberVotesSection } from "./member-legislative"
import { MemberDisclosuresSection, MemberTradesSection } from "./member-financial"
import { MemberConnectionsSection } from "./member-connections"
import { MemberBiographySection } from "./member-biography"
import { useMemberDossier } from "./use-member-dossier"
import type { MemberTab, ResourceStatus } from "./types"

function partyPresentation(value: string) {
  const normalized = value.toLowerCase()
  if (normalized === "d" || normalized.includes("democrat")) return { label: "Democrat", className: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300" }
  if (normalized === "r" || normalized.includes("republican")) return { label: "Republican", className: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300" }
  if (normalized.includes("independent")) return { label: "Independent", className: "border-violet-500/50 bg-violet-500/10 text-violet-700 dark:text-violet-300" }
  return { label: value || "Unknown party", className: "border-border bg-card text-muted-foreground" }
}

export function MemberDossier({ memberId }: { memberId: string }) {
  const {
    activeTab,
    resources,
    loadedCount,
    selectTab,
    loadTab,
    loadTradesPage,
    loadLegislationPage,
  } = useMemberDossier(memberId)

  const member = resources.profile.data
  const party = partyPresentation(member?.current_party || member?.party || "")
  const statuses: Partial<Record<MemberTab, ResourceStatus>> = {
    overview: resources.profile.status,
    biography: resources.profile.status,
    funding: resources.funding.status,
    votes: resources.votes.status,
    bills: resources.legislation.status,
    trades: resources.trades.status,
    connections: resources.relationships.status,
    disclosures: resources.disclosures.status,
  }

  const exportPayload = useMemo(() => ({
    exported_at: new Date().toISOString(),
    member_id: memberId,
    coverage_note: "Only evidence channels loaded in this browser session are included. Missing channels are not factual zeroes.",
    profile: resources.profile.data,
    funding: resources.funding.data,
    votes: resources.votes.data,
    legislation: resources.legislation.data,
    trades: resources.trades.data,
    relationships: resources.relationships.data,
    disclosures: resources.disclosures.data,
  }), [memberId, resources])

  const csvRows = useMemo<Array<Record<string, unknown>>>(() => {
    const rows: Array<Record<string, unknown>> = []
    if (member) {
      rows.push({
        record_type: "member",
        bioguide_id: member.bioguide_id,
        name: member.name,
        party: member.current_party || member.party,
        state: member.current_state || member.state,
        district: member.current_district || member.district,
        chamber: member.current_chamber || member.chamber,
      })
    }
    resources.funding.data?.top_donors.forEach((donor) => rows.push({ record_type: "funding_donor", cycle: resources.funding.data?.cycle, name: donor.contributor_name, amount: donor.amount, record_count: donor.count }))
    resources.votes.data?.votes.forEach((vote) => rows.push({ record_type: "vote", date: vote.date, identifier: vote.bill.number, title: vote.bill.title, question: vote.question, position: vote.position, result: vote.result }))
    resources.legislation.data?.sponsor.forEach((bill) => rows.push({ record_type: "sponsored_bill", bill_id: bill.bill_id, title: bill.title, status: bill.status, latest_action: bill.latest_action_text, latest_action_date: bill.latest_action_date }))
    resources.legislation.data?.cosponsor.forEach((bill) => rows.push({ record_type: "cosponsored_bill", bill_id: bill.bill_id, title: bill.title, status: bill.status, latest_action: bill.latest_action_text, latest_action_date: bill.latest_action_date }))
    resources.trades.data?.trades.forEach((trade) => rows.push({ record_type: "disclosure_transaction", trade_id: trade.trade_id, asset_name: trade.asset_name, ticker: trade.ticker, transaction_type: trade.tx_type, amount_min: trade.amount_min, amount_max: trade.amount_max, transaction_date: trade.transaction_date, disclosure_date: trade.disclosure_date, source: trade.source, source_url: trade.filing_url }))
    resources.relationships.data?.relationships.forEach((relationship) => rows.push({ record_type: "relationship", relationship_type: relationship.relation_type, object_key: relationship.object_key, evidence_tier: relationship.evidence_tier, confidence: relationship.confidence, source: relationship.source, source_url: relationship.source_url }))
    resources.disclosures.data?.holdings.forEach((holding) => rows.push({ record_type: "holding", document_id: holding.document_id, asset_name: holding.asset_name, ticker: holding.ticker, owner_type: holding.owner_type, value_min: holding.value_min, value_max: holding.value_max, income_min: holding.income_min, income_max: holding.income_max }))
    return rows
  }, [member, resources])

  if (resources.profile.status === "loading" || resources.profile.status === "idle") {
    return (
      <ArchivePage>
        <div className="mx-auto flex min-h-[75vh] max-w-7xl items-center justify-center px-4">
          <div className="w-full max-w-4xl animate-pulse border border-border bg-card/50 p-8">
            <div className="h-3 w-40 bg-muted" />
            <div className="mt-6 h-16 w-3/4 bg-muted" />
            <div className="mt-5 h-4 w-1/2 bg-muted" />
            <div className="mt-10 grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 bg-muted" />)}</div>
          </div>
        </div>
      </ArchivePage>
    )
  }

  if (resources.profile.status === "error") {
    return (
      <ArchivePage>
        <div className="mx-auto max-w-3xl px-4 py-20">
          <DataState kind="error" title="Member dossier unavailable" description={resources.profile.error || "The member profile request failed."} action={<button type="button" onClick={() => window.location.reload()} className="font-mono text-xs font-semibold uppercase tracking-wide text-accent">Reload page</button>} />
        </div>
      </ArchivePage>
    )
  }

  if (!member) {
    return (
      <ArchivePage>
        <div className="mx-auto max-w-3xl px-4 py-20">
          <DataState kind="empty" title="Member not found" description={`No canonical member profile matched ${memberId}.`} action={<Link href="/legislators" className="font-mono text-xs font-semibold uppercase tracking-wide text-accent">Return to directory</Link>} />
        </div>
      </ArchivePage>
    )
  }

  return (
    <ArchivePage>
      <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-6 md:px-6 lg:px-8">
        <Link href="/legislators" className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <ArrowLeft size={15} aria-hidden="true" /> Member directory
        </Link>

        <header className="relative mt-2 overflow-hidden border border-border bg-card">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" aria-hidden="true" />
          <div className="grid lg:grid-cols-[240px_minmax(0,1fr)_320px]">
            <div className="relative min-h-72 overflow-hidden border-b border-border bg-muted/50 lg:border-b-0 lg:border-r">
              <MemberPortrait
                bioguideId={member.bioguide_id}
                name={member.name}
                suppliedUrls={[member.depiction_url, member.avatar]}
                priority
                className="absolute inset-0 block"
                imageClassName="h-full w-full object-cover object-top grayscale-[15%]"
                fallbackClassName="flex h-full w-full items-center justify-center font-serif text-7xl font-semibold text-muted-foreground"
                width={480}
                height={600}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-16 text-white">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em]">Bioguide {member.bioguide_id}</div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-between p-6 md:p-8 lg:p-10">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${party.className}`}>{party.label}</span>
                  <span className="border border-border bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{member.in_office ? "Current member" : "Historical member"}</span>
                </div>
                <p className="mt-7 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Congressional dossier</p>
                <h1 className="mt-3 max-w-4xl text-balance font-serif text-5xl font-semibold leading-[0.95] tracking-tight text-foreground md:text-7xl">{member.official_full_name || member.name}</h1>
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2"><Landmark size={15} aria-hidden="true" /> {member.current_chamber || member.chamber}</span>
                  <span className="inline-flex items-center gap-2"><MapPin size={15} aria-hidden="true" /> {member.current_state || member.state}{member.current_district ? ` · District ${member.current_district}` : ""}</span>
                  <span className="inline-flex items-center gap-2"><ShieldCheck size={15} aria-hidden="true" /> {Math.max(0, loadedCount - 1)} evidence channels loaded</span>
                </div>
              </div>

              <div className="mt-8 border-t border-border pt-5">
                <EvidenceDownloadMenu filenamePrefix={`${member.name}-congress-dossier`} json={exportPayload} csvRows={csvRows} />
              </div>
            </div>

            <div className="border-t border-border bg-background/50 p-6 lg:border-l lg:border-t-0 lg:p-8">
              <EvidenceSpine
                identifier={member.bioguide_id}
                source={member.provenance?.sources.map((source) => source.source).join(", ") || "Official congressional records"}
                status={member.in_office ? "Current member" : "Historical record"}
                coverage="Sections load independently and preserve partial, missing, and failed states."
                sourceUrl={member.website_url || member.url || null}
              >
                <div className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                  <p>This dossier links records by canonical identifiers. It does not infer relationships from names alone.</p>
                  {member.website_url || member.url ? <a href={member.website_url || member.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-accent hover:underline">Official website <ExternalLink size={12} aria-hidden="true" /></a> : null}
                </div>
              </EvidenceSpine>
            </div>
          </div>
        </header>

        <div className="mt-6">
          <DossierTabs activeTab={activeTab} statuses={statuses} onSelect={selectTab} />
        </div>

        <div className="mt-6">
          <SectionFrame tab="overview" activeTab={activeTab}>
            <MemberOverview member={member} resources={resources} onSelectTab={selectTab} />
          </SectionFrame>

          <SectionFrame tab="funding" activeTab={activeTab}>
            <ResourceBoundary status={resources.funding.status} error={resources.funding.error} hasData={Boolean(resources.funding.data)} loadingLabel="Loading campaign-finance channels" emptyTitle="No funding record loaded" emptyDescription="No canonical campaign-finance response is available for this member and cycle." onRetry={() => { void loadTab("funding", true) }}>
              {resources.funding.data ? <MemberFundingSection funding={resources.funding.data} /> : null}
            </ResourceBoundary>
          </SectionFrame>

          <SectionFrame tab="votes" activeTab={activeTab}>
            <ResourceBoundary status={resources.votes.status} error={resources.votes.error} hasData={Boolean(resources.votes.data?.summary || resources.votes.data?.votes.length)} loadingLabel="Loading official roll calls" emptyTitle="No vote rows loaded" emptyDescription="The canonical vote endpoint returned no rows for the selected Congress." onRetry={() => { void loadTab("votes", true) }}>
              {resources.votes.data ? <MemberVotesSection votes={resources.votes.data} /> : null}
            </ResourceBoundary>
          </SectionFrame>

          <SectionFrame tab="bills" activeTab={activeTab}>
            <ResourceBoundary status={resources.legislation.status} error={resources.legislation.error} hasData={Boolean(resources.legislation.data)} loadingLabel="Loading sponsorship history" emptyTitle="No legislation rows loaded" emptyDescription="No sponsored, cosponsored, or related legislative records are loaded for this member." onRetry={() => { void loadTab("bills", true) }}>
              {resources.legislation.data ? <MemberLegislationSection legislation={resources.legislation.data} loading={resources.legislation.status === "loading"} onPage={(section, offset) => { void loadLegislationPage(section, offset) }} /> : null}
            </ResourceBoundary>
          </SectionFrame>

          <SectionFrame tab="trades" activeTab={activeTab}>
            <ResourceBoundary status={resources.trades.status} error={resources.trades.error} hasData={Boolean(resources.trades.data)} loadingLabel="Loading disclosure transactions" emptyTitle="No transactions loaded" emptyDescription="No canonical disclosure transaction page is currently available." onRetry={() => { void loadTab("trades", true) }}>
              {resources.trades.data ? <MemberTradesSection trades={resources.trades.data} loading={resources.trades.status === "loading"} onPage={(offset) => { void loadTradesPage(offset) }} /> : null}
            </ResourceBoundary>
          </SectionFrame>

          <SectionFrame tab="connections" activeTab={activeTab}>
            <ResourceBoundary status={resources.relationships.status} error={resources.relationships.error} hasData={Boolean(resources.relationships.data?.relationships.length)} loadingLabel="Loading typed relationship evidence" emptyTitle="No relationship rows loaded" emptyDescription="No direct, derived, or contextual relationship rows are loaded for this member." onRetry={() => { void loadTab("connections", true) }}>
              {resources.relationships.data ? <MemberConnectionsSection response={resources.relationships.data} /> : null}
            </ResourceBoundary>
          </SectionFrame>

          <SectionFrame tab="disclosures" activeTab={activeTab}>
            <ResourceBoundary status={resources.disclosures.status} error={resources.disclosures.error} hasData={Boolean(resources.disclosures.data && (resources.disclosures.data.documents.length || resources.disclosures.data.holdings.length || resources.disclosures.data.transactions.length))} loadingLabel="Loading financial disclosure documents" emptyTitle="No disclosure records loaded" emptyDescription="No normalized filing, holding, or transaction records are loaded for this member." onRetry={() => { void loadTab("disclosures", true) }}>
              {resources.disclosures.data ? <MemberDisclosuresSection disclosures={resources.disclosures.data} /> : null}
            </ResourceBoundary>
          </SectionFrame>

          <SectionFrame tab="biography" activeTab={activeTab}>
            <MemberBiographySection member={member} />
          </SectionFrame>
        </div>
      </div>
    </ArchivePage>
  )
}
