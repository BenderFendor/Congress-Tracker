import { ArrowRight, FileClock } from "lucide-react"

import { filingIntervalState } from "@/lib/data-quality.mjs"
import type { StockTrade } from "@/lib/services/stocks"

function formatDate(value: string | null): string {
  if (!value) return "Not available"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function FilingTimeline({ trade }: { trade: StockTrade }) {
  const intervalLabel = filingIntervalState(
    trade.transaction_date,
    trade.disclosure_date,
    trade.disclosure_lag_days,
  ).label

  return (
    <div className="mt-3 rounded-md border border-border/80 bg-background/55 p-3" aria-label={`Transaction and filing timeline. ${intervalLabel}.`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div>
          <div className="archive-metric-label">Transaction</div>
          <time className="mt-1 block text-xs font-semibold text-foreground" dateTime={trade.transaction_date || undefined}>
            {formatDate(trade.transaction_date)}
          </time>
        </div>
        <ArrowRight className="text-muted-foreground" size={16} aria-hidden="true" />
        <div className="text-right">
          <div className="archive-metric-label">Filed</div>
          <time className="mt-1 block text-xs font-semibold text-foreground" dateTime={trade.disclosure_date || undefined}>
            {formatDate(trade.disclosure_date)}
          </time>
        </div>
      </div>
      <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${trade.late_filing ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
        <FileClock size={14} aria-hidden="true" />
        <span>{intervalLabel}{trade.late_filing ? " · Late filing flag" : ""}</span>
      </div>
    </div>
  )
}
