"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, MapPin, DollarSign, FileText, Users, TrendingUp, ExternalLink, Grid, Calendar, Shield, PieChart, AlertTriangle } from "lucide-react"
import { getLegislator, Legislator } from "@/lib/services/legislators"
import { getMemberVotes, Vote } from "@/lib/services/voting"
import { getEnrichedMember, EnrichedTrade, FilerMetrics } from "@/lib/services/enrichment"

export default function LegislatorProfilePage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState("overview")
  const [legislator, setLegislator] = useState<Legislator | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [enriched, setEnriched] = useState<{
    metrics: FilerMetrics;
    trades: EnrichedTrade[];
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [legData, votesData, enrichedData] = await Promise.all([
          getLegislator(params.id),
          getMemberVotes(params.id),
          getEnrichedMember(params.id),
        ])
        setLegislator(legData)
        setVotes(votesData)
        if (enrichedData) setEnriched(enrichedData)
      } catch (error) {
        console.error("Failed to load legislator data", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [params.id])

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  if (!legislator) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-8">
      <div className="bg-card border border-border p-8 max-w-md text-center shadow-sm">
        <h3 className="font-serif text-2xl font-bold text-primary mb-4">Data Unavailable</h3>
        <p className="font-sans text-sm text-muted-foreground mb-4">
          This legislator's detailed profile could not be loaded.
        </p>
        <p className="font-mono text-xs text-muted-foreground bg-muted p-3 mb-6 text-left">
          The most common cause is an invalid or expired Congress.gov API key.
          <br /><br />
          <strong>Fix:</strong> Get a free key at{' '}
          <a href="https://api.congress.gov/sign-up" target="_blank" rel="noopener noreferrer" className="text-accent underline">
            api.congress.gov/sign-up
          </a>
          {' '}and set <code className="bg-background px-1">CONGRESS_GOV_API_KEY</code> in <code className="bg-background px-1">.env</code>.
          Then restart the backend.
        </p>
        <Link href="/legislators" className="inline-flex items-center gap-2 px-6 py-3 bg-muted border border-border hover:bg-accent hover:text-accent-foreground transition-all font-sans text-xs font-semibold tracking-wide">
          <ArrowLeft size={14} /> Back to Directory
        </Link>
      </div>
    </div>
  )

  // Helper to get party colors
  const getPartyColor = (party: string) => {
    if (party === "D" || party === "Democrat") return "text-blue-400 bg-blue-900/20 border-blue-500/30"
    if (party === "R" || party === "Republican") return "text-red-400 bg-red-900/20 border-red-500/30"
    return "text-muted-foreground bg-gray-900/20 border-gray-500/30"
  }

  const partyColorClass = getPartyColor(legislator.party)
  const partyName = legislator.party
  const tradeStats = legislator.trade_summary?.stats

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent text-accent-foreground selection:text-foreground pb-20">

      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">

        {/* Back Button */}
        <Link href="/legislators" className="inline-flex items-center gap-2 text-muted-foreground hover:text-accent font-sans text-xs text-muted-foreground tracking-wide mb-8 transition-colors">
          <ArrowLeft size={14} />
          Back to Directory
        </Link>

        {/* Profile Header */}
        <div className="bg-card border-2 border-border p-8 md:p-12 mb-12 animate-stagger-item delay-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent text-accent-foreground/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

          <div className="flex flex-col md:flex-row items-start gap-8 md:gap-12 relative z-10">
            <div className="relative">
              <div className="w-32 h-32 md:w-40 md:h-40 bg-background border-2 border-border overflow-hidden grayscale contrast-125 group-hover:grayscale-0 transition-all duration-500">
                {legislator.avatar ? (
                  <img src={legislator.avatar} alt={legislator.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                    <Users size={40} />
                  </div>
                )}
              </div>
              <div className={`absolute -bottom-3 -right-3 px-3 py-1 border ${partyColorClass} font-mono text-xs font-bold uppercase tracking-wider backdrop-blur-md`}>
                {partyName}
              </div>
            </div>

            <div className="flex-1 w-full">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div>
                  <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4 leading-none tracking-tight">
                    {legislator.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 text-muted-foreground font-mono text-sm uppercase tracking-wide">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-accent" />
                      <span>{legislator.state}{legislator.district ? `-${legislator.district}` : ""}</span>
                    </div>
                    <span className="text-foreground/20">|</span>
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-accent" />
                      <span>{legislator.chamber}</span>
                    </div>
                  </div>
                </div>

                <a
                  href={legislator.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-muted border border-border hover:bg-accent hover:text-accent-foreground hover:text-black hover:border-accent transition-all font-sans text-xs font-semibold tracking-wide"
                >
                  Official Site
                  <ExternalLink size={14} />
                </a>
              </div>

              <p className="font-serif text-lg text-gray-300 leading-relaxed max-w-3xl mb-8 border-l-2 border-border pl-6">
                {legislator.bio || "No biography available."}
              </p>

              {legislator.trade_summary && (
                <div className="mb-6 inline-flex items-center gap-2 px-3 py-2 border border-border bg-muted text-xs font-mono uppercase tracking-wide text-muted-foreground">
                  CapitolTrades match: {legislator.trade_summary.match_confidence.replaceAll("_", " ")}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {legislator.committees.map((committee, index) => (
                  <div key={index} className="px-3 py-1 bg-muted border border-border text-xs font-mono text-muted-foreground uppercase">
                    {committee}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 animate-stagger-item delay-2">
          <div className="bg-card border-2 border-border p-6 hover:border-accent/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-muted-foreground group-hover:text-accent transition-colors">
              <DollarSign size={20} />
              <span className="font-sans text-xs font-semibold tracking-wide">Trade Volume</span>
            </div>
            <div className="text-3xl font-serif font-bold text-foreground mb-1">
              {tradeStats ? `$${(tradeStats.volume / 1000000).toFixed(1)}M` : "N/A"}
            </div>
            <div className="text-xs font-mono text-muted-foreground uppercase">CapitolTrades Matched</div>
          </div>

          <div className="bg-card border-2 border-border p-6 hover:border-accent/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-muted-foreground group-hover:text-accent transition-colors">
              <FileText size={20} />
              <span className="font-sans text-xs font-semibold tracking-wide">Bills Sponsored</span>
            </div>
            <div className="text-3xl font-serif font-bold text-foreground mb-1">
              {legislator.billsSponsored}
            </div>
            <div className="text-xs font-mono text-muted-foreground uppercase">This Session</div>
          </div>

          <div className="bg-card border-2 border-border p-6 hover:border-accent/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-muted-foreground group-hover:text-accent transition-colors">
              <Users size={20} />
              <span className="font-sans text-xs font-semibold tracking-wide">Trade Count</span>
            </div>
            <div className="text-3xl font-serif font-bold text-foreground mb-1">
              {tradeStats?.count_trades || 0}
            </div>
            <div className="text-xs font-mono text-muted-foreground uppercase">Transactions Reported</div>
          </div>

          <div className="bg-card border-2 border-border p-6 hover:border-accent/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-muted-foreground group-hover:text-accent transition-colors">
              <TrendingUp size={20} />
              <span className="font-sans text-xs font-semibold tracking-wide">Issuers Traded</span>
            </div>
            <div className="text-3xl font-serif font-bold text-foreground mb-1">
              {tradeStats?.count_issuers || 0}
            </div>
            <div className="text-xs font-mono text-muted-foreground uppercase">Distinct Holdings</div>
          </div>
        </div>

        {/* Tabs & Content */}
        <div className="animate-stagger-item delay-3">
          <div className="flex border-b-2 border-border mb-8 overflow-x-auto">
            {['overview', 'donations', 'trades', 'bills', 'voting'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-4 font-sans text-sm font-semibold tracking-wide transition-all relative ${activeTab === tab
                  ? 'text-accent'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {tab === 'donations' ? 'Campaign Finance' : tab === 'trades' ? 'Stock Trades' : tab === 'bills' ? 'Legislation' : tab === 'voting' ? 'Voting Record' : 'Overview'}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent text-accent-foreground"></div>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-[400px]">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-card border-2 border-border p-8">
                  <h3 className="font-mono text-xs font-bold text-accent uppercase mb-6 flex items-center gap-2">
                    <DollarSign size={16} /> Recent Stock Activity
                  </h3>
                  <div className="space-y-4">
                    {legislator.recentTrades.length > 0 ? (
                      legislator.recentTrades.slice(0, 3).map((trade, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-muted border border-white/5 hover:border-border transition-colors">
                          <div>
                            <div className="font-serif font-bold text-foreground">{trade.ticker}</div>
                            <div className="text-xs font-mono text-muted-foreground uppercase">{trade.asset_description}</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-mono font-bold ${trade.type.toLowerCase().includes('buy') ? 'text-green-400' : 'text-red-400'}`}>
                              {trade.type.toUpperCase()}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground">{trade.transaction_date}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground font-mono text-sm italic">No recent trades found</div>
                    )}
                  </div>
                </div>

                <div className="bg-card border-2 border-border p-8">
                  <h3 className="font-mono text-xs font-bold text-accent uppercase mb-6 flex items-center gap-2">
                    <FileText size={16} /> Recent Activity
                  </h3>
                  <div className="space-y-4">
                    {legislator.recentBills.length > 0 ? (
                      legislator.recentBills.map((bill, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-muted border border-white/5 hover:border-border transition-colors">
                          <div className="flex-1 mr-4">
                            <div className="font-serif font-bold text-foreground truncate">{bill.title}</div>
                            <div className="text-xs font-mono text-muted-foreground uppercase">{bill.date}</div>
                          </div>
                          <div className="px-2 py-1 bg-muted/50 text-[10px] font-mono font-bold uppercase text-gray-300">
                            {bill.status}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground font-mono text-sm italic">No recent bills available</div>
                    )}
                  </div>
                </div>

                {enriched && enriched.trades.length > 0 && (
                  <>
                    <div className="bg-card border-2 border-border p-8">
                      <h3 className="font-mono text-xs font-bold text-accent uppercase mb-6 flex items-center gap-2">
                        <AlertTriangle size={16} />
                        Committee Trade Conflicts
                        {enriched.metrics.conflict_count > 0 && (
                          <span className="px-2 py-0.5 bg-red-900/30 border border-red-500/30 text-red-400 text-[10px]">
                            {enriched.metrics.conflict_count} flags
                          </span>
                        )}
                      </h3>
                      {enriched.metrics.committees.length > 0 ? (
                        <div className="space-y-3">
                          <div className="text-xs font-mono text-muted-foreground uppercase mb-3">
                            Committees: {enriched.metrics.committees.join(" • ")}
                          </div>
                          {(() => {
                            const conflicts = enriched.trades
                              .filter(t => t.committee_conflicts.length > 0)
                              .flatMap(t => t.committee_conflicts);
                            if (conflicts.length === 0) return (
                              <div className="text-muted-foreground font-mono text-sm italic">
                                No committee conflicts detected across {enriched.trades.length} disclosed trades.
                              </div>
                            );
                            return conflicts.map((conflict, idx) => (
                              <div key={idx} className="flex items-start justify-between p-3 bg-muted border border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
                                <div className="flex-1">
                                  <span className="font-mono font-bold text-yellow-400">{conflict.ticker}</span>
                                  <span className="ml-2 text-xs font-mono text-muted-foreground uppercase">
                                    {conflict.sector} / {conflict.industry}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className={`text-xs font-mono font-bold uppercase ${
                                    conflict.severity === 'DIRECT OVERLAP' ? 'text-red-400' : 'text-yellow-400'
                                  }`}>
                                    {conflict.severity}
                                  </div>
                                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                                    {conflict.committee}
                                  </div>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      ) : (
                        <div className="text-muted-foreground font-mono text-sm italic">
                          No committee assignment data available.
                        </div>
                      )}
                    </div>

                    <div className="bg-card border-2 border-border p-8">
                      <h3 className="font-mono text-xs font-bold text-accent uppercase mb-6 flex items-center gap-2">
                        <PieChart size={16} /> Sector Allocation
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {(() => {
                          const sectorCounts: Record<string, number> = {};
                          enriched.trades.forEach(t => {
                            if (t.sector) {
                              sectorCounts[t.sector] = (sectorCounts[t.sector] || 0) + 1;
                            }
                          });
                          return Object.entries(sectorCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 8)
                            .map(([sector, count]) => {
                              const pct = ((count / enriched.trades.length) * 100).toFixed(0);
                              return (
                                <div key={sector} className="p-3 bg-muted border border-white/5">
                                  <div className="font-mono text-xs font-bold text-foreground">{sector}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1.5 bg-background">
                                      <div className="h-full bg-accent/60" style={{ width: `${Math.max(Number(pct), 2)}%` }} />
                                    </div>
                                    <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
                                  </div>
                                </div>
                              );
                            });
                        })()}
                      </div>
                    </div>

                    <div className="bg-card border-2 border-border p-8">
                      <h3 className="font-mono text-xs font-bold text-accent uppercase mb-6 flex items-center gap-2">
                        <TrendingUp size={16} /> Trade Metrics (Enriched)
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-serif font-bold text-foreground">{enriched.metrics.total_trades}</div>
                          <div className="text-[10px] font-mono text-muted-foreground uppercase mt-1">Total Trades</div>
                        </div>
                        <div>
                          <div className="text-2xl font-serif font-bold text-foreground">
                            ${(enriched.metrics.estimated_total_volume / 1_000_000).toFixed(1)}M
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground uppercase mt-1">Est. Volume</div>
                        </div>
                        <div>
                          <div className="text-2xl font-serif font-bold text-foreground">
                            {enriched.metrics.buy_sell_ratio.toFixed(1)}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground uppercase mt-1">Buy/Sell Ratio</div>
                        </div>
                        <div>
                          <div className="text-2xl font-serif font-bold text-foreground">
                            {enriched.metrics.late_filing_count > 0
                              ? `${enriched.metrics.late_filing_count}`
                              : '0'}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground uppercase mt-1">
                            Late Filings ({'>'}45d)
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'donations' && (
              <div className="bg-card border-2 border-border p-8">
                <h3 className="font-mono text-xs font-bold text-accent uppercase mb-8">Campaign Finance Breakdown</h3>
                <div className="space-y-4">
                  {legislator.topDonors.length > 0 ? (
                    legislator.topDonors.map((donor, index) => (
                      <div key={index} className="flex items-center justify-between p-6 bg-muted border border-white/5 hover:border-border transition-colors group">
                        <div>
                          <div className="font-serif text-xl font-bold text-foreground group-hover:text-accent transition-colors">{donor.name}</div>
                          <div className="text-xs font-mono text-muted-foreground uppercase mt-1">{donor.industry}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xl font-bold text-foreground">${(donor.amount / 1000).toFixed(0)}K</div>
                          <div className="text-xs font-mono text-muted-foreground uppercase mt-1">
                            {((donor.amount / (legislator.totalDonations || 1)) * 100).toFixed(1)}% of total
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground font-mono text-sm italic">No detailed donor data available</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'trades' && (
              <div className="bg-card border-2 border-border p-8">
                <h3 className="font-mono text-xs font-bold text-accent uppercase mb-8">Recent Stock Trades</h3>
                <div className="space-y-4">
                  {legislator.recentTrades.length > 0 ? (
                    legislator.recentTrades.map((trade, index) => (
                      <div key={index} className="p-6 bg-muted border border-white/5 hover:border-border transition-colors group">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <span className="font-serif text-xl font-bold text-foreground group-hover:text-accent transition-colors">{trade.ticker}</span>
                            <span className="ml-3 text-sm font-mono text-muted-foreground uppercase">{trade.asset_description}</span>
                          </div>
                          <div className={`px-4 py-2 font-mono text-sm font-bold border ${
                            trade.type.toLowerCase().includes('buy') 
                              ? 'text-green-400 border-green-500/30 bg-green-900/10' 
                              : 'text-red-400 border-red-500/30 bg-red-900/10'
                          }`}>
                            {trade.type.toUpperCase()}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Date</div>
                            <div className="font-mono text-sm">{trade.transaction_date}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Amount</div>
                            <div className="font-mono text-sm text-accent">{trade.amount}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Owner</div>
                            <div className="font-mono text-sm capitalize">{trade.owner}</div>
                          </div>
                          <div className="text-right">
                            {trade.ptr_link && (
                              <a href={trade.ptr_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-mono text-accent hover:underline uppercase">
                                Filing <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground font-mono text-sm italic">No trade data available</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'bills' && (
              <div className="bg-card border-2 border-border p-8">
                <h3 className="font-mono text-xs font-bold text-accent uppercase mb-8">Sponsored Legislation</h3>
                <div className="space-y-4">
                  {legislator.recentBills.length > 0 ? (
                    legislator.recentBills.map((bill, index) => (
                      <div key={index} className="p-6 bg-muted border border-white/5 hover:border-border transition-colors group">
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="font-serif text-lg font-bold text-foreground group-hover:text-accent transition-colors leading-tight max-w-3xl">
                            {bill.title}
                          </h4>
                          <div className="px-3 py-1 bg-muted/50 text-xs font-mono font-bold uppercase text-foreground">
                            {bill.status}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase">
                          <Calendar size={12} />
                          <span>Introduced: {bill.date}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground font-mono text-sm italic">No sponsored legislation data available</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'voting' && (
              <div className="bg-card border-2 border-border p-8">
                <h3 className="font-mono text-xs font-bold text-accent uppercase mb-8">Recent Voting Record</h3>
                <div className="space-y-4">
                  {votes.length > 0 ? (
                    votes.map((vote, index) => (
                      <div key={index} className="flex items-center justify-between p-6 bg-muted border border-white/5 hover:border-border transition-colors">
                        <div className="flex-1 mr-8">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-xs font-bold text-accent uppercase">{vote.bill.number}</span>
                            <span className="text-xs font-mono text-muted-foreground uppercase">{vote.date}</span>
                          </div>
                          <div className="font-serif font-bold text-foreground mb-1">{vote.bill.title || vote.description}</div>
                          <div className="text-xs font-mono text-muted-foreground uppercase">{vote.question}</div>
                        </div>
                        <div className={`px-4 py-2 font-sans text-sm font-semibold border ${vote.position === "Yes"
                          ? "text-green-400 border-green-500/30 bg-green-900/10"
                          : vote.position === "No"
                            ? "text-red-400 border-red-500/30 bg-red-900/10"
                            : "text-muted-foreground border-gray-500/30 bg-gray-900/10"
                          }`}>
                          {vote.position}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground font-mono text-sm italic">No voting record available</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
