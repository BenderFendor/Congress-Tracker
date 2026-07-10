"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
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
import { ProvenanceSummary } from "@/lib/services/provenance"
import { getMemberVotes, Vote } from "@/lib/services/voting"
import { formatAmountRange } from "@/lib/services/stocks"
import { ArchivePage, ArchivePanel } from "@/components/ui/archive-ui"
import { getMemberDisclosures, getRelationships, MemberDisclosures, RelationshipEvidence } from "@/lib/services/relationships"

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

export default function LegislatorProfilePage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState("overview")
  const [legislator, setLegislator] = useState<Legislator | null>(null)
  const [funding, setFunding] = useState<MemberFunding | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [sponsoredBills, setSponsoredBills] = useState<BillRow[]>([])
  const [cosponsoredBills, setCosponsoredBills] = useState<BillRow[]>([])
  const [relationships, setRelationships] = useState<RelationshipEvidence[]>([])
  const [disclosures, setDisclosures] = useState<MemberDisclosures | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const leg = await getLegislator(params.id)
        setLegislator(leg)

        if (leg) {
          const bioguideId = leg.bioguide_id || leg.id
          
          // Background fetch funding
          getMemberFunding(bioguideId).then(setFunding).catch(console.error)

          // Background fetch votes
          getMemberVotes(bioguideId).then(setVotes).catch(console.error)

          getMemberLegislation(bioguideId).then(data => {
            setSponsoredBills(data.sponsor.map(mapLegislationToBill))
            setCosponsoredBills(data.cosponsor.map(mapLegislationToBill))
          }).catch(console.error)

          getRelationships({ subjectKey: `member:${bioguideId}`, limit: 25 })
            .then(data => setRelationships(data.relationships))
            .catch(console.error)

          getMemberDisclosures(bioguideId)
            .then(setDisclosures)
            .catch(console.error)
        }
      } catch (error) {
        console.error("Failed to load legislator data", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
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

  const partyName = legislator.party === "D" || legislator.party === "Democrat" ? "Democrat" 
    : legislator.party === "R" || legislator.party === "Republican" ? "Republican" : "Independent";
    
  const partyBadgeClass = partyName === "Democrat" ? "bg-blue-600 text-white" : partyName === "Republican" ? "bg-red-600 text-white" : "bg-gray-600 text-white";

  const hasFecRun = funding?.has_successful_fec_run ?? (
    funding !== null &&
    funding.data_quality !== "missing_crosswalk" &&
    !funding.provenance?.warnings?.includes("no_fec_data") &&
    (funding.total_receipts > 0 || funding.pac_contributions > 0 || (funding.top_contributors?.length ?? 0) > 0 || funding.provenance?.sources?.some(s => s.source === "openfec" && s.status === "success"))
  )

  const aipacNetwork = funding?.influence_networks?.find(n => n.network_slug.toLowerCase() === "aipac")

  // Vote percentages calculation
  let missedVotePct = legislator.vote_summary?.missed_vote_pct
  if (missedVotePct === undefined || missedVotePct === null) {
    if (votes.length > 0) {
      const missed = votes.filter(v => v.position === "Not Voting" || v.position === "Not Present").length
      missedVotePct = (missed / votes.length) * 100
    }
  }

  const partyLinePct = legislator.vote_summary?.party_line_pct

  const recentVotesList = (legislator.vote_summary?.recent_votes && legislator.vote_summary.recent_votes.length > 0)
    ? legislator.vote_summary.recent_votes.map(v => ({
        vote_id: v.vote_id,
        date: v.vote_date || "Unknown date",
        question: v.question,
        position: v.position
      }))
    : votes.map(v => ({
        vote_id: v.bill?.number || "Roll Call",
        date: v.date || "Unknown date",
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
              {(legislator.depiction_url || legislator.avatar || legislator.id) ? (
                <Image src={legislator.depiction_url || legislator.avatar || `https://bioguide.congress.gov/bioguide/photo/${legislator.id[0]}/${legislator.id}.jpg`} alt={legislator.name} width={320} height={320} unoptimized className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Users size={40} />
                </div>
              )}
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
                {legislator.bio || "Member of the United States Congress."}
              </p>
            </div>

            <ProvenanceBadge provenance={legislator.provenance} />
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-border mb-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'donations', label: 'Funding' },
            { id: 'voting', label: 'Votes' },
            { id: 'bills', label: 'Bills' },
            { id: 'trades', label: 'Trades' },
            { id: 'connections', label: 'Connections' },
            { id: 'disclosures', label: 'Disclosures' },
            { id: 'biography', label: 'Biography' }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
        <div className="min-h-[400px]">
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
                      {legislator.years_in_office != null ? `${Number(legislator.years_in_office).toFixed(1)} years` : "N/A"}
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
              {!hasFecRun ? (
                <div className="bg-card border border-amber-500/50 p-6 flex items-start gap-4">
                  <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={24} />
                  <div>
                    <h3 className="font-serif font-bold text-lg text-foreground mb-1">FEC Transaction Notice</h3>
                    <p className="font-sans text-sm text-muted-foreground">
                      No FEC transactions loaded for this member. Run the FEC ingest for this cycle.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-card border border-border p-6 text-center">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Total Receipts</div>
                    <div className="text-3xl font-serif font-bold text-foreground">
                      ${(funding?.total_receipts || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-card border border-border p-6 text-center">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">PAC Receipts</div>
                    <div className="text-3xl font-serif font-bold text-foreground">
                      ${(funding?.pac_contributions || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-card border border-border p-6 text-center">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Individual Receipts</div>
                    <div className="text-3xl font-serif font-bold text-foreground">
                      ${(funding?.individual_contributions || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {aipacNetwork && (
                <ArchivePanel title="AIPAC / Pro-Israel Network Tracing" kicker="Verified Political Expenditures">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    <div className="p-5 bg-muted/40 border border-border">
                      <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Direct PAC contributions</div>
                      <div className="text-2xl font-serif font-bold text-foreground">
                        {!hasFecRun ? "Unavailable" : `$${(aipacNetwork.direct_pac_amount || 0).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="p-5 bg-muted/40 border border-border">
                      <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Independent expenditures supporting</div>
                      <div className="text-2xl font-serif font-bold text-green-600 dark:text-green-400">
                        {!hasFecRun ? "Unavailable" : `$${(aipacNetwork.independent_expenditure_support_amount || 0).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="p-5 bg-muted/40 border border-border">
                      <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Independent expenditures opposing</div>
                      <div className="text-2xl font-serif font-bold text-red-600 dark:text-red-400">
                        {!hasFecRun ? "Unavailable" : `$${(aipacNetwork.independent_expenditure_oppose_amount || 0).toLocaleString()}`}
                      </div>
                    </div>
                  </div>
                </ArchivePanel>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ArchivePanel title="Top Donors" kicker="Receipt Breakdown">
                  {hasFecRun && (funding?.top_contributors?.length ?? 0) > 0 ? (
                    <div className="space-y-4">
                      {funding?.top_contributors.map((donor, idx) => (
                        <div key={idx} className="flex justify-between items-center p-4 border border-border bg-muted/30">
                          <div>
                            <div className="font-serif font-bold text-foreground">{donor.name}</div>
                            <div className="text-xs font-mono text-muted-foreground uppercase mt-0.5">
                              PAC: ${(donor.pac_contributions || 0).toLocaleString()} | Indiv: ${(donor.individual_contributions || 0).toLocaleString()}
                            </div>
                          </div>
                          <div className="font-mono font-bold text-base text-foreground">
                            ${(donor.total || 0).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                      {!hasFecRun ? "No FEC transactions loaded for this member." : "No top donors identified."}
                    </div>
                  )}
                </ArchivePanel>

                <ArchivePanel title="Top Committees" kicker="PAC & Committee Transfers">
                  {hasFecRun && (funding?.top_committees?.length ?? 0) > 0 ? (
                    <div className="space-y-4">
                      {funding?.top_committees.map((comm, idx) => (
                        <div key={idx} className="flex justify-between items-center p-4 border border-border bg-muted/30">
                          <div>
                            <div className="font-serif font-bold text-foreground">{comm.name}</div>
                            <div className="text-xs font-mono text-muted-foreground uppercase mt-0.5">
                              ID: {comm.committee_id} | Transactions: {comm.transaction_count}
                            </div>
                          </div>
                          <div className="font-mono font-bold text-base text-foreground">
                            ${(comm.total || 0).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                      {!hasFecRun ? "No FEC transactions loaded for this member." : "No top committee transfers identified."}
                    </div>
                  )}
                </ArchivePanel>
              </div>
            </div>
          )}

          {activeTab === 'voting' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ArchivePanel title="Missed-Vote Rate" kicker="Attendance">
                  <div className="text-3xl font-serif font-bold text-foreground">
                    {missedVotePct != null ? `${Number(missedVotePct).toFixed(1)}%` : "N/A"}
                  </div>
                </ArchivePanel>
                <ArchivePanel title="Party-Line Alignment" kicker="Ideological Consistency">
                  <div className="text-3xl font-serif font-bold text-foreground">
                    {partyLinePct != null ? `${Number(partyLinePct).toFixed(1)}%` : "N/A"}
                  </div>
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
                          <th className="p-4">Question</th>
                          <th className="p-4 text-right">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentVotesList.map((v, idx) => (
                          <tr key={idx} className="border-b border-border hover:bg-muted/40 transition-colors">
                            <td className="p-4 font-mono text-xs font-bold text-accent">{v.vote_id}</td>
                            <td className="p-4 font-mono text-xs text-muted-foreground whitespace-nowrap">{v.date}</td>
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
                  <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                    No sponsored legislation loaded.
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
                  <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                    No cosponsored legislation loaded.
                  </div>
                )}
              </ArchivePanel>
            </div>
          )}

          {activeTab === 'trades' && (
            <ArchivePanel title="Recent Stock Trades" kicker="Canonical disclosure records">
              {legislator.recentTrades.length > 0 ? (
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
                      {legislator.recentTrades.map((t, idx) => (
                            <tr key={idx} className="border-b border-border hover:bg-muted/40 transition-colors">
                              <td className="p-4 font-mono font-bold text-foreground">{t.ticker || "N/A"}</td>
                              <td className="p-4 font-serif">{t.asset_name || "Asset"}</td>
                              <td className="p-4 font-mono text-xs font-bold uppercase">{t.tx_type}</td>
                              <td className="p-4 font-mono text-xs">{formatAmountRange(t.amount_min, t.amount_max)}</td>
                              <td className="p-4 font-mono text-xs text-muted-foreground">{t.transaction_date || t.disclosure_date || "N/A"}</td>
                              <td className="p-4">
                                <span className="px-2.5 py-1 text-xs font-mono bg-muted text-muted-foreground border border-border rounded-sm">
                                  Standard Filing
                                </span>
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-muted-foreground font-mono italic p-6 text-center border border-border">
                  No stock disclosures found for this member.
                </div>
              )}
            </ArchivePanel>
          )}

          {activeTab === 'connections' && (
            <ArchivePanel title="Evidence-backed connections" kicker="Canonical relationship records">
              {relationships.length > 0 ? (
                <div className="space-y-3">
                  {relationships.map((relationship) => (
                    <div key={relationship.evidence_id} className="border border-border p-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span>{relationship.relation_type}</span>
                        <span className="text-muted-foreground">{relationship.object_key}</span>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{relationship.evidence_tier}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Confidence: {relationship.confidence}. Source: {relationship.source_url || relationship.source_record_id || "recorded source"}.
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ArchivePanel title="Personal Profile" kicker="Biographical Information">
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
                      {legislator.birthplace || legislator.hometown || "Not listed"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted-foreground">Office Address</span>
                    <span className="font-bold text-foreground text-right max-w-[240px]">
                      {legislator.office_address || "Capitol Building, Washington D.C."}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-bold text-foreground">{legislator.phone || "Not listed"}</span>
                  </div>
                </div>
              </ArchivePanel>

              <ArchivePanel title="External Identifiers" kicker="Crosswalk IDs">
                {legislator.identifiers && Object.keys(legislator.identifiers).length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                    {Object.entries(legislator.identifiers).map(([scheme, vals]) => (
                      <div key={scheme} className="p-3 border border-border bg-muted/30">
                        <div className="text-muted-foreground uppercase mb-1">{scheme}</div>
                        <div className="font-bold text-foreground truncate">{Array.isArray(vals) ? vals.join(", ") : String(vals)}</div>
                      </div>
                    ))}
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
                    No education records listed.
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
                    No prior professional employment listed.
                  </div>
                )}
              </ArchivePanel>
            </div>
          )}
        </div>
      </div>
    </ArchivePage>
  )
}
