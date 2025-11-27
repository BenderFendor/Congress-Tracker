"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, MapPin, DollarSign, FileText, Users, TrendingUp, ExternalLink, Grid, Calendar, Shield, PieChart } from "lucide-react"
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
          getMemberVotes(params.id)
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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#ff4d00] border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  if (!legislator) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-white font-mono text-xl">LEGISLATOR NOT FOUND</div>
    </div>
  )

  // Helper to get party colors
  const getPartyColor = (party: string) => {
    if (party === "D" || party === "Democrat") return "text-blue-400 bg-blue-900/20 border-blue-500/30"
    if (party === "R" || party === "Republican") return "text-red-400 bg-red-900/20 border-red-500/30"
    return "text-gray-400 bg-gray-900/20 border-gray-500/30"
  }

  const partyColorClass = getPartyColor(legislator.party)
  const partyName = legislator.party === "D" ? "Democrat" : legislator.party === "R" ? "Republican" : legislator.party

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#ff4d00] selection:text-white pb-20">



      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-12">

        {/* Back Button */}
        <Link href="/legislators" className="inline-flex items-center gap-2 text-gray-500 hover:text-[#ff4d00] font-mono text-xs uppercase tracking-widest mb-8 transition-colors">
          <ArrowLeft size={14} />
          Back to Directory
        </Link>

        {/* Profile Header */}
        <div className="bg-[#171717] border-2 border-white/10 p-8 md:p-12 mb-12 animate-stagger-item delay-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff4d00]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

          <div className="flex flex-col md:flex-row items-start gap-8 md:gap-12 relative z-10">
            <div className="relative">
              <div className="w-32 h-32 md:w-40 md:h-40 bg-black border-2 border-white/10 overflow-hidden grayscale contrast-125 group-hover:grayscale-0 transition-all duration-500">
                {legislator.avatar ? (
                  <img src={legislator.avatar} alt={legislator.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5 text-gray-600">
                    <Users size={40} />
                  </div>
                )}
              </div>
              <div className={`absolute -bottom-3 -right-3 px-3 py-1 border ${partyColorClass} font-mono text-xs font-black uppercase tracking-wider backdrop-blur-md`}>
                {partyName}
              </div>
            </div>

            <div className="flex-1 w-full">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div>
                  <h1 className="font-serif text-4xl md:text-5xl font-black text-white mb-4 leading-none tracking-tight">
                    {legislator.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 text-gray-400 font-mono text-sm uppercase tracking-wide">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-[#ff4d00]" />
                      <span>{legislator.state}-{legislator.district}</span>
                    </div>
                    <span className="text-white/20">|</span>
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-[#ff4d00]" />
                      <span>{legislator.chamber}</span>
                    </div>
                  </div>
                </div>

                <a
                  href={legislator.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/20 hover:bg-[#ff4d00] hover:text-black hover:border-[#ff4d00] transition-all font-mono text-xs font-bold uppercase tracking-widest"
                >
                  Official Site
                  <ExternalLink size={14} />
                </a>
              </div>

              <p className="font-serif text-lg text-gray-300 leading-relaxed max-w-3xl mb-8 border-l-2 border-white/10 pl-6">
                {legislator.bio || "No biography available."}
              </p>

              <div className="flex flex-wrap gap-2">
                {legislator.committees.map((committee, index) => (
                  <div key={index} className="px-3 py-1 bg-white/5 border border-white/10 text-xs font-mono text-gray-400 uppercase">
                    {committee}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 animate-stagger-item delay-2">
          <div className="bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-gray-500 group-hover:text-[#ff4d00] transition-colors">
              <DollarSign size={20} />
              <span className="font-mono text-xs font-bold uppercase tracking-widest">Total Donations</span>
            </div>
            <div className="text-3xl font-serif font-black text-white mb-1">
              ${(legislator.totalDonations / 1000000).toFixed(1)}M
            </div>
            <div className="text-xs font-mono text-gray-600 uppercase">Current Cycle</div>
          </div>

          <div className="bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-gray-500 group-hover:text-[#ff4d00] transition-colors">
              <FileText size={20} />
              <span className="font-mono text-xs font-bold uppercase tracking-widest">Bills Sponsored</span>
            </div>
            <div className="text-3xl font-serif font-black text-white mb-1">
              {legislator.billsSponsored}
            </div>
            <div className="text-xs font-mono text-gray-600 uppercase">This Session</div>
          </div>

          <div className="bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-gray-500 group-hover:text-[#ff4d00] transition-colors">
              <Users size={20} />
              <span className="font-mono text-xs font-bold uppercase tracking-widest">Voting Score</span>
            </div>
            <div className="text-3xl font-serif font-black text-white mb-1">
              {legislator.votingScore}%
            </div>
            <div className="w-full h-1 bg-white/10 mt-2">
              <div className="h-full bg-[#ff4d00]" style={{ width: `${legislator.votingScore}%` }}></div>
            </div>
          </div>

          <div className="bg-[#171717] border-2 border-white/10 p-6 hover:border-[#ff4d00]/50 transition-colors group">
            <div className="flex items-center gap-3 mb-4 text-gray-500 group-hover:text-[#ff4d00] transition-colors">
              <TrendingUp size={20} />
              <span className="font-mono text-xs font-bold uppercase tracking-widest">Influence Score</span>
            </div>
            <div className="text-3xl font-serif font-black text-white mb-1">
              8.7
            </div>
            <div className="text-xs font-mono text-gray-600 uppercase">Committee Weighted</div>
          </div>
        </div>

        {/* Tabs & Content */}
        <div className="animate-stagger-item delay-3">
          <div className="flex border-b-2 border-white/10 mb-8 overflow-x-auto">
            {['overview', 'donations', 'bills', 'voting'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-4 font-mono text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === tab
                  ? 'text-[#ff4d00]'
                  : 'text-gray-500 hover:text-white'
                  }`}
              >
                {tab === 'donations' ? 'Campaign Finance' : tab === 'bills' ? 'Legislation' : tab === 'voting' ? 'Voting Record' : 'Overview'}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#ff4d00]"></div>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-[400px]">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-[#171717] border-2 border-white/10 p-8">
                  <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-6 flex items-center gap-2">
                    <DollarSign size={16} /> Top Contributors
                  </h3>
                  <div className="space-y-4">
                    {legislator.topDonors.length > 0 ? (
                      legislator.topDonors.slice(0, 3).map((donor, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 hover:border-white/20 transition-colors">
                          <div>
                            <div className="font-serif font-bold text-white">{donor.name}</div>
                            <div className="text-xs font-mono text-gray-500 uppercase">{donor.industry}</div>
                          </div>
                          <div className="font-mono font-bold text-[#ff4d00]">${(donor.amount / 1000).toFixed(0)}K</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 font-mono text-sm italic">No donor data available</div>
                    )}
                  </div>
                </div>

                <div className="bg-[#171717] border-2 border-white/10 p-8">
                  <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-6 flex items-center gap-2">
                    <FileText size={16} /> Recent Activity
                  </h3>
                  <div className="space-y-4">
                    {legislator.recentBills.length > 0 ? (
                      legislator.recentBills.map((bill, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 hover:border-white/20 transition-colors">
                          <div className="flex-1 mr-4">
                            <div className="font-serif font-bold text-white truncate">{bill.title}</div>
                            <div className="text-xs font-mono text-gray-500 uppercase">{bill.date}</div>
                          </div>
                          <div className="px-2 py-1 bg-white/10 text-[10px] font-mono font-bold uppercase text-gray-300">
                            {bill.status}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 font-mono text-sm italic">No recent bills available</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'donations' && (
              <div className="bg-[#171717] border-2 border-white/10 p-8">
                <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-8">Campaign Finance Breakdown</h3>
                <div className="space-y-4">
                  {legislator.topDonors.length > 0 ? (
                    legislator.topDonors.map((donor, index) => (
                      <div key={index} className="flex items-center justify-between p-6 bg-black/20 border border-white/5 hover:border-white/20 transition-colors group">
                        <div>
                          <div className="font-serif text-xl font-bold text-white group-hover:text-[#ff4d00] transition-colors">{donor.name}</div>
                          <div className="text-xs font-mono text-gray-500 uppercase mt-1">{donor.industry}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xl font-bold text-white">${(donor.amount / 1000).toFixed(0)}K</div>
                          <div className="text-xs font-mono text-gray-600 uppercase mt-1">
                            {((donor.amount / legislator.totalDonations) * 100).toFixed(1)}% of total
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 font-mono text-sm italic">No detailed donor data available</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'bills' && (
              <div className="bg-[#171717] border-2 border-white/10 p-8">
                <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-8">Sponsored Legislation</h3>
                <div className="space-y-4">
                  {legislator.recentBills.length > 0 ? (
                    legislator.recentBills.map((bill, index) => (
                      <div key={index} className="p-6 bg-black/20 border border-white/5 hover:border-white/20 transition-colors group">
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="font-serif text-lg font-bold text-white group-hover:text-[#ff4d00] transition-colors leading-tight max-w-3xl">
                            {bill.title}
                          </h4>
                          <div className="px-3 py-1 bg-white/10 text-xs font-mono font-bold uppercase text-white">
                            {bill.status}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono text-gray-500 uppercase">
                          <Calendar size={12} />
                          <span>Introduced: {bill.date}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 font-mono text-sm italic">No sponsored legislation data available</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'voting' && (
              <div className="bg-[#171717] border-2 border-white/10 p-8">
                <h3 className="font-mono text-xs font-black text-[#ff4d00] uppercase mb-8">Recent Voting Record</h3>
                <div className="space-y-4">
                  {votes.length > 0 ? (
                    votes.map((vote, index) => (
                      <div key={index} className="flex items-center justify-between p-6 bg-black/20 border border-white/5 hover:border-white/20 transition-colors">
                        <div className="flex-1 mr-8">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-xs font-black text-[#ff4d00] uppercase">{vote.bill.number}</span>
                            <span className="text-xs font-mono text-gray-500 uppercase">{vote.date}</span>
                          </div>
                          <div className="font-serif font-bold text-white mb-1">{vote.bill.title || vote.description}</div>
                          <div className="text-xs font-mono text-gray-500 uppercase">{vote.question}</div>
                        </div>
                        <div className={`px-4 py-2 font-mono text-sm font-bold uppercase border ${vote.position === "Yes"
                          ? "text-green-400 border-green-500/30 bg-green-900/10"
                          : vote.position === "No"
                            ? "text-red-400 border-red-500/30 bg-red-900/10"
                            : "text-gray-400 border-gray-500/30 bg-gray-900/10"
                          }`}>
                          {vote.position}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 font-mono text-sm italic">No voting record available</div>
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
