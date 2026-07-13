"use client"

import { createLogger } from "@/lib/tracing"
import { useState, useEffect } from "react"
import type { KeyboardEvent, MouseEvent } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  MapPin,
  Landmark,
  Users,
  ExternalLink,
  AlertCircle
} from "lucide-react"
import { getLegislator, getMemberLegislation, Legislator } from "@/lib/services/legislators"
import { getMemberFunding, MemberFunding } from "@/lib/services/funding"
import { classifyFundingCoverage } from "@/lib/funding-coverage.mjs"
import { ProvenanceSummary } from "@/lib/services/provenance"
import { getMemberVotes, MemberVotesResult, Vote } from "@/lib/services/voting"
import { formatAmountRange, getTradesByMemberId } from "@/lib/services/stocks"
import type { StockTrade } from "@/lib/services/stocks"
import { ArchivePage, ArchivePanel, EvidenceSpine } from "@/components/ui/archive-ui"
import { getMemberDisclosures, getRelationships, MemberDisclosures, RelationshipEvidence } from "@/lib/services/relationships"
import { MemberPortrait } from "@/components/ui/member-identity"
import { createMemberDossierRequest, isAbortError } from "@/lib/member-dossier-request.mjs"

function ProvenanceBadge({ provenance }: { provenance?: ProvenanceSummary }) {
  if (!provenance) return null;
  const labels = provenance.sources
    .filter(s => s.confidence)
    .map(s => {
      const label = s.confidence === "verified" ? "Official" :
        s.confidence === "high" ? "Academic" :
        s.confidence === "medium" ? "Community" :
        s.confidence === "low" || s.confidence === "heuristic" ? "Heuristic" : "Unavailable";
      return { source: s.source, label };
    });
  return (
    <div className="flex gap-2 flex-wrap mt-4">
      {labels.map(l => (
        <span key={l.source} className="text-xs px-2.5 py-1 border border-border rounded-sm bg-card text-foreground font-mono">
          {l.source}: {l.label}
        </span>
      ))}
    </div>
  );
}

interface BillRow {
  bill_id: string;
  title: string;
  status: string;
  latest_action: string;
  date?: string;
}

function completedServiceYears(startDate: string | null | undefined) {
  if (!startDate) return null
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const today = new Date()
  let years = today.getFullYear() - start.getFullYear()
  if (today.getMonth() < start.getMonth() || (today.getMonth() === start.getMonth() && today.getDate() < start.getDate())) years -= 1
  return Math.max(years, 0)
}

function humanizeRelationshipType(value: string) {
  return value.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
}

function externalIdentifierUrl(scheme: string, value: string) {
  const routes: Record<string, (id: string) => string> = {
    wikidata: (id) => `https://www.wikidata.org/wiki/${encodeURIComponent(id)}`,
    fec: (id) => `https://www.fec.gov/data/candidate/${encodeURIComponent(id)}/`,
    govtrack: (id) => `https://www.govtrack.us/congress/members/${encodeURIComponent(id)}`,
    votesmart: (id) => `https://justfacts.votesmart.org/candidate/biography/${encodeURIComponent(id)}`,
    ballotpedia: (id) => `https://ballotpedia.org/${encodeURIComponent(id.replaceAll(" ", "_"))}`,
    opensecrets: (id) => `https://www.opensecrets.org/members-of-congress/summary?cid=${encodeURIComponent(id)}`,
  }
  return routes[scheme.toLowerCase()]?.(value) ?? null
}

const log = createLogger("LegislatorPage")

const MEMBER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "donations", label: "Funding" },
  { id: "voting", label: "Votes" },
  { id: "bills", label: "Bills" },
  { id: "trades", label: "Trades" },
  { id: "connections", label: "Connections" },
  { id: "disclosures", label: "Disclosures" },
  { id: "biography", label: "Biography" },
] as const

function tradeConflictEvidence(trade: StockTrade) {
  if (trade.conflict_flag_count <= 0) {
    return { label: "No detected overlap", detail: null, flagged: false }
  }
  const severity = trade.highest_conflict_severity.trim() || "Potential overlap"
  const firstConflict = trade.committee_conflicts[0]
  const committeeDetail = firstConflict?.description || trade.committee_names.join(", ") || null
  return {
    label: `${severity} · ${trade.conflict_flag_count} ${trade.conflict_flag_count === 1 ? "flag" : "flags"}`,
    detail: committeeDetail,
    flagged: true,
  }
}

