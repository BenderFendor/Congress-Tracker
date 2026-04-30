"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, MapPin, Landmark, DollarSign, FileText, Users, TrendingUp, ExternalLink, Calendar } from "lucide-react"
import { getLegislator, Legislator } from "@/lib/services/legislators"
import { getMemberVotes, Vote } from "@/lib/services/voting"

export default function LegislatorProfilePage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState("overview")
  const [legislator, setLegislator] = useState<Legislator | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [legData, votesData] = await Promise.all([
          getLegislator(params.id),
          getMemberVotes(params.id),
        ])
        setLegislator(legData)
        setVotes(votesData)
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
          This legislator&apos;s detailed profile could not be loaded.
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

  const partyName = legislator.party === "D" || legislator.party === "Democrat" ? "Democrat" 
    : legislator.party === "R" || legislator.party === "Republican" ? "Republican" : "Independent";
    
  const partyBadgeClass = partyName === "Democrat" ? "bg-blue-600" : partyName === "Republican" ? "bg-red-600" : "bg-gray-600";

  const tradeStats = legislator.trade_summary?.stats;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent text-accent-foreground selection:text-foreground pb-20">
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 pt-12">
        {/* Top Navigation */}
        <Link href="/legislators" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-sans text-sm tracking-wide mb-6 transition-colors">
          <ArrowLeft size={16} />
          Back to Directory
        </Link>

        {/* Hero Card */}
        <div className="bg-gradient-to-r from-card to-accent/10 border border-border p-8 md:p-10 mb-8 relative flex flex-col md:flex-row gap-8 items-start">
          <div className="relative shrink-0">
            <div className="w-32 h-32 md:w-40 md:h-40 border border-border bg-muted">
              {legislator.avatar ? (
                <img src={legislator.avatar} alt={legislator.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Users size={40} />
                </div>
              )}
            </div>
            <div className={`absolute -bottom-3 -right-3 px-4 py-1 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-sm ${partyBadgeClass}`}>
              {partyName}
            </div>
          </div>

          <div className="flex-1 w-full">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-2">
                  {legislator.name}
                </h1>
                <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm uppercase tracking-wide">
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
              
              <a
                href={legislator.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-card border border-border hover:bg-muted text-foreground transition-colors font-sans text-sm font-medium rounded-sm shadow-sm shrink-0"
              >
                Official Site
                <ExternalLink size={16} />
              </a>
            </div>

            <div className="flex gap-5 mt-6">
              <div className="w-1 shrink-0 bg-border"></div>
              <p className="font-serif text-lg text-muted-foreground leading-relaxed max-w-3xl">
                {legislator.bio || "No biography available."}
              </p>
            </div>
          </div>
        </div>

        {/* Key Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-card border border-border p-6 flex flex-col items-center text-center">
            <div className="flex flex-col items-center gap-2 mb-3 text-muted-foreground">
              <DollarSign size={20} />
              <span className="font-sans text-sm font-medium">Trade Volume</span>
            </div>
            <div className="text-4xl font-serif font-bold text-foreground mb-3">
              {tradeStats && tradeStats.volume > 0 ? `$${(tradeStats.volume / 1000000).toFixed(1)}M` : "N/A"}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">CapitolTrades Matched</div>
          </div>

          <div className="bg-card border border-border p-6 flex flex-col items-center text-center">
            <div className="flex flex-col items-center gap-2 mb-3 text-muted-foreground">
              <FileText size={20} />
              <span className="font-sans text-sm font-medium">Bills Sponsored</span>
            </div>
            <div className="text-4xl font-serif font-bold text-foreground mb-3">
              {legislator.billsSponsored}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">This Session</div>
          </div>

          <div className="bg-card border border-border p-6 flex flex-col items-center text-center">
            <div className="flex flex-col items-center gap-2 mb-3 text-muted-foreground">
              <Users size={20} />
              <span className="font-sans text-sm font-medium">Trade Count</span>
            </div>
            <div className="text-4xl font-serif font-bold text-foreground mb-3">
              {tradeStats?.count_trades || 0}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Transactions Reported</div>
          </div>

          <div className="bg-card border border-border p-6 flex flex-col items-center text-center">
            <div className="flex flex-col items-center gap-2 mb-3 text-muted-foreground">
              <TrendingUp size={20} />
              <span className="font-sans text-sm font-medium">Issuers Traded</span>
            </div>
            <div className="text-4xl font-serif font-bold text-foreground mb-3">
              {tradeStats?.count_issuers || 0}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Distinct Holdings</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-8 overflow-x-auto">
          {['overview', 'donations', 'trades', 'bills', 'voting'].map((tab) => {
            const tabName = tab === 'donations' ? 'Campaign Finance' : tab === 'trades' ? 'Stock Trades' : tab === 'bills' ? 'Legislation' : tab === 'voting' ? 'Voting Record' : 'Overview';
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-sans text-sm tracking-wide transition-all border-b-4 whitespace-nowrap ${
                  isActive
                    ? 'border-accent text-foreground font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
                }`}
              >
                {tabName}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-card border border-border p-8">
                <h3 className="font-mono text-sm font-bold text-accent uppercase mb-6 flex items-center gap-2">
                  $ Recent Stock Activity
                </h3>
                <div className="space-y-6">
                  {legislator.recentTrades.length > 0 ? (
                    legislator.recentTrades.slice(0, 3).map((trade, index) => (
                      <div key={index} className="flex justify-between items-center border-b border-border pb-6 last:border-0 last:pb-0">
                        <div>
                          <div className="font-serif font-bold text-foreground text-xl mb-1">{trade.ticker}</div>
                          <div className="text-xs font-mono text-muted-foreground uppercase">{trade.asset_description}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold text-base mb-1 ${trade.type.toLowerCase().includes('buy') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {trade.type.toUpperCase()}
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">{trade.transaction_date}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground font-mono italic">No recent trades found</div>
                  )}
                </div>
              </div>

              <div className="bg-card border border-border p-8">
                <h3 className="font-mono text-sm font-bold text-accent uppercase mb-6 flex items-center gap-2">
                  Recent Activity
                </h3>
                <div className="space-y-6">
                  {legislator.recentBills.length > 0 ? (
                    legislator.recentBills.slice(0, 3).map((bill, index) => (
                      <div key={index} className="flex flex-col border-b border-border pb-6 last:border-0 last:pb-0 gap-3">
                        <div className="font-serif font-bold text-foreground text-lg leading-snug">
                          {bill.title}
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-xs font-mono text-muted-foreground uppercase">{bill.date}</div>
                          <div className="text-[10px] font-mono font-bold uppercase text-muted-foreground bg-muted px-2.5 py-1 rounded-sm">
                            {bill.status}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground font-mono italic">No recent bills available</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'donations' && (
            <div className="bg-card border border-border p-8">
              <h3 className="font-mono text-sm font-bold text-accent uppercase mb-8">Campaign Finance Breakdown</h3>
              <div className="space-y-4">
                {legislator.topDonors.length > 0 ? (
                  legislator.topDonors.map((donor, index) => (
                    <div key={index} className="flex items-center justify-between p-6 bg-muted border border-border hover:border-accent/50 transition-colors">
                      <div>
                        <div className="font-serif text-xl font-bold text-foreground">{donor.name}</div>
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
                  <div className="text-muted-foreground font-mono italic">No detailed donor data available</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'trades' && (
            <div className="bg-card border border-border p-8">
              <h3 className="font-mono text-sm font-bold text-accent uppercase mb-8">Recent Stock Trades</h3>
              <div className="space-y-4">
                {legislator.recentTrades.length > 0 ? (
                  legislator.recentTrades.map((trade, index) => (
                    <div key={index} className="p-6 bg-muted border border-border hover:border-accent/50 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="font-serif text-xl font-bold text-foreground">{trade.ticker}</span>
                          <span className="ml-3 text-sm font-mono text-muted-foreground uppercase">{trade.asset_description}</span>
                        </div>
                        <div className={`px-4 py-2 font-mono text-sm font-bold border ${
                          trade.type.toLowerCase().includes('buy') 
                            ? 'text-green-600 border-green-500/30 bg-green-900/10' 
                            : 'text-red-600 border-red-500/30 bg-red-900/10'
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
                  <div className="text-muted-foreground font-mono italic">No trade data available</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'bills' && (
            <div className="bg-card border border-border p-8">
              <h3 className="font-mono text-sm font-bold text-accent uppercase mb-8">Sponsored Legislation</h3>
              <div className="space-y-4">
                {legislator.recentBills.length > 0 ? (
                  legislator.recentBills.map((bill, index) => (
                    <div key={index} className="p-6 bg-muted border border-border hover:border-accent/50 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-serif text-lg font-bold text-foreground leading-tight max-w-3xl">
                          {bill.title}
                        </h4>
                        <div className="px-3 py-1 bg-background border border-border text-xs font-mono font-bold uppercase text-foreground">
                          {bill.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase">
                        <Calendar size={14} />
                        <span>Introduced: {bill.date}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground font-mono italic">No sponsored legislation data available</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'voting' && (
            <div className="bg-card border border-border p-8">
              <h3 className="font-mono text-sm font-bold text-accent uppercase mb-8">Recent Voting Record</h3>
              <div className="space-y-4">
                {votes.length > 0 ? (
                  votes.map((vote, index) => (
                    <div key={index} className="flex items-center justify-between p-6 bg-muted border border-border hover:border-accent/50 transition-colors">
                      <div className="flex-1 mr-8">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-xs font-bold text-accent uppercase">{vote.bill.number}</span>
                          <span className="text-xs font-mono text-muted-foreground uppercase">{vote.date}</span>
                        </div>
                        <div className="font-serif font-bold text-foreground mb-1">{vote.bill.title || vote.description}</div>
                        <div className="text-xs font-mono text-muted-foreground uppercase">{vote.question}</div>
                      </div>
                      <div className={`px-4 py-2 font-sans text-sm font-semibold border ${vote.position === "Yes"
                        ? "text-green-600 border-green-500/30 bg-green-900/10"
                        : vote.position === "No"
                          ? "text-red-600 border-red-500/30 bg-red-900/10"
                          : "text-muted-foreground border-gray-500/30 bg-gray-900/10"
                        }`}>
                        {vote.position}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground font-mono italic">No voting record available</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}