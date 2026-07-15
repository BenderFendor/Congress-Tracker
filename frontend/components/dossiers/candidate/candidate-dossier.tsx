"use client"

import Link from "next/link"
import { ArrowLeft, Building2, ExternalLink, FileSearch, Landmark, MapPin, RefreshCw, UserRound } from "lucide-react"
import { ArchivePage, ArchivePanel, DataState, EvidenceSpine } from "@/components/ui/archive-ui"
import { EvidenceDownloadMenu } from "@/components/ui/evidence-download-menu"
import type { FECDisbursement, FECReceipt } from "@/lib/services/fec"
import { principalCommittee } from "@/lib/services/candidates"
import { useCandidateDossier } from "./use-candidate-dossier"

function formatName(value: string) {
  const [last, ...rest] = value.split(",").map((part) => part.trim()).filter(Boolean)
  const source = rest.length > 0 ? `${rest.join(" ")} ${last}` : value
  return source.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase())
}

function officeLabel(value?: string | null) {
  if (value === "H") return "U.S. House"
  if (value === "S") return "U.S. Senate"
  if (value === "P") return "President"
  return value || "Office unavailable"
}

function statusLabel(value?: string | null) {
  const normalized = value?.toUpperCase()
  if (normalized === "I" || normalized === "INCUMBENT") return "Incumbent filing status"
  if (normalized === "C" || normalized === "CHALLENGER") return "Challenger filing status"
  if (normalized === "O" || normalized === "OPEN") return "Open-seat filing status"
  if (normalized === "P" || normalized === "PRIMARY") return "Primary filing status"
  return "Filing status unavailable"
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function dateLabel(value?: string | null) {
  if (!value) return "Date unavailable"
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(parsed)
}

export function CandidateDossier({ candidateId }: { candidateId: string }) {
  const { detail, finance, retryDetail, retryFinance } = useCandidateDossier(candidateId)
  const response = detail.data
  const candidate = response?.candidate
  const committee = response ? principalCommittee(response) : null
  const receipts = finance.data?.receipts
  const disbursements = finance.data?.disbursements

  const exportPayload = {
    exported_at: new Date().toISOString(),
    coverage_note: "Only exact-ID candidate records and loaded committee finance channels are included. Missing channels are not factual zeroes.",
    dossier: response,
    finance: finance.data,
  }
  const csvRows: Array<Record<string, unknown>> = []
  if (candidate) {
    csvRows.push({
      record_type: "candidate",
      candidate_id: candidate.candidate_id,
      name: candidate.name,
      party: candidate.party,
      state: candidate.state,
      district: candidate.district,
      office: candidate.office,
      active_through: candidate.active_through,
    })
  }
  response?.committees.forEach((row) => csvRows.push({ record_type: "candidate_committee", ...row }))
  receipts?.data.forEach((row) => csvRows.push({ record_type: "receipt", ...row }))
  disbursements?.data.forEach((row) => csvRows.push({ record_type: "disbursement", ...row }))

  if (detail.status === "idle" || (detail.status === "loading" && !response)) {
    return (
      <ArchivePage>
        <div className="mx-auto flex min-h-[75vh] max-w-6xl items-center justify-center px-4">
          <div className="w-full animate-pulse border border-border bg-card/50 p-8">
            <div className="h-3 w-40 bg-muted" />
            <div className="mt-6 h-16 w-3/4 bg-muted" />
            <div className="mt-10 grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 bg-muted" />)}</div>
          </div>
        </div>
      </ArchivePage>
    )
  }

  if (detail.status === "error" || !candidate || !response) {
    return (
      <ArchivePage>
        <div className="mx-auto max-w-3xl px-4 py-20">
          <DataState
            kind="error"
            title="Candidate dossier unavailable"
            description={`${detail.error || `No exact FEC candidate record matched ${candidateId}`}. This failed request is not presented as an empty record.`}
            action={<button type="button" onClick={() => retryDetail()} className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wide text-accent"><RefreshCw size={14} aria-hidden="true" /> Retry</button>}
          />
        </div>
      </ArchivePage>
    )
  }

  const displayName = formatName(candidate.name)

  return (
    <ArchivePage>
      <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-6 md:px-6 lg:px-8">
        <Link href="/candidates" className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-accent">
          <ArrowLeft size={15} aria-hidden="true" /> Candidate directory
        </Link>

        <header className="mt-2 grid overflow-hidden border border-border bg-card lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="relative p-6 md:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-accent" aria-hidden="true" />
            <div className="flex flex-wrap gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="border border-border bg-background px-2.5 py-1">Federal candidate dossier</span>
              <span className="border border-border bg-background px-2.5 py-1">{statusLabel(candidate.incumbent_challenge)}</span>
            </div>
            <div className="mt-8 flex items-start gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center border border-border bg-muted font-serif text-3xl font-semibold text-muted-foreground" aria-hidden="true">
                {displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">FEC {candidate.candidate_id}</p>
                <h1 className="mt-2 text-balance font-serif text-5xl font-semibold leading-none tracking-tight text-foreground md:text-7xl">{displayName}</h1>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Landmark size={15} aria-hidden="true" /> {officeLabel(candidate.office)}</span>
              <span className="inline-flex items-center gap-2"><MapPin size={15} aria-hidden="true" /> {candidate.state || "State unavailable"}{candidate.district ? ` · District ${candidate.district}` : ""}</span>
              <span className="inline-flex items-center gap-2"><UserRound size={15} aria-hidden="true" /> {candidate.party || "Party unavailable"}</span>
            </div>
            <div className="mt-8 border-t border-border pt-5">
              <EvidenceDownloadMenu filenamePrefix={`${displayName}-fec-candidate-dossier`} json={exportPayload} csvRows={csvRows} />
            </div>
          </div>
          <div className="border-t border-border bg-background/50 p-6 lg:border-l lg:border-t-0 lg:p-8">
            <EvidenceSpine
              identifier={candidate.candidate_id}
              source={response.provenance.source}
              status={response.coverage.candidate === "loaded" ? "Exact candidate identity loaded" : `Candidate identity coverage ${response.coverage.candidate}`}
              coverage={`${response.coverage.committee_links} · ${response.committees.length} official candidate–committee link${response.committees.length === 1 ? "" : "s"}`}
              sourceUrl={response.provenance.source_url}
            >
              <p className="mt-4 text-sm leading-6 text-muted-foreground">This dossier uses the exact FEC candidate ID. It does not attach congressional records through candidate-name similarity.</p>
            </EvidenceSpine>
          </div>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="border border-border border-t-2 border-t-accent bg-card p-4"><div className="font-serif text-3xl font-semibold text-foreground">{candidate.active_through || "—"}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Active through cycle</div></div>
          <div className="border border-border border-t-2 border-t-accent bg-card p-4"><div className="font-serif text-3xl font-semibold text-foreground">{response.committees.length}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Official committee links</div></div>
          <div className="border border-border border-t-2 border-t-accent bg-card p-4"><div className="font-serif text-3xl font-semibold text-foreground">{committee?.election_cycle || "—"}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Finance cycle shown</div></div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.65fr)]">
          <div className="space-y-6">
            <ArchivePanel title="Official committee links" kicker="FEC candidate–committee identity">
              {response.committees.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {response.committees.map((row) => (
                    <article key={`${row.committee_id}-${row.election_cycle}`} className={`border bg-card/50 p-4 ${row.is_principal ? "border-accent" : "border-border"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div><div className="font-serif text-lg font-semibold text-foreground">{row.committee_name}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{row.committee_id} · Cycle {row.election_cycle}</div></div>
                        {row.is_principal ? <span className="border border-accent px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-accent">Principal</span> : null}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">{row.committee_type || "Committee type unavailable"} · {row.committee_designation || "Designation unavailable"}</p>
                      <div className="mt-4 flex flex-wrap gap-4"><Link href={`/fec/receipts?committee=${encodeURIComponent(row.committee_id)}&cycle=${row.election_cycle}`} className="inline-flex min-h-10 items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-accent hover:underline">Receipts <FileSearch size={12} aria-hidden="true" /></Link><a href={`https://www.fec.gov/data/committee/${encodeURIComponent(row.committee_id)}/`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-accent hover:underline">FEC record <ExternalLink size={12} aria-hidden="true" /></a></div>
                    </article>
                  ))}
                </div>
              ) : <p className="text-sm leading-6 text-muted-foreground">No official committee link is loaded. This is a coverage state, not evidence that the candidate has no committee.</p>}
            </ArchivePanel>

            <FinanceChannel title="Itemized receipts" description="Money received by the selected official committee. Refunds, transfers, memos, and other record classes retain their own classification." loading={finance.status === "loading"} error={finance.data?.receiptError || (finance.status === "error" ? finance.error : null)} rows={receipts?.data ?? []} kind="receipt" onRetry={retryFinance} coverage={receipts?.meta.coverage_status} />
            <FinanceChannel title="Operating disbursements" description="Committee spending records remain separate from receipt totals and independent-expenditure channels." loading={finance.status === "loading"} error={finance.data?.disbursementError || (finance.status === "error" ? finance.error : null)} rows={disbursements?.data ?? []} kind="disbursement" onRetry={retryFinance} coverage={disbursements?.meta.coverage_status} />
          </div>

          <div className="space-y-6">
            <ArchivePanel title="Filing timeline" kicker="Candidate master-file dates">
              <dl className="space-y-4 text-sm"><div><dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">First file date</dt><dd className="mt-1 text-foreground">{dateLabel(candidate.first_file_date)}</dd></div><div><dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Last file date</dt><dd className="mt-1 text-foreground">{dateLabel(candidate.last_file_date)}</dd></div><div><dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Coverage</dt><dd className="mt-1 text-foreground">{response.coverage.committee_links === "loaded" ? "Official committee links loaded" : "Committee links not loaded"}</dd></div></dl>
            </ArchivePanel>
            <ArchivePanel title="Coverage warnings" kicker="Truthful missing states">
              {response.coverage.warnings.length > 0 ? <ul className="space-y-3 text-sm leading-6 text-muted-foreground">{response.coverage.warnings.map((warning) => <li key={warning} className="border-l-2 border-amber-500 pl-3">{warning}</li>)}</ul> : <p className="text-sm leading-6 text-muted-foreground">No identity or committee-link warning is reported for this response.</p>}
            </ArchivePanel>
            <ArchivePanel title="Research paths" kicker="Continue through official records">
              <div className="space-y-2"><a href={response.provenance.source_url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between border-b border-border text-sm text-foreground hover:border-accent hover:text-accent"><span>Official candidate record</span><ExternalLink size={14} aria-hidden="true" /></a>{committee ? <><Link href={`/fec/receipts?committee=${encodeURIComponent(committee.committee_id)}&cycle=${committee.election_cycle}`} className="flex min-h-11 items-center justify-between border-b border-border text-sm text-foreground hover:border-accent hover:text-accent"><span>Browse committee receipts</span><FileSearch size={14} aria-hidden="true" /></Link><Link href={`/fec/disbursements?committee=${encodeURIComponent(committee.committee_id)}&cycle=${committee.election_cycle}`} className="flex min-h-11 items-center justify-between border-b border-border text-sm text-foreground hover:border-accent hover:text-accent"><span>Browse committee disbursements</span><Building2 size={14} aria-hidden="true" /></Link></> : null}</div>
            </ArchivePanel>
          </div>
        </div>
      </div>
    </ArchivePage>
  )
}