export default function LegislatorProfilePage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState("overview")
  const [legislator, setLegislator] = useState<Legislator | null>(null)
  const [funding, setFunding] = useState<MemberFunding | null>(null)
  const [fundingError, setFundingError] = useState<string | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [voteEvidence, setVoteEvidence] = useState<MemberVotesResult | null>(null)
  const [sponsoredBills, setSponsoredBills] = useState<BillRow[]>([])
  const [cosponsoredBills, setCosponsoredBills] = useState<BillRow[]>([])
  const [relationships, setRelationships] = useState<RelationshipEvidence[]>([])
  const [disclosures, setDisclosures] = useState<MemberDisclosures | null>(null)
  const [loading, setLoading] = useState(true)
  const [tradePageState, setTradePageState] = useState<{
    memberId: string
    status: "idle" | "loading" | "error"
    error: string | null
    offset: number
  }>({ memberId: "", status: "idle", error: null, offset: 0 })

  function selectTab(tabId: string, target: HTMLButtonElement) {
    setActiveTab(tabId)
    target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
  }

  function handleTabClick(tabId: string, event: MouseEvent<HTMLButtonElement>) {
    selectTab(tabId, event.currentTarget)
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    const tabList = event.currentTarget.closest('[role="tablist"]')
    const tabs = Array.from(tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
    const currentIndex = tabs.indexOf(event.currentTarget)
    if (currentIndex < 0 || tabs.length === 0) return

    event.preventDefault()
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length
    tabs[nextIndex]?.focus()
    tabs[nextIndex]?.click()
  }

  async function loadTradePage(targetOffset: number) {
    if (!legislator) return
    const memberId = legislator.bioguide_id
    const offset = Math.max(0, targetOffset)
    setTradePageState({ memberId, status: "loading", error: null, offset })

    try {
      const response = await getTradesByMemberId(memberId, 100, offset)
      setLegislator((current) => {
        if (!current || current.bioguide_id !== memberId) return current
        return {
          ...current,
          recentTrades: response.trades,
          tradeCoverage: {
            ...current.tradeCoverage,
            status: response.coverage.status,
            message: response.coverage.message,
            total: response.total,
            hasMore: response.coverage.has_more,
            excludedDateAnomalies: response.coverage.excluded_date_anomalies,
            offset: response.offset,
          },
        }
      })
      setTradePageState((current) => current.memberId === memberId
        ? { memberId, status: "idle", error: null, offset: response.offset }
        : current)
    } catch (error) {
      setTradePageState((current) => current.memberId === memberId
        ? {
            memberId,
            status: "error",
            error: error instanceof Error ? error.message : "Older disclosure records could not be loaded.",
            offset,
          }
        : current)
    }
  }

  useEffect(() => {
    const request = createMemberDossierRequest(params.id)

    setActiveTab("overview")
    setLegislator(null)
    setFunding(null)
    setFundingError(null)
    setVotes([])
    setVoteEvidence(null)
    setSponsoredBills([])
    setCosponsoredBills([])
    setRelationships([])
    setDisclosures(null)
    setTradePageState({ memberId: request.memberId, status: "idle", error: null, offset: 0 })
    setLoading(true)

    async function loadData() {
      try {
        const leg = await getLegislator(request.memberId, request.signal)
        request.commit(request.memberId, () => setLegislator(leg))

        if (leg) {
          const bioguideId = leg.bioguide_id || leg.id

          getMemberFunding(bioguideId, undefined, request.signal)
            .then((data) => {
              request.commit(request.memberId, () => {
                setFunding(data)
                setFundingError(null)
              })
            })
            .catch((e) => {
              if (isAbortError(e)) return
              request.commit(request.memberId, () => setFundingError(e instanceof Error ? e.message : "Funding request failed"))
              log.error("Funding fetch failed", { error: String(e) })
            })

          getMemberVotes(bioguideId, 119, request.signal).then((data) => {
            request.commit(request.memberId, () => {
              setVotes(data.votes)
              setVoteEvidence(data)
            })
          }).catch(e => {
            if (!isAbortError(e)) log.error("Background fetch failed", { error: String(e) })
          })

          getMemberLegislation(bioguideId, 119, request.signal).then(data => {
            request.commit(request.memberId, () => {
              setSponsoredBills(data.sponsor.map(mapLegislationToBill))
              setCosponsoredBills(data.cosponsor.map(mapLegislationToBill))
            })
          }).catch(e => {
            if (!isAbortError(e)) log.error("Background fetch failed", { error: String(e) })
          })

          getRelationships({ subjectKey: `member:${bioguideId}`, limit: 25 }, request.signal)
            .then(data => request.commit(request.memberId, () => setRelationships(data.relationships)))
            .catch(e => {
              if (!isAbortError(e)) log.error("Background fetch failed", { error: String(e) })
            })

          getMemberDisclosures(bioguideId, request.signal)
            .then(data => request.commit(request.memberId, () => setDisclosures(data)))
            .catch(e => {
              if (!isAbortError(e)) log.error("Background fetch failed", { error: String(e) })
            })
        }
      } catch (error) {
        if (!isAbortError(error)) log.error("Failed to load legislator data", { error: String(error) })
      } finally {
        request.commit(request.memberId, () => setLoading(false))
      }
    }
    loadData()

    return () => request.cancel()
  }, [params.id])

  function mapLegislationToBill(bill: {
    bill_id: string
    title: string
    status: string
    latest_action_date?: string | null
    latest_action_text?: string | null
  }): BillRow {
    return {
      bill_id: bill.bill_id,
      title: bill.title,
      status: bill.status,
      latest_action: bill.latest_action_text || "No latest action recorded",
      date: bill.latest_action_date || undefined,
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  if (!legislator) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-8">
      <div className="bg-card border border-border p-8 max-w-md text-center shadow-sm">
        <Users size={48} className="mx-auto text-muted-foreground mb-4" />
        <h2 className="font-serif text-2xl font-bold text-foreground mb-2">Legislator Not Found</h2>
        <p className="font-sans text-sm text-muted-foreground mb-6">
          We couldn&apos;t find public records matching ID <span className="font-mono bg-muted px-1.5 py-0.5">{params.id}</span>.
        </p>
        <Link
          href="/legislators"
          className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background font-sans text-sm font-bold tracking-wide rounded-sm hover:opacity-90 transition-opacity"
        >
          <ArrowLeft size={16} />
          Back to Directory
        </Link>
      </div>
    </div>
  )

  const normalizedParty = (legislator.current_party || legislator.party || "").toLowerCase()
  const partyName = normalizedParty === "d" || normalizedParty.includes("democrat") ? "Democrat"
    : normalizedParty === "r" || normalizedParty.includes("republican") ? "Republican"
      : normalizedParty.includes("independent") ? "Independent" : legislator.current_party || legislator.party || "Unknown";
    
  const partyBadgeClass = partyName === "Democrat" ? "bg-blue-600 text-white" : partyName === "Republican" ? "bg-red-600 text-white" : "bg-gray-600 text-white";

  const { hasFundingTotals, totalsOnly: fundingTotalsOnly, hasCanonicalRankings: hasCanonicalFundingRankings } = classifyFundingCoverage(funding)
  const profileSource = legislator.provenance?.sources[0]
  const serviceYears = legislator.years_in_office == null ? completedServiceYears(legislator.service_start) : Math.floor(Number(legislator.years_in_office))

  const aipacNetwork = funding?.influence_networks?.find(n => n.network_slug.toLowerCase() === "aipac")
  const committeeRelationships = funding?.committee_relationships ?? funding?.top_committees ?? []
  const directCommitteeContributions = committeeRelationships.filter(
    relationship => !relationship.relationship_type || relationship.relationship_type === "contribution"
  )
  const authorizedCommitteeTransfers = committeeRelationships.filter(
    relationship => relationship.relationship_type === "transfer"
  )
  const leadershipPacs = funding?.leadership_pacs ?? []

  const voteSummary = voteEvidence?.summary
  const missedVotePct = voteSummary?.missed_vote_pct
  const partyLinePct = voteSummary?.party_line_pct

  const recentVotesList = (legislator.vote_summary?.recent_votes && legislator.vote_summary.recent_votes.length > 0)
    ? legislator.vote_summary.recent_votes.map(v => ({
        vote_id: v.vote_id,
        date: v.vote_date || "Unknown date",
        context: v.measure?.label || "Roll-call vote",
        question: v.question,
        position: v.position
      }))
    : votes.map(v => ({
        vote_id: v.bill?.number || "Roll Call",
        date: v.date || "Unknown date",
        context: v.bill?.title || "Roll-call vote",
        question: v.question || v.description,
        position: v.position
      }))

  return (
    <ArchivePage>
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 pt-8 pb-20">
        <Link href="/legislators" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-sans text-sm tracking-wide mb-6 transition-colors">
          <ArrowLeft size={16} />
          Back to Directory
        </Link>

        {/* Member Hero */}
        <div className="bg-card border border-border p-8 md:p-10 mb-8 relative flex flex-col md:flex-row gap-8 items-start">
          <div className="relative shrink-0">
            <div className="w-32 h-32 md:w-40 md:h-40 border border-border bg-muted">
              <MemberPortrait
                bioguideId={legislator.bioguide_id}
                name={legislator.name}
                suppliedUrls={[legislator.avatar, legislator.depiction_url]}
                className="block h-full w-full"
                imageClassName="h-full w-full object-cover object-[center_20%]"
                fallbackClassName="grid h-full w-full place-items-center font-serif text-4xl font-bold text-muted-foreground opacity-60"
                width={320}
                height={320}
                priority
              />
            </div>
            <div className={`absolute -bottom-3 -right-3 px-4 py-1 text-xs font-bold uppercase tracking-wider rounded-full shadow-sm ${partyBadgeClass}`}>
              {partyName}
            </div>
          </div>

          <div className="flex-1 w-full">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-2">
                  {legislator.name}
                </h1>
                <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm uppercase tracking-wide flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={16} />
                    <span>{legislator.state}{legislator.district ? `-${legislator.district}` : ""}</span>
                  </div>
                  <span className="text-border text-lg leading-none">|</span>
                  <div className="flex items-center gap-1.5">
                    <Landmark size={16} />
                    <span>{legislator.chamber}</span>
                  </div>
                </div>
              </div>
              
              {legislator.url && (
                <a
                  href={legislator.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-background border border-border hover:bg-muted text-foreground transition-colors font-sans text-sm font-medium rounded-sm shadow-sm shrink-0"
                >
                  Official Site
                  <ExternalLink size={16} />
                </a>
              )}
            </div>

            <div className="flex gap-5 mt-6">
              <div className="w-1 shrink-0 bg-border"></div>
              <p className="font-serif text-base md:text-lg text-muted-foreground leading-relaxed max-w-3xl">
                {legislator.biography_summary || legislator.bio || "Member of the United States Congress."}
              </p>
            </div>

            <ProvenanceBadge provenance={legislator.provenance} />
          </div>
        </div>

        <div className="mb-8">
          <EvidenceSpine
            identifier={legislator.bioguide_id}
            source={profileSource?.source || "Member profile API"}
            status={profileSource?.status || "Loaded"}
            updated={profileSource?.fetched_at}
            coverage={`${legislator.committees?.length ?? 0} committee assignments · ${legislator.recentTrades.length} linked trades`}
            sourceUrl={legislator.url || null}
          >
            {legislator.provenance?.warnings.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                {legislator.provenance.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            ) : null}
          </EvidenceSpine>
        </div>

        {/* Tabs Navigation */}
        <div
          role="tablist"
          aria-label="Member record sections"
          className="flex border-b border-border mb-8 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {MEMBER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`member-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`member-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={(event) => handleTabClick(tab.id, event)}
                onKeyDown={handleTabKeyDown}
                className={`px-6 py-4 font-sans text-sm tracking-wide transition-all border-b-4 whitespace-nowrap ${
                  isActive
                    ? 'border-accent text-foreground font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div
          id={`member-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`member-tab-${activeTab}`}
          tabIndex={0}
          className="min-h-[400px]"
        >
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ArchivePanel title="Service Timeline" kicker="Congressional Tenure">
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted-foreground">Service Start Date</span>
                    <span className="font-bold text-foreground">{legislator.service_start || "Records unavailable"}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted-foreground">Current Term End Date</span>
                    <span className="font-bold text-foreground">{legislator.current_term_end || "Current Session"}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted-foreground">Years in Office</span>
                    <span className="font-bold text-foreground">
                      {serviceYears != null ? `${serviceYears} ${serviceYears === 1 ? "year" : "years"}` : "Records unavailable"}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Next Scheduled Election</span>
                    <span className="font-bold text-foreground">{legislator.next_election || "Not listed"}</span>
                  </div>
                </div>
              </ArchivePanel>

              <ArchivePanel title="Ideology Spectrum" kicker="NOMINATE Dimension 1">
                <div className="space-y-6">
                  {legislator.nominate_dim1 != null ? (
                    <div>
                      <div className="flex justify-between items-center mb-2 font-mono text-sm">
                        <span className="text-muted-foreground">Score: <strong className="text-foreground">{Number(legislator.nominate_dim1).toFixed(3)}</strong></span>
                        <span className="font-bold uppercase tracking-wider px-2 py-0.5 bg-muted text-xs">
                          {legislator.nominate_dim1 < -0.2 ? "Left / Liberal" : legislator.nominate_dim1 > 0.2 ? "Right / Conservative" : "Center / Moderate"}
                        </span>
                      </div>
                      <div className="w-full bg-muted h-3 rounded-full relative overflow-hidden border border-border">
                        <div
                          className="h-full bg-accent absolute top-0 w-3 rounded-full"
                          style={{ left: `${Math.min(95, Math.max(0, ((Number(legislator.nominate_dim1) + 1) / 2) * 100))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] font-mono text-muted-foreground mt-2 uppercase">
                        <span>Left (-1.0)</span>
                        <span>Center (0.0)</span>
                        <span>Right (+1.0)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground font-mono italic p-4 text-center border border-border bg-muted/30">
                      NOMINATE ideology dimension score currently unavailable for this legislator.
                    </div>
                  )}
                </div>
              </ArchivePanel>

              <div className="lg:col-span-2">
                <ArchivePanel title="Committee Assignments" kicker="Current Session">
                  {Array.isArray(legislator.committees) && legislator.committees.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {legislator.committees.map((comm, idx) => {
                        const name = typeof comm === 'string' ? comm : (comm.name || comm.committee_id || "Committee")
                        const title = typeof comm === 'object' && comm.title ? comm.title : null
                        const chamber = typeof comm === 'object' && comm.chamber ? comm.chamber : null
                        return (
                          <div key={idx} className="p-4 border border-border bg-muted/40 flex flex-col justify-between">
                            <div className="font-serif font-bold text-foreground text-base mb-1">{name}</div>
                            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground uppercase mt-2">
                              <span>{chamber ? `${chamber} Chamber` : "Congressional Committee"}</span>
                              {title && <span className="text-accent font-bold">{title}</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                      No committee assignments listed in verified profiles.
                    </div>
                  )}
                </ArchivePanel>
              </div>
            </div>
          )}

          {activeTab === 'donations' && (
            <div className="space-y-8">
              {fundingError ? (
                <div className="bg-card border border-red-500/50 p-6 flex items-start gap-4" role="alert">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={24} />
                  <div>
                    <h3 className="font-serif font-bold text-lg text-foreground mb-1">Funding request failed</h3>
                    <p className="font-sans text-sm text-muted-foreground">
                      {fundingError}. No totals or rankings are shown because an API failure is not evidence of zero contributions.
                    </p>
                  </div>
                </div>
              ) : !hasFundingTotals ? (
                <div className="bg-card border border-amber-500/50 p-6 flex items-start gap-4">
                  <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={24} />
                  <div>
                    <h3 className="font-serif font-bold text-lg text-foreground mb-1">Funding coverage unavailable</h3>
                    <p className="font-sans text-sm text-muted-foreground">
                      No verified funding totals are loaded for this member and cycle. This is a coverage gap, not evidence of zero contributions.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-card border border-border p-6 text-center">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Total Receipts</div>
                    <div className="text-3xl font-serif font-bold text-foreground">
                      ${(funding?.direct_receipts || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-card border border-border p-6 text-center">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">PAC Receipts</div>
                    <div className="text-3xl font-serif font-bold text-foreground">
                      ${(funding?.pac_receipts || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-card border border-border p-6 text-center">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Individual Receipts</div>
                    <div className="text-3xl font-serif font-bold text-foreground">
                      ${(funding?.individual_receipts || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {fundingTotalsOnly ? (
                <div className="border border-amber-500/50 bg-amber-500/10 p-5" role="note">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" size={20} aria-hidden="true" />
                    <div className="space-y-2">
                      <h3 className="font-serif text-lg font-bold text-foreground">Funding totals only</h3>
                      <p className="text-sm leading-6 text-muted-foreground">
                        OpenFEC supplied candidate-cycle totals, but the FEC bulk warehouse has no canonical rankings for this member and cycle. No rankings are inferred from totals.
                      </p>
                      <p className="font-mono text-xs uppercase tracking-wide text-amber-700 dark:text-amber-200">
                        OpenFEC · Cycle {funding?.cycle ?? "unavailable"} · Rankings unavailable
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <ArchivePanel title="Funding evidence" kicker="Source coverage">
                <EvidenceSpine
                  source={funding?.provenance?.sources.map((source) => source.source).join(", ") || "OpenFEC funding endpoint"}
                  status={fundingError ? "Request failed" : fundingTotalsOnly ? "Totals only" : hasFundingTotals ? "Loaded" : "Unavailable"}
                  coverage={fundingError ? "No funding claims rendered" : hasCanonicalFundingRankings ? "Canonical donor and committee rankings loaded" : "Candidate totals loaded; bulk rankings unavailable for this member and cycle"}
                >
                  {funding?.provenance?.warnings.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                      {funding.provenance.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  ) : null}
                </EvidenceSpine>
              </ArchivePanel>

              {aipacNetwork && (
                <ArchivePanel title="AIPAC / Pro-Israel Network Tracing" kicker="Verified Political Expenditures">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    <div className="p-5 bg-muted/40 border border-border">
                      <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Direct PAC contributions</div>
                      <div className="text-2xl font-serif font-bold text-foreground">
                        {!hasFundingTotals ? "Unavailable" : `$${(aipacNetwork.direct_pac || 0).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="p-5 bg-muted/40 border border-border">
                      <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Independent expenditures supporting</div>
                      <div className="text-2xl font-serif font-bold text-green-600 dark:text-green-400">
                        {!hasFundingTotals ? "Unavailable" : `$${(aipacNetwork.independent_supporting || 0).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="p-5 bg-muted/40 border border-border">
                      <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Independent expenditures opposing</div>
                      <div className="text-2xl font-serif font-bold text-red-600 dark:text-red-400">
                        {!hasFundingTotals ? "Unavailable" : `$${(aipacNetwork.independent_opposing || 0).toLocaleString()}`}
                      </div>
                    </div>
                  </div>
                </ArchivePanel>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ArchivePanel title="Top disclosed individual donors" kicker="Itemized receipt records">
                  {hasFundingTotals && (funding?.top_donors?.length ?? 0) > 0 ? (
                    <div className="space-y-4">
                      {funding?.top_donors.map((donor, idx) => (
                        <div key={idx} className="flex justify-between items-center p-4 border border-border bg-muted/30">
                          <div>
                            <div className="font-serif font-bold text-foreground">{donor.contributor_name}</div>
                            <div className="text-xs font-mono text-muted-foreground uppercase mt-0.5">
                              {donor.count} contributions
                            </div>
                          </div>
                          <div className="font-mono font-bold text-base text-foreground">
                            ${(donor.amount || 0).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                      {!hasFundingTotals ? "No verified funding totals are loaded." : "No canonical itemized individual-donor ranking is available for this member and cycle."}
                    </div>
                  )}
                </ArchivePanel>

                <ArchivePanel title="Committee contributions received" kicker="Direct campaign receipts">
                  {hasFundingTotals && directCommitteeContributions.length > 0 ? (
                    <div className="space-y-4">
                      {directCommitteeContributions.map((comm) => (
                        <div key={`${comm.committee_id}-${comm.relationship_type ?? "contribution"}`} className="flex justify-between items-center p-4 border border-border bg-muted/30">
                          <div>
                            <div className="font-serif font-bold text-foreground">{comm.committee_name}</div>
                            <div className="text-xs font-mono text-muted-foreground uppercase mt-0.5">
                              ID: {comm.committee_id} · {comm.resolution_status ?? "resolution unknown"}
                            </div>
                          </div>
                          <div className="font-mono font-bold text-base text-foreground">
                            ${(comm.amount || 0).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                      {!hasFundingTotals ? "No verified funding totals are loaded." : "No canonical direct committee-contribution ranking is available for this member and cycle."}
                    </div>
                  )}
                </ArchivePanel>

                <ArchivePanel title="Authorized committee transfers" kicker="Reported separately">
                  {hasFundingTotals && authorizedCommitteeTransfers.length > 0 ? (
                    <div className="space-y-4">
                      {authorizedCommitteeTransfers.map((comm) => (
                        <div key={`${comm.committee_id}-transfer`} className="flex justify-between items-center p-4 border border-border bg-muted/30">
                          <div>
                            <div className="font-serif font-bold text-foreground">{comm.committee_name}</div>
                            <div className="text-xs font-mono text-muted-foreground uppercase mt-0.5">
                              ID: {comm.committee_id} · {comm.transaction_count ?? "Unknown"} records
                            </div>
                          </div>
                          <div className="font-mono font-bold text-base text-foreground">
                            ${(comm.amount || 0).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                      {!hasFundingTotals ? "No verified funding totals are loaded." : "No canonical authorized-committee transfers are reported for this member and cycle."}
                    </div>
                  )}
                </ArchivePanel>

                <ArchivePanel title="Leadership PACs" kicker="Sponsored committee activity">
                  {leadershipPacs.length > 0 ? (
                    <div className="space-y-4">
                      {leadershipPacs.map((pac) => (
                        <div className="border border-border bg-muted/30 p-4" key={pac.committee_id}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-serif font-bold text-foreground">{pac.committee_name}</div>
                              <div className="mt-0.5 font-mono text-xs uppercase text-muted-foreground">
                                {pac.committee_id} · {pac.resolution_status}
                              </div>
                            </div>
                            {pac.source_url ? (
                              <a className="font-mono text-xs font-bold uppercase text-accent hover:underline" href={pac.source_url} rel="noreferrer" target="_blank">
                                FEC reports <ExternalLink className="inline" size={12} />
                              </a>
                            ) : null}
                          </div>
                          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                            <div>
                              <dt className="font-mono text-[10px] uppercase text-muted-foreground">PAC receipts</dt>
                              <dd className="mt-1 font-bold">{pac.total_receipts == null ? "Unavailable" : `$${pac.total_receipts.toLocaleString()}`}</dd>
                            </div>
                            <div>
                              <dt className="font-mono text-[10px] uppercase text-muted-foreground">Disbursements</dt>
                              <dd className="mt-1 font-bold">{pac.total_disbursements == null ? "Unavailable" : `$${pac.total_disbursements.toLocaleString()}`}</dd>
                            </div>
                            <div>
                              <dt className="font-mono text-[10px] uppercase text-muted-foreground">Cash on hand</dt>
                              <dd className="mt-1 font-bold">{pac.cash_on_hand == null ? "Unavailable" : `$${pac.cash_on_hand.toLocaleString()}`}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-border p-6 text-center font-mono text-muted-foreground">
                      No FEC leadership PAC is resolved to this member for cycle {funding?.cycle ?? 2026}.
                    </div>
                  )}
                </ArchivePanel>
              </div>
            </div>
          )}

          {activeTab === 'voting' && (
            <div className="space-y-8">
              <div className="border-l-2 border-accent bg-card px-5 py-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">119th Congress · recorded roll calls</div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Attendance uses every loaded roll call from {voteSummary?.first_vote_date || "the start of available coverage"} through {voteSummary?.last_vote_date || "the latest loaded vote"}. Party alignment compares Yes/No votes with the strict majority position of the member&apos;s recorded party at the time of each vote; tied party votes are excluded.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ArchivePanel title="Missed-Vote Rate" kicker="Attendance">
                  {missedVotePct != null && voteSummary ? <div className="space-y-4">
                    <div className="flex items-end justify-between gap-4">
                      <div className="text-4xl font-serif font-bold text-foreground">{Number(missedVotePct).toFixed(1)}%</div>
                      <div className="text-right font-mono text-xs text-muted-foreground">{voteSummary.missed_votes} missed<br />of {voteSummary.total_votes} recorded</div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label={`${Number(missedVotePct).toFixed(1)} percent of recorded votes missed`}>
                      <div className="h-full bg-accent transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${Math.min(100, missedVotePct)}%` }} />
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">Denominator: all loaded member positions, including present and not-voting records.</p>
                  </div> : <p className="text-sm leading-6 text-muted-foreground">Attendance cannot be calculated because no roll-call positions are loaded for this Congress.</p>}
                </ArchivePanel>
                <ArchivePanel title="Party-Line Alignment" kicker="Ideological Consistency">
                  {partyLinePct != null && voteSummary?.party_line_eligible_votes ? <div className="space-y-4">
                    <div className="flex items-end justify-between gap-4">
                      <div className="text-4xl font-serif font-bold text-foreground">{Number(partyLinePct).toFixed(1)}%</div>
                      <div className="text-right font-mono text-xs text-muted-foreground">{voteSummary.party_line_votes} aligned<br />of {voteSummary.party_line_eligible_votes} comparable</div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label={`${Number(partyLinePct).toFixed(1)} percent aligned with the party majority`}>
                      <div className="h-full bg-foreground transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${Math.min(100, partyLinePct)}%` }} />
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">Abstentions, tied caucus votes, missing historical party codes, and votes without a party-majority comparison are excluded.</p>
                  </div> : <p className="text-sm leading-6 text-muted-foreground">Party alignment is unavailable because the loaded records do not include enough party-coded Yes/No positions.</p>}
                </ArchivePanel>
              </div>

              <ArchivePanel title="Recent Roll-Call Votes" kicker="Official Record">
                {recentVotesList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse font-sans text-sm">
                      <thead>
                        <tr className="border-b border-border text-left font-mono text-xs uppercase text-muted-foreground">
                          <th className="p-4">Vote ID</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Measure</th>
                          <th className="p-4">Question</th>
                          <th className="p-4 text-right">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentVotesList.map((v, idx) => (
                          <tr key={idx} className="border-b border-border hover:bg-muted/40 transition-colors">
                            <td className="p-4 font-mono text-xs font-bold text-accent">{v.vote_id}</td>
                            <td className="p-4 font-mono text-xs text-muted-foreground whitespace-nowrap">{v.date}</td>
                            <td className="p-4 text-xs text-muted-foreground">{v.context}</td>
                            <td className="p-4 font-serif">{v.question}</td>
                            <td className="p-4 text-right">
                              <span className={`px-2.5 py-1 font-mono text-xs font-bold border rounded-sm inline-block ${
                                v.position === "Yes" || v.position === "Yea"
                                  ? "text-green-600 border-green-500/30 bg-green-900/10"
                                  : v.position === "No" || v.position === "Nay"
                                    ? "text-red-600 border-red-500/30 bg-red-900/10"
                                    : "text-muted-foreground border-gray-500/30 bg-gray-900/10"
                              }`}>
                                {v.position}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                    No recent voting records found for this member.
                  </div>
                )}
              </ArchivePanel>
            </div>
          )}

          {activeTab === 'bills' && (
            <div className="space-y-8">
              <ArchivePanel title="Sponsored Legislation" kicker="Primary Sponsor">
                {sponsoredBills.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse font-sans text-sm">
                      <thead>
                        <tr className="border-b border-border text-left font-mono text-xs uppercase text-muted-foreground">
                          <th className="p-4">Bill ID</th>
                          <th className="p-4">Title</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Latest Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sponsoredBills.map((b, idx) => (
                          <tr key={idx} className="border-b border-border hover:bg-muted/40 transition-colors">
                            <td className="p-4 font-mono text-xs font-bold text-accent whitespace-nowrap">{b.bill_id}</td>
                            <td className="p-4 font-serif font-medium">{b.title}</td>
                            <td className="p-4 font-mono text-xs uppercase whitespace-nowrap">{b.status}</td>
                            <td className="p-4 text-xs text-muted-foreground">{b.latest_action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-border bg-muted/20 p-6">
                    <div className="font-serif text-lg font-semibold text-foreground">No sponsor links loaded for the 119th Congress</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">This is a Congress.gov linkage coverage gap, not evidence that this member sponsored no legislation. The page does not infer sponsorship from titles or names.</p>
                  </div>
                )}
              </ArchivePanel>

              <ArchivePanel title="Cosponsored Legislation" kicker="Co-Sponsor">
                {cosponsoredBills.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse font-sans text-sm">
                      <thead>
                        <tr className="border-b border-border text-left font-mono text-xs uppercase text-muted-foreground">
                          <th className="p-4">Bill ID</th>
                          <th className="p-4">Title</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Latest Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cosponsoredBills.map((b, idx) => (
                          <tr key={idx} className="border-b border-border hover:bg-muted/40 transition-colors">
                            <td className="p-4 font-mono text-xs font-bold text-accent whitespace-nowrap">{b.bill_id}</td>
                            <td className="p-4 font-serif font-medium">{b.title}</td>
                            <td className="p-4 font-mono text-xs uppercase whitespace-nowrap">{b.status}</td>
                            <td className="p-4 text-xs text-muted-foreground">{b.latest_action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-border bg-muted/20 p-6">
                    <div className="font-serif text-lg font-semibold text-foreground">No cosponsor links loaded for the 119th Congress</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Cosponsorship is shown only when the canonical bill-to-member relation is present. Missing ingestion is reported as unavailable rather than a factual zero.</p>
                  </div>
                )}
              </ArchivePanel>
            </div>
          )}

          {activeTab === 'trades' && (
            <ArchivePanel title="Recent Stock Trades" kicker="Canonical disclosure records">
              {legislator.recentTrades.length > 0 ? (
                <div>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Showing {legislator.tradeCoverage.offset + 1}–{legislator.tradeCoverage.offset + legislator.recentTrades.length} of {legislator.tradeCoverage.total} linked canonical disclosure transactions.
                    {legislator.tradeCoverage.excludedDateAnomalies > 0
                      ? ` ${legislator.tradeCoverage.excludedDateAnomalies} record(s) with implausible source dates are excluded from this chronology.`
                      : ""}
                  </p>
                  <p className="mb-4 border-l-2 border-accent/60 pl-3 text-xs leading-5 text-muted-foreground">
                    Committee-overlap flags are a screening aid based on disclosed assets and committee jurisdiction. A missing flag is not proof that no conflict exists.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse font-sans text-sm">
                      <thead>
                        <tr className="border-b border-border text-left font-mono text-xs uppercase text-muted-foreground">
                          <th className="p-4">Ticker</th>
                          <th className="p-4">Asset Description</th>
                          <th className="p-4">Type</th>
                          <th className="p-4">Amount / Value</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Committee Oversight Conflict</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legislator.recentTrades.map((t) => {
                          const conflict = tradeConflictEvidence(t)
                          return (
                            <tr key={t.trade_id} className="border-b border-border hover:bg-muted/40 transition-colors">
                              <td className="p-4 font-mono font-bold text-foreground">{t.ticker || "N/A"}</td>
                              <td className="p-4 font-serif">{t.asset_name || "Asset"}</td>
                              <td className="p-4 font-mono text-xs font-bold uppercase">{t.tx_type}</td>
                              <td className="p-4 font-mono text-xs">{formatAmountRange(t.amount_min, t.amount_max)}</td>
                              <td className="p-4 font-mono text-xs text-muted-foreground">{t.transaction_date || t.disclosure_date || "N/A"}</td>
                              <td className="p-4">
                                <span className={`inline-flex px-2.5 py-1 text-xs font-mono border rounded-sm ${conflict.flagged ? "border-accent/60 bg-accent/10 text-accent" : "border-border bg-muted text-muted-foreground"}`}>
                                  {conflict.label}
                                </span>
                                {conflict.detail ? <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">{conflict.detail}</p> : null}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => loadTradePage(legislator.tradeCoverage.offset - 100)}
                      disabled={legislator.tradeCoverage.offset === 0 || (tradePageState.memberId === legislator.bioguide_id && tradePageState.status === "loading")}
                      className="border border-border bg-card px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => loadTradePage(legislator.tradeCoverage.offset + 100)}
                      disabled={!legislator.tradeCoverage.hasMore || (tradePageState.memberId === legislator.bioguide_id && tradePageState.status === "loading")}
                      className="border border-border bg-card px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tradePageState.memberId === legislator.bioguide_id && tradePageState.status === "loading"
                        ? "Loading page…"
                        : "Next"}
                    </button>
                    <span className="font-mono text-xs text-muted-foreground">
                      Page {Math.floor(legislator.tradeCoverage.offset / 100) + 1} of {Math.ceil(legislator.tradeCoverage.total / 100)}
                    </span>
                  </div>
                  {tradePageState.memberId === legislator.bioguide_id && tradePageState.status === "error" ? (
                    <div role="alert" className="mt-3 border-l-2 border-destructive pl-3 text-sm text-destructive">
                      {tradePageState.error} <button type="button" onClick={() => loadTradePage(tradePageState.offset)} className="font-semibold underline">Retry</button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                  {legislator.tradeCoverage.message}
                </div>
              )}
            </ArchivePanel>
          )}

          {activeTab === 'connections' && (
            <ArchivePanel title="Evidence-backed connections" kicker="Canonical relationship records">
              {relationships.length > 0 ? (
                <div className="space-y-3">
                  {relationships.map((relationship) => (
                    <div key={relationship.relationship_id} className="border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="archive-panel-kicker">{humanizeRelationshipType(relationship.relation_type)}</div>
                          <div className="mt-1 font-serif text-lg font-semibold">
                            {relationship.object_key.startsWith("committee:")
                              ? (legislator.committees?.find((committee) => typeof committee !== "string" && committee.committee_id === relationship.object_key.replace("committee:", "")) as Exclude<NonNullable<Legislator["committees"]>[number], string> | undefined)?.name || relationship.object_key.replace("committee:", "Committee ")
                              : relationship.object_key.replace(/^[^:]+:/, "")}
                          </div>
                        </div>
                        <span className="archive-chip">{relationship.evidence_tier} evidence</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Verified from {relationship.source_url ? "the linked public source" : relationship.source_record_id ? `source record ${relationship.source_record_id}` : relationship.source}. Confidence: {relationship.confidence}.
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No evidence-backed relationship records are available for this member yet. Missing records are not evidence of no relationship.</p>
              )}
            </ArchivePanel>
          )}

          {activeTab === 'disclosures' && (
            <ArchivePanel title="Official financial disclosures" kicker="Range-aware source records">
              {disclosures?.documents.length ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {disclosures.documents.length} official filing documents, {disclosures.holdings.length} holdings, and {disclosures.transactions.length} transactions are loaded.
                  </p>
                  <div className="space-y-2">
                    {disclosures.documents.map((document) => (
                      <a key={document.document_id} href={document.source_url} target="_blank" rel="noreferrer" className="block border border-border p-4 hover:bg-muted/40">
                        <div className="flex flex-wrap justify-between gap-2 text-sm font-medium">
                          <span>{document.chamber} {document.report_type}</span>
                          <span className="text-muted-foreground">{document.parse_status}</span>
                        </div>
                        <span className="mt-1 block text-xs text-muted-foreground">{document.filing_date || "Filing date unavailable"} · {document.source}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No official disclosure documents are loaded for this member yet. This is an ingestion gap, not evidence that no holdings or transactions exist.</p>
              )}
            </ArchivePanel>
          )}

          {activeTab === 'biography' && (
            <div className="space-y-8">
              {legislator.biography_full && (
                <ArchivePanel title="About" kicker="Wikipedia">
                  <p className="font-serif text-base leading-relaxed text-foreground">
                    {legislator.biography_full}
                  </p>
                </ArchivePanel>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ArchivePanel title="Personal Profile" kicker="Biographical Information">
                <p className="mb-5 text-xs leading-5 text-muted-foreground">Official and maintained public member records. Unavailable fields are left explicit and are not inferred from biography prose.</p>
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted-foreground">Birthday</span>
                    <span className="font-bold text-foreground">
                      {legislator.birthday || "Not listed"} {legislator.age != null ? `(Age ${legislator.age})` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted-foreground">Birthplace / Hometown</span>
                    <span className="font-bold text-foreground">
                      {legislator.birthplace || legislator.hometown || "Unavailable in loaded sources"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted-foreground">Office Address</span>
                    <span className="font-bold text-foreground text-right max-w-[240px]">
                      {legislator.office_address || "Unavailable in loaded sources"}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-bold text-foreground">{legislator.phone || "Unavailable in loaded sources"}</span>
                  </div>
                </div>
              </ArchivePanel>

              <ArchivePanel title="External Identifiers" kicker="Crosswalk IDs">
                {legislator.identifiers && Object.keys(legislator.identifiers).length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                    {Object.entries(legislator.identifiers).map(([scheme, vals]) => {
                      const values = Array.isArray(vals) ? vals : [String(vals)]
                      const href = externalIdentifierUrl(scheme, values[0])
                      const content = <>
                        <div className="text-muted-foreground uppercase mb-1">{scheme}</div>
                        <div className="font-bold text-foreground truncate">{values.join(", ")}</div>
                      </>
                      return href ? (
                        <a key={scheme} href={href} target="_blank" rel="noreferrer" className="p-3 border border-border bg-muted/30 transition-colors hover:border-accent hover:bg-accent/5" aria-label={`Open ${scheme} source record`}>
                          {content}
                        </a>
                      ) : <div key={scheme} className="p-3 border border-border bg-muted/30">{content}</div>
                    })}
                  </div>
                ) : (
                  <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                    No external crosswalk identifiers registered.
                  </div>
                )}
              </ArchivePanel>

              <ArchivePanel title="Education" kicker="Academic Background">
                {Array.isArray(legislator.education) && legislator.education.length > 0 ? (
                  <ul className="space-y-3 font-serif text-base">
                    {legislator.education.map((edu, idx) => (
                      <li key={idx} className="p-3 border border-border bg-muted/20">
                        {typeof edu === 'string' ? edu : JSON.stringify(edu)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                    Education is unavailable in the loaded official and maintained member sources. No biography text has been converted into a structured claim.
                  </div>
                )}
              </ArchivePanel>

              <ArchivePanel title="Prior Employment" kicker="Professional Background">
                {Array.isArray(legislator.prior_employment) && legislator.prior_employment.length > 0 ? (
                  <ul className="space-y-3 font-serif text-base">
                    {legislator.prior_employment.map((emp, idx) => (
                      <li key={idx} className="p-3 border border-border bg-muted/20">
                        {typeof emp === 'string' ? emp : JSON.stringify(emp)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                    Prior employment is unavailable in the loaded official and maintained member sources. No biography text has been converted into a structured claim.
                  </div>
                )}
              </ArchivePanel>
            </div>
            </div>
          )}
        </div>
      </div>
    </ArchivePage>
  )
}
