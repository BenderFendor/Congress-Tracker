"use client"

import { MapPin, Landmark, Calendar, TrendingUp, DollarSign, BarChart3, DatabaseZap } from "lucide-react"
import { useState } from "react"
import { Legislator } from "@/lib/services/legislators"
import Link from "next/link"
import Image from "next/image"

interface LegislatorCardProps {
  member: Legislator
}

function compactCurrency(value: number | null | undefined) {
  if (value == null || value === 0) return "Unavailable"
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${value}`
}

export function LegislatorCard({ member }: LegislatorCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const tradeStats = member.trade_summary?.stats
  const matchConfidence = member.trade_summary?.match_confidence === "exact_id" ? 100 : null
  const party = member.party || "Unknown"
  const isDemocrat = party.toLowerCase().includes("democrat")
  const isRepublican = party.toLowerCase().includes("republican")
  const hasTradeData = Boolean(tradeStats && (tradeStats.count_trades > 0 || tradeStats.volume > 0 || tradeStats.count_issuers > 0))
  const portrait = member.avatar || member.depiction_url || (member.id ? `https://bioguide.congress.gov/bioguide/photo/${member.id[0]}/${member.id}.jpg` : "")
  
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <Link
      href={`/legislators/${member.id}`}
      className="group relative flex flex-col overflow-hidden border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-xl hover:shadow-primary/5"
    >
      {/* Left: Avatar Section */}
      <div className="relative h-56 w-full shrink-0 overflow-hidden bg-[#f4ece1]">
        {portrait && !imageFailed ? (
          <Image
            src={portrait}
            alt={member.name}
            onError={() => setImageFailed(true)}
            width={320}
            height={420}
            unoptimized
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#8a7a63]">
            <span className="font-serif text-4xl font-bold opacity-50">{initials}</span>
          </div>
        )}
        
        {/* Party Badge Overlay */}
        <div className="absolute top-3 left-3 z-10">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase shadow-sm ${
            isDemocrat ? "bg-blue-600 text-white" : 
            isRepublican ? "bg-red-600 text-white" : 
            "bg-gray-500 text-white"
          }`}>
            {isDemocrat ? "Democrat" : isRepublican ? "Republican" : party}
          </span>
        </div>
      </div>

      {/* Right: Content Section */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-serif text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                {member.name}
              </h3>
            </div>
            
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-accent" />
                {member.state}{member.district ? `-${member.district}` : ""}
              </span>
              <span className="flex items-center gap-1">
                <Landmark className="h-3.5 w-3.5 text-accent" />
                {member.chamber}
              </span>
            </div>
          </div>

          {/* Match Confidence Circle */}
          {matchConfidence !== null && (
          <div className="flex shrink-0 flex-col items-center justify-center gap-1">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <svg className="h-full w-full -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/20"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={125.6}
                  strokeDashoffset={125.6 * (1 - matchConfidence / 100)}
                  strokeLinecap="round"
                  className="text-accent"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold leading-none">{matchConfidence}%</span>
              </div>
            </div>
            <span className="text-[8px] font-bold tracking-widest uppercase text-muted-foreground">Match</span>
          </div>
          )}
        </div>

        {hasTradeData ? (
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-4">
            <div className="flex flex-col gap-1"><span className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase text-muted-foreground"><TrendingUp className="h-2.5 w-2.5" /> Trades</span><span className="text-sm font-bold">{tradeStats?.count_trades}</span></div>
            <div className="flex flex-col gap-1"><span className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase text-muted-foreground"><DollarSign className="h-2.5 w-2.5" /> Volume</span><span className="text-sm font-bold">{compactCurrency(tradeStats?.volume)}</span></div>
            <div className="flex flex-col gap-1"><span className="flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase text-muted-foreground"><BarChart3 className="h-2.5 w-2.5" /> Issuers</span><span className="text-sm font-bold">{tradeStats?.count_issuers}</span></div>
          </div>
        ) : (
          <div className="mt-6 flex items-start gap-2 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            <DatabaseZap className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>No matched transaction records in the currently loaded disclosure source.</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-4">
          <div className="flex items-center border-t border-border/50 pt-3 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            {member.chamber} &middot; {member.state}
          </div>
        </div>
      </div>
    </Link>
  )
}
