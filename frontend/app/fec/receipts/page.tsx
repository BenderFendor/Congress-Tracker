import Link from "next/link"
import { Calendar, ExternalLink, FileWarning, Search, User } from "lucide-react"

import { buildFecReceiptQuery, parseOptionalReceiptNumber } from "@/lib/fec-receipts.mjs"
import { getFecReceipts, type FECReceipt, type FECReceiptQuery } from "@/lib/services/fec"

type SearchValue = string | string[] | undefined
type ReceiptsPageProps = {
  searchParams: Record<string, SearchValue>
}

function first(value: SearchValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? ""
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value?: string | null): string {
  if (!value) return "Date unavailable"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`))
}

function kindLabel(value: string): string {
  return value.replaceAll("_", " ")
}

function pageHref(query: FECReceiptQuery, page: number): string {
  return `/fec/receipts?${buildFecReceiptQuery({ ...query, page })}`
}

function ReceiptSource({ receipt }: { receipt: FECReceipt }) {
  if (!receipt.source_url) {
    return <span className="font-mono text-[10px] uppercase text-muted-foreground">Source link unavailable</span>
  }
  return (
    <a
      className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wide text-accent hover:underline"
      href={receipt.source_url}
      rel="noreferrer"
      target="_blank"
    >
      FEC filing <ExternalLink size={11} />
    </a>
  )
}

export default async function ReceiptsPage({ searchParams }: ReceiptsPageProps) {
  const cycle = parseOptionalReceiptNumber(searchParams.cycle) ?? 2026
  const committeeId = first(searchParams.committee_id) || first(searchParams.committee)
  const search = first(searchParams.q)
  const recordKind = first(searchParams.record_kind)
  const query: FECReceiptQuery = {
    committeeId,
    cycle,
    search,
    recordKind,
    minAmount: parseOptionalReceiptNumber(searchParams.min_amount),
    maxAmount: parseOptionalReceiptNumber(searchParams.max_amount),
    page: parseOptionalReceiptNumber(searchParams.page) ?? 1,
    perPage: parseOptionalReceiptNumber(searchParams.per_page) ?? 50,
  }

  let response: Awaited<ReturnType<typeof getFecReceipts>> | null = null
  let errorMessage = ""
  try {
    response = await getFecReceipts(query)
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "The receipts service failed"
  }

  const receipts = response?.data ?? []
  const paging = response?.meta.paging
  const coverage = response?.meta.coverage_status ?? "not_ingested"
  const linkageIssues = response?.meta.unresolved_linkage_issues ?? 0

  return (
    <main className="min-h-screen bg-background pb-20 text-foreground">
      <div className="mx-auto max-w-[1500px] px-4 pt-10 sm:px-6 md:px-12">
        <header className="border-b-2 border-border pb-8">
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.24em] text-accent">
            Federal Election Commission warehouse
          </p>
          <h1 className="font-serif text-4xl font-bold leading-none tracking-tight sm:text-5xl md:text-6xl">
            Disclosed campaign receipts
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
            Canonical itemized receipts for House and Senate candidate committees. Amendments supersede earlier rows;
            memo allocations, refunds, transfers, and outside spending remain visible without entering direct-receipt totals.
          </p>
          <Link className="mt-4 inline-block font-mono text-xs font-bold uppercase text-accent hover:underline" href="/fec/disbursements">
            Browse operating disbursements
          </Link>
        </header>

        <section className="my-8 border-2 border-border bg-card p-5 md:p-7" aria-labelledby="receipt-filters">
          <h2 id="receipt-filters" className="mb-5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Search canonical records
          </h2>
          <form action="/fec/receipts" className="grid gap-4 lg:grid-cols-12" method="get">
            <label className="relative lg:col-span-4">
              <span className="sr-only">Donor or committee</span>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={18} />
              <input
                className="w-full border-2 border-border bg-background py-3 pl-11 pr-4 font-mono text-sm outline-none focus:border-accent"
                defaultValue={search}
                name="q"
                placeholder="Donor or committee"
                type="search"
              />
            </label>
            <label className="lg:col-span-3">
              <span className="sr-only">Committee ID</span>
              <input
                className="w-full border-2 border-border bg-background px-4 py-3 font-mono text-sm uppercase outline-none focus:border-accent"
                defaultValue={committeeId}
                name="committee_id"
                placeholder="Committee ID"
              />
            </label>
            <label className="lg:col-span-2">
              <span className="sr-only">Election cycle</span>
              <select
                className="w-full border-2 border-border bg-background px-4 py-3 font-mono text-sm outline-none focus:border-accent"
                defaultValue={String(cycle)}
                name="cycle"
              >
                <option value="2026">2025–2026</option>
                <option value="2024">2023–2024</option>
                <option value="2022">2021–2022</option>
              </select>
            </label>
            <label className="lg:col-span-3">
              <span className="sr-only">Record kind</span>
              <select
                className="w-full border-2 border-border bg-background px-4 py-3 font-mono text-sm capitalize outline-none focus:border-accent"
                defaultValue={recordKind}
                name="record_kind"
              >
                <option value="">All record kinds</option>
                <option value="contribution">Contributions</option>
                <option value="transfer">Transfers</option>
                <option value="memo">Memo records</option>
                <option value="refund_or_return">Refunds and returns</option>
                <option value="independent_expenditure">Independent expenditures</option>
              </select>
            </label>
            <label className="lg:col-span-2">
              <span className="sr-only">Minimum amount</span>
              <input
                className="w-full border-2 border-border bg-background px-4 py-3 font-mono text-sm outline-none focus:border-accent"
                defaultValue={first(searchParams.min_amount)}
                min="0"
                name="min_amount"
                placeholder="Minimum $"
                step="1"
                type="number"
              />
            </label>
            <label className="lg:col-span-2">
              <span className="sr-only">Maximum amount</span>
              <input
                className="w-full border-2 border-border bg-background px-4 py-3 font-mono text-sm outline-none focus:border-accent"
                defaultValue={first(searchParams.max_amount)}
                min="0"
                name="max_amount"
                placeholder="Maximum $"
                step="1"
                type="number"
              />
            </label>
            <input name="per_page" type="hidden" value="50" />
            <div className="flex gap-3 lg:col-span-8 lg:justify-end">
              <Link className="border-2 border-border px-5 py-3 font-mono text-xs font-bold uppercase hover:border-accent" href="/fec/receipts?cycle=2026&page=1&per_page=50">
                Reset
              </Link>
              <button className="bg-accent px-6 py-3 font-mono text-xs font-bold uppercase text-accent-foreground" type="submit">
                Apply filters
              </button>
            </div>
          </form>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-start" aria-live="polite">
          <div className={`border-l-4 p-4 ${coverage === "loaded" ? "border-accent bg-accent/10" : "border-amber-500 bg-amber-500/10"}`}>
            <p className="font-mono text-xs font-bold uppercase tracking-wide">
              Coverage: {kindLabel(coverage)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {coverage === "loaded"
                ? `${paging?.total_is_exact ? "" : "At least "}${paging?.total_items.toLocaleString() ?? "0"} canonical itemized records match this query.`
                : linkageIssues > 0
                  ? `${paging?.total_items.toLocaleString() ?? "0"} canonical records match. ${linkageIssues.toLocaleString()} official candidate-committee links could not be joined to the cycle master files.`
                : `Cycle ${cycle} is not fully ingested. Empty results do not mean a committee received no money.`}
            </p>
            {response?.meta.source_updated_at ? (
              <p className="mt-2 font-mono text-[10px] uppercase text-muted-foreground">
                Canonicalized {new Date(response.meta.source_updated_at).toLocaleString("en-US")}
              </p>
            ) : null}
          </div>
          <a
            className="inline-flex items-center gap-2 border-2 border-border px-4 py-3 font-mono text-xs font-bold uppercase hover:border-accent"
            href={response?.provenance.source_url ?? "https://www.fec.gov/data/browse-data/"}
            rel="noreferrer"
            target="_blank"
          >
            FEC bulk source <ExternalLink size={13} />
          </a>
        </section>

        {response?.provenance.warnings.map((warning) => (
          <p className="mb-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground" key={warning}>
            <FileWarning className="mt-0.5 shrink-0 text-accent" size={14} />
            {warning}
          </p>
        ))}

        {errorMessage ? (
          <div className="my-8 border-2 border-red-500 bg-red-500/10 p-5">
            <p className="font-mono text-xs font-bold uppercase text-red-500">Receipts unavailable</p>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
          </div>
        ) : null}

        {!errorMessage && receipts.length === 0 ? (
          <div className="my-8 border-2 border-border bg-card p-10 text-center">
            <p className="font-serif text-2xl font-bold">No canonical records match</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Adjust the filters, or check the coverage state above before interpreting this as no activity.
            </p>
          </div>
        ) : null}

        {receipts.length > 0 ? (
          <>
            <div className="space-y-3 lg:hidden">
              {receipts.map((receipt) => (
                <article className="border-2 border-border bg-card p-4" key={receipt.source_record_id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-sans text-sm font-semibold">{receipt.contributor_name}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">{receipt.committee_name}</p>
                    </div>
                    <p className="font-mono text-sm font-bold">{formatCurrency(receipt.amount)}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase">
                    <span className="border border-border px-2 py-1">{kindLabel(receipt.record_kind)}</span>
                    {!receipt.include_in_totals ? <span className="border border-amber-500 px-2 py-1 text-amber-600">Excluded from totals</span> : null}
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Calendar size={12} /> {formatDate(receipt.contribution_date)}</p>
                  {receipt.memo_text ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{receipt.memo_text}</p> : null}
                  <div className="mt-4"><ReceiptSource receipt={receipt} /></div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-hidden border-2 border-border bg-card lg:block">
              <table className="w-full table-fixed border-collapse">
                <thead className="border-b-2 border-border bg-muted font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-[25%] p-4 text-left" scope="col">Contributor</th>
                    <th className="w-[25%] p-4 text-left" scope="col">Recipient committee</th>
                    <th className="w-[14%] p-4 text-left" scope="col">Date</th>
                    <th className="w-[12%] p-4 text-right" scope="col">Amount</th>
                    <th className="w-[14%] p-4 text-left" scope="col">Classification</th>
                    <th className="w-[10%] p-4 text-right" scope="col">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receipts.map((receipt) => (
                    <tr className="align-top hover:bg-muted/40" key={receipt.source_record_id}>
                      <th aria-label={`Contributor ${receipt.contributor_name}`} className="p-4 text-left font-normal" scope="row">
                        <div className="flex gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground"><User aria-hidden="true" size={14} /></span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold" title={receipt.contributor_name}>{receipt.contributor_name}</p>
                            <p className="mt-1 truncate font-mono text-[10px] uppercase text-muted-foreground">{receipt.employer || receipt.contributor_type}</p>
                          </div>
                        </div>
                      </th>
                      <td className="p-4">
                        <p className="truncate text-xs" title={receipt.committee_name}>{receipt.committee_name}</p>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{receipt.committee_id}</p>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">{formatDate(receipt.contribution_date)}</td>
                      <td className="p-4 text-right font-mono text-sm font-bold">{formatCurrency(receipt.amount)}</td>
                      <td className="p-4">
                        <p className="font-mono text-[10px] font-bold uppercase">{kindLabel(receipt.record_kind)}</p>
                        {!receipt.include_in_totals ? <p className="mt-1 font-mono text-[9px] uppercase text-amber-600">Excluded from totals</p> : null}
                        {receipt.memo_text ? <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-muted-foreground" title={receipt.memo_text}>{receipt.memo_text}</p> : null}
                      </td>
                      <td className="p-4 text-right"><ReceiptSource receipt={receipt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {paging && paging.total_pages > 1 ? (
          <nav className="mt-8 flex items-center justify-between gap-4 border-t-2 border-border pt-6" aria-label="Receipt pages">
            {paging.page > 1 ? (
              <Link className="border-2 border-border px-4 py-3 font-mono text-xs font-bold uppercase hover:border-accent" href={pageHref(query, paging.page - 1)}>
                Previous
              </Link>
            ) : <span />}
            <p className="font-mono text-xs text-muted-foreground">Page {paging.page.toLocaleString()} of {paging.total_pages.toLocaleString()}</p>
            {paging.page < paging.total_pages ? (
              <Link className="border-2 border-border px-4 py-3 font-mono text-xs font-bold uppercase hover:border-accent" href={pageHref(query, paging.page + 1)}>
                Next
              </Link>
            ) : <span />}
          </nav>
        ) : null}
      </div>
    </main>
  )
}
