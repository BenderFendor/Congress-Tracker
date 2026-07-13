"use client"

// Design direction: Range ledger. Each estimate reads as a bounded filing calculation, never as an exact wealth score.
import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, ChevronDown, Home, Search } from "lucide-react"

import { DataState } from "@/components/ui/archive-ui"
import { formatDisclosureBound, formatDisclosureRange, INITIAL_DIRECTORY_ROWS, snapshotMatches } from "@/lib/financial-ui.mjs"
import type { FinancialSnapshot } from "@/lib/services/financial"

export function NetWorthDirectory({ snapshots }: { snapshots: FinancialSnapshot[] }) {
  const [query, setQuery] = useState("")
  const [year, setYear] = useState("all")
  const [chamber, setChamber] = useState("all")
  const [visibleCount, setVisibleCount] = useState(INITIAL_DIRECTORY_ROWS)
  const years = useMemo(() => [...new Set(snapshots.map((snapshot) => snapshot.reporting_year))].sort((a, b) => b - a), [snapshots])
  const filtered = useMemo(
    () => snapshots.filter((snapshot) => snapshotMatches(snapshot, { query, year, chamber })),
    [chamber, query, snapshots, year],
  )

  return (
    <section className="networth-directory" aria-labelledby="networth-results-heading">
      {/* React 18 JSX types do not yet include the HTML search element. */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <div className="networth-workbench" role="search">
        <label className="candidate-search"><Search size={17} /><span className="sr-only">Search disclosure snapshots</span><input type="search" placeholder="Member, state, or Bioguide ID" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(INITIAL_DIRECTORY_ROWS) }} /></label>
        <label className="candidate-select"><span className="sr-only">Reporting year</span><select value={year} onChange={(event) => { setYear(event.target.value); setVisibleCount(INITIAL_DIRECTORY_ROWS) }}><option value="all">All filing years</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
        <label className="candidate-select"><span className="sr-only">Chamber</span><select value={chamber} onChange={(event) => { setChamber(event.target.value); setVisibleCount(INITIAL_DIRECTORY_ROWS) }}><option value="all">Both chambers</option><option value="house">House</option><option value="senate">Senate</option></select><ChevronDown size={14} /></label>
        <div className="candidate-result-scope" aria-live="polite"><strong>{filtered.length.toLocaleString()}</strong> of {snapshots.length.toLocaleString()} snapshots</div>
      </div>

      <div className="networth-section-heading"><div><span className="archive-panel-kicker">Calculated from reported ranges</span><h2 id="networth-results-heading">Net-worth snapshots</h2></div><p>Assets minimum minus liabilities maximum forms the lower bound. Assets maximum minus liabilities minimum forms the upper bound when all values are finite.</p></div>

      {filtered.length === 0 ? <DataState title="No snapshots match these filters" description="Clear a filter or search another member. This filtered result does not imply that no disclosure exists outside the loaded coverage." /> : (
        <div className="networth-record-list">
          {filtered.slice(0, visibleCount).map((snapshot, index) => {
            const rangeMax = snapshot.net_worth_max
            const rangeMin = snapshot.net_worth_min
            const hasFiniteSpan = rangeMax !== null && rangeMin !== null && rangeMax > rangeMin
            const position = hasFiniteSpan ? Math.max(8, Math.min(92, (Math.abs(rangeMin) / (Math.abs(rangeMin) + Math.abs(rangeMax))) * 100)) : 100
            return (
              <article className="networth-record" key={`${snapshot.bioguide_id}-${snapshot.reporting_year}`} style={{ "--row-index": Math.min(index, 7) } as React.CSSProperties}>
                <header><div><span>{snapshot.reporting_year} annual filing</span><h3><Link href={`/legislators/${snapshot.bioguide_id}`}>{snapshot.member_name}</Link></h3><p>{snapshot.chamber} · {snapshot.state} · {snapshot.bioguide_id}</p></div><Link className="networth-profile-link" href={`/legislators/${snapshot.bioguide_id}`}>Member record <ArrowRight size={14} /></Link></header>
                <div className="networth-range"><strong>{formatDisclosureRange(snapshot)}</strong><div className="networth-range-track" aria-hidden="true"><span style={{ width: `${position}%` }} /></div><div><span>{formatDisclosureBound(snapshot.net_worth_min, snapshot.lower_bound_unavailable, "lower")}</span><span>{formatDisclosureBound(snapshot.net_worth_max, snapshot.upper_bound_unavailable, "upper")}</span></div></div>
                <dl className="networth-components"><div><dt>Reported assets</dt><dd>{formatDisclosureBound(snapshot.asset_min, false, "lower")} to {formatDisclosureBound(snapshot.asset_max, snapshot.asset_max === null, "upper")}</dd></div><div><dt>Reported liabilities</dt><dd>{formatDisclosureBound(snapshot.liability_min, false, "lower")} to {formatDisclosureBound(snapshot.liability_max, snapshot.liability_max === null, "upper")}</dd></div><div><dt>Calculated</dt><dd>{new Date(snapshot.calculated_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</dd></div></dl>
                {(snapshot.personal_residence_unavailable || snapshot.methodology_warnings.length > 0) ? <div className="networth-caveats">{snapshot.personal_residence_unavailable ? <span><Home size={14} /> Personal residence value unavailable and not treated as zero.</span> : null}{snapshot.methodology_warnings.map((warning) => <span key={warning}><AlertTriangle size={14} /> {warning}</span>)}</div> : null}
              </article>
            )
          })}
        </div>
      )}
      {filtered.length > visibleCount ? <div className="candidate-load-more"><button type="button" onClick={() => setVisibleCount((count) => count + INITIAL_DIRECTORY_ROWS)}>Show {Math.min(INITIAL_DIRECTORY_ROWS, filtered.length - visibleCount)} more snapshots</button></div> : null}
    </section>
  )
}