function FinanceChannel({ title, description, loading, error, rows, kind, onRetry, coverage }: { title: string; description: string; loading: boolean; error: string | null; rows: Array<FECReceipt | FECDisbursement>; kind: "receipt" | "disbursement"; onRetry: () => void; coverage?: string }) {
  return (
    <ArchivePanel title={title} kicker={`${coverage || "not loaded"} coverage · ${rows.length} rows shown`}>
      <p className="mb-4 text-sm leading-6 text-muted-foreground">{description}</p>
      {loading && rows.length === 0 ? <div className="border border-border bg-card/50 p-5 font-mono text-xs uppercase tracking-wide text-muted-foreground" aria-live="polite">Loading {title.toLowerCase()}…</div> : null}
      {error ? <div className="mb-4 flex items-center justify-between gap-4 border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-muted-foreground"><span>{error}. This channel is not presented as zero.</span><button type="button" onClick={onRetry} className="font-mono text-[10px] font-semibold uppercase tracking-wide text-accent">Retry</button></div> : null}
      {rows.length > 0 ? <div className="overflow-x-auto border border-border"><table className="w-full min-w-[760px] text-left"><thead className="bg-muted/50 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Record</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Classification</th><th className="px-4 py-3">Source</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => { const receipt = kind === "receipt" ? row as FECReceipt : null; const disbursement = kind === "disbursement" ? row as FECDisbursement : null; const sourceUrl = receipt?.source_url || disbursement?.source_url; return <tr key={row.source_record_id}><td className="px-4 py-4"><div className="font-medium text-foreground">{receipt?.contributor_name || disbursement?.recipient_name || "Record name unavailable"}</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{receipt?.committee_name || disbursement?.committee_name}</div></td><td className="px-4 py-4 text-sm text-muted-foreground">{dateLabel(receipt?.contribution_date || disbursement?.transaction_date)}</td><td className="px-4 py-4 font-mono text-sm text-foreground">{money(row.amount)}</td><td className="px-4 py-4 text-xs text-muted-foreground">{receipt?.record_kind || disbursement?.category_description || disbursement?.purpose || "Unclassified"}</td><td className="px-4 py-4">{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 text-xs text-accent hover:underline">Source <ExternalLink size={12} aria-hidden="true" /></a> : <span className="text-xs text-muted-foreground">No source link</span>}</td></tr>})}</tbody></table></div> : !loading && !error ? <p className="text-sm leading-6 text-muted-foreground">No {title.toLowerCase()} are loaded for this committee and cycle.</p> : null}
    </ArchivePanel>
  )
}
