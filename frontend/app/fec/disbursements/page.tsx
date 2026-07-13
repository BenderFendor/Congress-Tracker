import Link from "next/link"
import { ExternalLink, Search } from "lucide-react"

import { buildFecReceiptQuery } from "@/lib/fec-receipts.mjs"
import { getFecDisbursements, type FECReceiptQuery } from "@/lib/services/fec"
import { requestTruthState } from "@/lib/truth-states.mjs"

type SearchValue = string | string[] | undefined
type PageProps = { searchParams: Record<string, SearchValue> }

function first(value: SearchValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? ""
}

function numberValue(value: SearchValue): number | undefined {
  const raw = first(value).trim()
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

export default async function DisbursementsPage({ searchParams }: PageProps) {
  const query: FECReceiptQuery = {
    committeeId: first(searchParams.committee_id),
    cycle: numberValue(searchParams.cycle) ?? 2026,
    search: first(searchParams.q),
    minAmount: numberValue(searchParams.min_amount),
    maxAmount: numberValue(searchParams.max_amount),
    page: numberValue(searchParams.page) ?? 1,
    perPage: 50,
  }
  let response: Awaited<ReturnType<typeof getFecDisbursements>> | null = null
  let error = ""
  try {
    response = await getFecDisbursements(query)
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "The disbursement service failed"
  }
  const paging = response?.meta.paging
  const requestState = requestTruthState({
    error,
    responseLoaded: response !== null,
    count: response?.data.length ?? 0,
    partial: response?.meta.coverage_status === "partial" || response?.meta.coverage_status === "not_ingested",
  })
  const pageHref = (page: number) => `/fec/disbursements?${buildFecReceiptQuery({ ...query, page })}`

  return (
    <main className="min-h-screen bg-background pb-20 text-foreground">
      <div className="mx-auto max-w-[1500px] px-4 pt-10 sm:px-6 md:px-12">
        <header className="border-b-2 border-border pb-8">
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.24em] text-accent">Federal Election Commission warehouse</p>
          <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-6xl">Operating disbursements</h1>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
            Canonical Schedule B spending reported by FEC committees. These payments are kept separate from receipts and donor totals.
          </p>
          <Link className="mt-4 inline-block font-mono text-xs font-bold uppercase text-accent hover:underline" href="/fec/receipts">Browse receipts instead</Link>
        </header>

        <section aria-labelledby="disbursement-filters" className="my-8 border-2 border-border bg-card p-5">
          <h2 className="mb-5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground" id="disbursement-filters">Search canonical records</h2>
        <form action="/fec/disbursements" className="grid gap-4 md:grid-cols-6" method="get">
          <label className="relative md:col-span-2">
            <span className="sr-only">Recipient or purpose</span>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={18} />
            <input className="w-full border-2 border-border bg-background py-3 pl-11 pr-4 font-mono text-sm" defaultValue={query.search} name="q" placeholder="Recipient or purpose" type="search" />
          </label>
          <label>
            <span className="sr-only">Committee ID</span>
            <input className="w-full border-2 border-border bg-background px-4 py-3 font-mono text-sm" defaultValue={query.committeeId} name="committee_id" placeholder="Committee ID" />
          </label>
          <label>
          <span className="sr-only">Election cycle</span>
          <select className="w-full border-2 border-border bg-background px-4 py-3 font-mono text-sm" defaultValue={String(query.cycle)} name="cycle">
            <option value="2026">2025-2026</option><option value="2024">2023-2024</option><option value="2022">2021-2022</option>
          </select>
          </label>
          <label>
            <span className="sr-only">Minimum amount</span>
            <input className="w-full border-2 border-border bg-background px-4 py-3 font-mono text-sm" defaultValue={query.minAmount} min="0" name="min_amount" placeholder="Minimum $" step="1" type="number" />
          </label>
          <label>
            <span className="sr-only">Maximum amount</span>
            <input className="w-full border-2 border-border bg-background px-4 py-3 font-mono text-sm" defaultValue={query.maxAmount} min="0" name="max_amount" placeholder="Maximum $" step="1" type="number" />
          </label>
          <button className="bg-accent px-6 py-3 font-mono text-xs font-bold uppercase text-accent-foreground" type="submit">Apply filters</button>
        </form>
        </section>

        {response ? <section aria-live="polite" className={`mb-6 border-l-4 p-4 ${response.meta.coverage_status === "loaded" ? "border-accent bg-accent/10" : "border-amber-500 bg-amber-500/10"}`}>
          <p className="font-mono text-xs font-bold uppercase">Coverage: {response?.meta.coverage_status?.replaceAll("_", " ") ?? "unavailable"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {response.meta.coverage_status === "loaded"
              ? `${paging?.total_is_exact ? "" : "At least "}${paging?.total_items.toLocaleString() ?? "0"} canonical Schedule B records match this query.`
              : `Cycle ${query.cycle} is not fully ingested. Empty results do not mean a committee reported no spending.`}
          </p>
        </section> : null}

        {error ? <div className="my-8 border-2 border-red-500 bg-red-500/10 p-5" role="alert"><p className="font-mono text-xs font-bold uppercase text-red-500">Disbursements unavailable</p><p className="mt-2 text-sm text-muted-foreground">{error}. This request failure is not presented as zero spending.</p></div> : null}
        {requestState === "empty" ? <output className="my-8 block border-2 border-border bg-card p-10 text-center"><span className="block font-serif text-2xl font-bold">No canonical disbursements match</span><span className="mt-2 block text-sm text-muted-foreground">Adjust the filters, or check the coverage state above before interpreting this as no spending.</span></output> : null}
        {(requestState === "loaded" || requestState === "partial") && response ? <div className="space-y-3">
          {response?.data.map((row) => (
            <article className="grid gap-3 border-2 border-border bg-card p-5 md:grid-cols-[1fr_auto]" key={`${row.committee_id}-${row.source_record_id}`}>
              <div>
                <p className="font-serif text-xl font-bold">{row.recipient_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{row.purpose || "Purpose not reported"}</p>
                <p className="mt-2 font-mono text-[10px] uppercase text-muted-foreground">{row.committee_name} · {row.transaction_date || "Date unavailable"}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-bold">{currency(row.amount)}</p>
                <a className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-accent hover:underline" href={row.source_url} rel="noreferrer" target="_blank">FEC filing <ExternalLink size={11} /></a>
              </div>
            </article>
          ))}
        </div> : null}

        {paging && paging.total_pages > 1 ? (
          <nav aria-label="Disbursement pages" className="mt-8 flex justify-between border-t-2 border-border pt-5">
            {paging.page > 1 ? <Link href={pageHref(paging.page - 1)}>Previous</Link> : <span />}
            <span className="font-mono text-xs">Page {paging.page} of {paging.total_pages}</span>
            {paging.page < paging.total_pages ? <Link href={pageHref(paging.page + 1)}>Next</Link> : <span />}
          </nav>
        ) : null}
      </div>
    </main>
  )
}
