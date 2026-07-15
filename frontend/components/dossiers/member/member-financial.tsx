import { ExternalLink, FileCheck2, ShieldAlert } from "lucide-react"
import { ArchivePanel } from "@/components/ui/archive-ui"
import type { MemberDisclosures } from "@/lib/services/relationships"
import { formatAmountRange, getSourceTier, type StockTrade, type TradesResponse } from "@/lib/services/stocks"
import { RecordCount } from "./member-dossier-ui"

function dateLabel(value: string | null | undefined) {
  if (!value) return "Date unavailable"
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(date)
}

function tradeEvidence(trade: StockTrade) {
  if (trade.conflict_flag_count <= 0) return { label: "No detected committee overlap", flagged: false }
  return {
    label: `${trade.highest_conflict_severity || "Potential overlap"} · ${trade.conflict_flag_count} flag${trade.conflict_flag_count === 1 ? "" : "s"}`,
    flagged: true,
  }
}

export function MemberTradesSection({ trades, loading, onPage }: { trades: TradesResponse; loading: boolean; onPage: (offset: number) => void }) {
  const first = trades.total === 0 ? 0 : trades.offset + 1
  const last = Math.min(trades.total, trades.offset + trades.limit)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-border bg-card p-4"><div className="font-serif text-3xl font-semibold">{trades.total.toLocaleString()}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Reported transactions</div></div>
        <div className="border border-border bg-card p-4"><div className="font-serif text-3xl font-semibold">{trades.tickers.length.toLocaleString()}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Resolved tickers</div></div>
        <div className="border border-border bg-card p-4"><div className="font-serif text-3xl font-semibold">{trades.coverage.excluded_date_anomalies.toLocaleString()}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Excluded date anomalies</div></div>
      </div>

      <div className="border border-border bg-card/40 p-4 text-sm leading-6 text-muted-foreground">
        These are reported disclosure ranges and events, not a reconstructed brokerage account or current market-value estimate. Transaction ranges remain ranges, unresolved asset descriptions remain visible, and committee overlap is contextual evidence rather than proof of misconduct.
      </div>

      <ArchivePanel title="Transaction ledger" kicker="Official disclosure rows" action={<RecordCount value={trades.trades.length} label="on page" />}>
        {trades.trades.length > 0 ? (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-muted/50 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr><th className="px-4 py-3">Asset</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Reported range</th><th className="px-4 py-3">Transaction</th><th className="px-4 py-3">Filed</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Source</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trades.trades.map((trade) => {
                  const evidence = tradeEvidence(trade)
                  const tier = getSourceTier(trade.source)
                  return (
                    <tr key={trade.trade_id} className="align-top transition-colors hover:bg-muted/30">
                      <td className="px-4 py-4"><div className="font-medium text-foreground">{trade.asset_name || trade.ticker || "Unresolved asset"}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{trade.ticker || "No ticker"}{trade.sector ? ` · ${trade.sector}` : ""}</div></td>
                      <td className="px-4 py-4 font-mono text-xs uppercase text-foreground">{trade.tx_type}</td>
                      <td className="px-4 py-4 font-mono text-xs text-foreground">{formatAmountRange(trade.amount_min, trade.amount_max)}</td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{dateLabel(trade.transaction_date)}</td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{dateLabel(trade.disclosure_date)}{trade.late_filing ? <div className="mt-1 font-mono text-[10px] uppercase text-amber-600">Late filing flag</div> : null}</td>
                      <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide ${evidence.flagged ? "text-amber-600" : "text-muted-foreground"}`}>{evidence.flagged ? <ShieldAlert size={13} aria-hidden="true" /> : null}{evidence.label}</span>{trade.committee_conflicts[0]?.description ? <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">{trade.committee_conflicts[0].description}</p> : null}</td>
                      <td className="px-4 py-4"><div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{tier} · {trade.source}</div>{trade.filing_url ? <a href={trade.filing_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">Filing <ExternalLink size={12} aria-hidden="true" /></a> : null}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm leading-6 text-muted-foreground">{trades.coverage.message}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4" aria-busy={loading}>
          <button type="button" disabled={loading || trades.offset === 0} onClick={() => onPage(Math.max(0, trades.offset - trades.limit))} className="min-h-10 border border-border bg-card px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
          <button type="button" disabled={loading || !trades.coverage.has_more} onClick={() => onPage(trades.offset + trades.limit)} className="min-h-10 border border-border bg-card px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{first.toLocaleString()}–{last.toLocaleString()} of {trades.total.toLocaleString()}</span>
        </div>
      </ArchivePanel>
    </div>
  )
}

export function MemberDisclosuresSection({ disclosures }: { disclosures: MemberDisclosures }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-border bg-card p-4"><div className="font-serif text-3xl font-semibold">{disclosures.documents.length.toLocaleString()}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Source documents</div></div>
        <div className="border border-border bg-card p-4"><div className="font-serif text-3xl font-semibold">{disclosures.holdings.length.toLocaleString()}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Reported holdings</div></div>
        <div className="border border-border bg-card p-4"><div className="font-serif text-3xl font-semibold">{disclosures.transactions.length.toLocaleString()}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Normalized transactions</div></div>
      </div>

      <ArchivePanel title="Official filings" kicker="Document-level coverage" action={<RecordCount value={disclosures.documents.length} label="documents" />}>
        {disclosures.documents.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {disclosures.documents.map((document) => (
              <article key={document.document_id} className="border border-border bg-card/50 p-4">
                <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground"><FileCheck2 size={16} aria-hidden="true" /> {document.report_type}</div><div className="mt-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{document.chamber} · {document.source} · {document.parse_status}</div></div>{document.filing_date ? <span className="font-mono text-[10px] text-muted-foreground">{document.filing_date}</span> : null}</div>
                {document.parse_error ? <p className="mt-3 text-xs leading-5 text-amber-600">{document.parse_error}</p> : null}
                <a href={document.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-accent hover:underline">Open official filing <ExternalLink size={13} aria-hidden="true" /></a>
              </article>
            ))}
          </div>
        ) : <p className="text-sm leading-6 text-muted-foreground">No source documents are loaded. This is a coverage state, not evidence that no filing exists.</p>}
      </ArchivePanel>

      <ArchivePanel title="Reported holdings" kicker="Ranges preserved as filed" action={<RecordCount value={disclosures.holdings.length} label="rows" />}>
        {disclosures.holdings.length > 0 ? (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-muted/50 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Asset</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Value range</th><th className="px-4 py-3">Income range</th></tr></thead>
              <tbody className="divide-y divide-border">
                {disclosures.holdings.map((holding, index) => (
                  <tr key={`${holding.document_id}-${holding.asset_name}-${index}`}>
                    <td className="px-4 py-4"><div className="font-medium text-foreground">{holding.asset_name}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{holding.ticker || "Unresolved identifier"}</div></td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{holding.owner_type}</td>
                    <td className="px-4 py-4 font-mono text-xs text-foreground">{formatAmountRange(holding.value_min ?? null, holding.value_max ?? null)}</td>
                    <td className="px-4 py-4 font-mono text-xs text-foreground">{formatAmountRange(holding.income_min ?? null, holding.income_max ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm leading-6 text-muted-foreground">No normalized holding rows are loaded from the available filings.</p>}
      </ArchivePanel>

      <ArchivePanel title="Filing-linked transactions" kicker="Document normalization" action={<RecordCount value={disclosures.transactions.length} label="rows" />}>
        {disclosures.transactions.length > 0 ? (
          <div className="divide-y divide-border border-y border-border">
            {disclosures.transactions.map((transaction, index) => (
              <article key={`${transaction.document_id}-${transaction.asset_name}-${index}`} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_9rem_11rem_auto] md:items-center">
                <div><div className="font-medium text-foreground">{transaction.asset_name}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{transaction.owner_type} · {transaction.ticker || "No ticker"}</div></div>
                <div className="font-mono text-xs uppercase text-foreground">{transaction.transaction_type}</div>
                <div className="font-mono text-xs text-foreground">{formatAmountRange(transaction.amount_min ?? null, transaction.amount_max ?? null)}</div>
                {transaction.filing_url ? <a href={transaction.filing_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 text-xs text-accent hover:underline">Source <ExternalLink size={12} aria-hidden="true" /></a> : <span className="text-xs text-muted-foreground">No source link</span>}
              </article>
            ))}
          </div>
        ) : <p className="text-sm leading-6 text-muted-foreground">No normalized transaction rows are loaded from the available filing set.</p>}
      </ArchivePanel>
    </div>
  )
}
