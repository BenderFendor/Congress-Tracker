"use client"

import { MapPin, Landmark, Calendar, TrendingUp, DollarSign, BarChart3, DatabaseZap, CakeSlice, History } from "lucide-react"
import { Legislator } from "@/lib/services/legislators"
import Link from "next/link"
import { MemberPortrait } from "@/components/ui/member-identity"

interface LegislatorCardProps {
  member: Legislator
}

function compactCurrency(value: number | null | undefined) {
  if (value == null || value === 0) return "Unavailable"
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${value}`
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

export function LegislatorCard({ member }: LegislatorCardProps) {
  const tradeStats = member.trade_summary?.stats
  const matchConfidence = member.trade_summary?.match_confidence === "exact_id" ? 100 : null
  const party = member.party || "Unknown"
  const isDemocrat = party.toLowerCase().includes("democrat")
  const isRepublican = party.toLowerCase().includes("republican")
  const hasTradeData = Boolean(tradeStats && (tradeStats.count_trades > 0 || tradeStats.volume > 0 || tradeStats.count_issuers > 0))
  const roleLabel = member.chamber.toLowerCase() === "senate" ? "Senator" : member.chamber.toLowerCase() === "house" ? "Representative" : member.chamber
  const serviceYears = member.years_in_office == null ? completedServiceYears(member.service_start) : Math.floor(member.years_in_office)
  
  return (
    <Link
      href={`/legislators/${member.id}`}
      className="group relative flex flex-col overflow-hidden border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-xl hover:shadow-primary/5"
    >
      {/* Left: Avatar Section */}
      <div className="member-portrait relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-[#f4ece1]">
        <MemberPortrait
          bioguideId={member.bioguide_id}
          name={member.name}
          suppliedUrls={[member.avatar, member.depiction_url]}
          className="contents"
          imageClassName="member-portrait-image"
          fallbackClassName="member-portrait-fallback flex h-full w-full items-center justify-center font-serif text-5xl font-bold text-[#8a7a63] opacity-50"
          width={320}
          height={420}
        />
        
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
      <div className="flex flex-1 flex-col p-4">
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
                {roleLabel}
              </span>
            </div>
            <div className="member-glance-row">
              <span className="member-role-chip"><Landmark size={12} />{roleLabel}</span>
              {member.age != null ? <span><CakeSlice size={12} />Age {member.age}</span> : null}
              {serviceYears != null ? <span><History size={12} />{serviceYears} {serviceYears === 1 ? "year" : "years"} in office</span> : null}
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
            {roleLabel} &middot; {member.state}
          </div>
        </div>
      </div>
    </Link>
  )
}
