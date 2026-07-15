import { useMemo } from "react"
import { Map as MapIcon, MapPin } from "lucide-react"
import type { MapView } from "./election-map-render"
import {
  ALL_OFFICES,
  METRIC_LABELS,
  OFFICE_LABELS,
  metricValue,
  type CountyFips,
  type Metric,
  type Office,
  type StateAggregate,
  type StateFips,
} from "./election-map-helpers"

export function metricMax(aggregates: Map<StateFips, StateAggregate>, metric: Metric): number {
  let max = 0
  for (const row of aggregates.values()) {
    const v = metricValue(row, metric)
    if (v > max) max = v
  }
  return max
}

export function NationalDetail({
  aggregates,
  metric,
  cycle,
}: {
  aggregates: Map<StateFips, StateAggregate>
  metric: Metric
  cycle: number
}) {
  const totals = useMemo(() => {
    let total = 0
    let dem = 0
    let rep = 0
    let ind = 0
    let other = 0
    let incumbents = 0
    let open = 0
    let statesWithData = 0
    for (const row of aggregates.values()) {
      total += row.total
      dem += row.democratic
      rep += row.republican
      ind += row.independent
      other += row.other
      incumbents += row.incumbents
      open += row.open
      if (row.total > 0) statesWithData += 1
    }
    return { total, dem, rep, ind, other, incumbents, open, statesWithData }
  }, [aggregates])

  const totalParties = totals.dem + totals.rep + totals.ind + totals.other || 1
  const meta = METRIC_LABELS[metric]

  if (totals.total === 0) {
    return (
      <div className="election-map-detail-scroll">
        <div className="election-map-empty">
          <h3 className="election-map-empty-title">No candidate rows for this office</h3>
          <p className="election-map-empty-note">
            The FEC pipeline has not loaded any rows for cycle {cycle} under{" "}
            {OFFICE_LABELS[ALL_OFFICES[0]]}. Try a different office or cycle.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="election-map-detail-scroll">
      <div className="election-map-detail-section">
        <div className="election-map-kicker">National overview</div>
        <h3 className="election-map-detail-title">United States</h3>
        <p className="election-map-detail-subtitle">
          Cycle {cycle} · {totals.statesWithData} of 50 states with FEC rows
        </p>
      </div>
      <div className="election-map-stats-strip" aria-label="National summary">
        <Stat label="Candidate rows" value={String(totals.total)} />
        <Stat label="Incumbents" value={String(totals.incumbents)} />
        <Stat label="Open seats" value={String(totals.open)} />
        <Stat label="States with rows" value={String(totals.statesWithData)} />
      </div>
      <div className="election-map-detail-section">
        <div className="election-map-kicker">Reported party · {meta}</div>
        <div className="election-map-bar-list">
          <BarRow label="Democratic" value={totals.dem} total={totalParties} cls="dem" />
          <BarRow label="Republican" value={totals.rep} total={totalParties} cls="rep" />
          <BarRow label="Independent" value={totals.ind} total={totalParties} cls="ind" />
          <BarRow label="Other" value={totals.other} total={totalParties} cls="neutral" />
        </div>
      </div>
      <div className="election-map-detail-section">
        <p className="election-map-source-note">
          Click any state on the map to zoom into its county-level geography.
          Aggregated from FEC candidate filings. Party counts describe reported
          filings, not vote share, election results, competitiveness, or a forecast.
          Empty map cells are states without loaded rows.
        </p>
      </div>
    </div>
  )
}

export function StateDetail({
  aggregate,
  metric,
}: {
  aggregate: StateAggregate | null
  metric: Metric
}) {
  const total = aggregate?.total ?? 0
  const totalParties = aggregate
    ? aggregate.democratic + aggregate.republican + aggregate.independent + aggregate.other || 1
    : 1
  const meta = METRIC_LABELS[metric]
  const topDistricts = useMemo(() => {
    if (!aggregate) return []
    return Array.from(aggregate.districts.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
  }, [aggregate])

  if (!aggregate) {
    return (
      <div className="election-map-detail-scroll">
        <div className="election-map-empty">
          <h3 className="election-map-empty-title">No candidate rows for this state</h3>
          <p className="election-map-empty-note">
            The FEC pipeline has not loaded rows for this state in this cycle.
            Switch offices, or pick a different state from the map or table.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="election-map-detail-scroll">
      <div className="election-map-detail-section">
        <div className="election-map-detail-header">
          <div>
            <div className="election-map-kicker">State overview · {aggregate.abbr}</div>
            <h3 className="election-map-detail-title">{aggregate.name}</h3>
            <p className="election-map-detail-subtitle">
              {total} candidate row{total === 1 ? "" : "s"} loaded
            </p>
          </div>
        </div>
      </div>
      <div className="election-map-stats-strip" aria-label="State summary">
        <Stat label="Candidates" value={String(total)} />
        <Stat label="Incumbents" value={String(aggregate.incumbents)} />
        <Stat label="Challengers" value={String(aggregate.challengers)} />
        <Stat label="Open seats" value={String(aggregate.open)} />
      </div>
      <div className="election-map-detail-section">
        <div className="election-map-kicker">Reported party · {meta}</div>
        <div className="election-map-bar-list">
          <BarRow label="Democratic" value={aggregate.democratic} total={totalParties} cls="dem" />
          <BarRow label="Republican" value={aggregate.republican} total={totalParties} cls="rep" />
          <BarRow label="Independent" value={aggregate.independent} total={totalParties} cls="ind" />
          <BarRow label="Other" value={aggregate.other} total={totalParties} cls="neutral" />
        </div>
      </div>
      {topDistricts.length > 0 ? (
        <div className="election-map-detail-section">
          <div className="election-map-kicker">Top districts</div>
          <div className="election-map-bar-list">
            {topDistricts.map((d) => (
              <div key={d.district} className="election-map-bar-row">
                <div className="election-map-bar-meta">
                  <span>
                    {aggregate.abbr}-{d.district === "00" ? "At-Large" : d.district}
                  </span>
                  <strong>{d.total} row{d.total === 1 ? "" : "s"}</strong>
                </div>
                <div className="election-map-bar-track">
                  <div
                    className="election-map-bar-fill dem"
                    style={{ width: `${(d.democratic / Math.max(1, d.total)) * 100}%` }}
                  />
                  <div
                    className="election-map-bar-fill rep"
                    style={{ width: `${(d.republican / Math.max(1, d.total)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="election-map-detail-section">
        <p className="election-map-source-note">
          Click any county on the map to drill into local geography. Same FEC
          candidate filings that color the state map. Filing counts are not vote
          share, election results, competitiveness, or a forecast. Empty fields
          are not treated as zero.
        </p>
      </div>
    </div>
  )
}

export function CountyDetail({
  countyFips,
  countyName,
  stateAbbr,
  stateName,
}: {
  countyFips: CountyFips
  countyName: string
  stateAbbr: string
  stateName: string
}) {
  return (
    <div className="election-map-detail-scroll">
      <div className="election-map-detail-section">
        <div className="election-map-detail-header">
          <div>
            <div className="election-map-kicker">Local view · {stateAbbr}</div>
            <h3 className="election-map-detail-title">{countyName}</h3>
            <p className="election-map-detail-subtitle">
              FIPS {countyFips} · {stateName}
            </p>
          </div>
          <span className="election-map-pill election-map-pill--neutral">Local</span>
        </div>
      </div>
      <div className="election-map-stats-strip" aria-label="County summary">
        <Stat label="Result rows" value="Not loaded" />
        <Stat label="Geometry" value="Available" />
        <Stat label="County FIPS" value={countyFips} />
      </div>
      <div className="election-map-detail-section">
        <div className="election-map-kicker">What this view proves</div>
        <p className="election-map-source-note">
          The boundary and county identity are sourced from the U.S. Census
          Bureau. The loaded FEC candidate records are state and congressional
          district filings, so they cannot be truthfully assigned to this
          county. Result rows remain labeled not loaded instead of zero.
        </p>
      </div>
      <div className="election-map-detail-section">
        <div className="election-map-kicker">Primary sources</div>
        <div className="election-map-source-links">
          <a
            href="https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer"
            target="_blank"
            rel="noreferrer"
          >
            Census TIGERweb county layer
          </a>
          <a
            href="https://www.eac.gov/voters/register-and-vote-in-your-state"
            target="_blank"
            rel="noreferrer"
          >
            Find {stateName} election authorities
          </a>
          <a href="https://www.fec.gov/data/candidates/" target="_blank" rel="noreferrer">
            FEC federal candidate filings
          </a>
        </div>
      </div>
    </div>
  )
}

export function CountyDirectory({
  rows,
  stateName,
  selectedCounty,
  search,
  loading,
  error,
  preparedAt,
  onSelect,
}: {
  rows: Array<{ fips: CountyFips; name: string }>
  stateName: string
  selectedCounty: CountyFips | null
  search: string
  loading: boolean
  error: string | null
  preparedAt: string | null
  onSelect: (fips: CountyFips) => void
}) {
  const normalizedSearch = search.trim().toLowerCase()
  const visibleRows = normalizedSearch
    ? rows.filter((row) => row.name.toLowerCase().includes(normalizedSearch))
    : rows

  return (
    <section className="election-county-directory" aria-label={`${stateName} county directory`}>
      <div className="election-map-table-head">
        <div>
          <div className="election-map-kicker">Accessible map alternative</div>
          <h3 className="election-map-table-title">{stateName} counties</h3>
        </div>
        <span className="election-map-data-status" data-loading={loading} data-error={Boolean(error)}>
          {loading
            ? "Loading Census county names"
            : error
              ? "County names unavailable"
              : `${visibleRows.length} of ${rows.length} counties`}
        </span>
      </div>
      {error ? (
        <div className="election-county-directory-state">
          <strong>County geography could not be refreshed.</strong>
          <span>{error}. The map keeps Census boundary FIPS labels without inventing names.</span>
        </div>
      ) : loading ? (
        <div className="election-county-directory-state">Loading the state-scoped Census county directory.</div>
      ) : visibleRows.length === 0 ? (
        <div className="election-county-directory-state">No county name matches the current search.</div>
      ) : (
        <div className="election-county-list" aria-label={`${stateName} counties`}>
          {visibleRows.map((row) => (
            <button
              key={row.fips}
              type="button"
              className={`election-county-list-item${selectedCounty === row.fips ? " is-selected" : ""}`}
              aria-pressed={selectedCounty === row.fips}
              onClick={() => onSelect(row.fips)}
            >
              <span>{row.name}</span>
              <small>FIPS {row.fips}</small>
            </button>
          ))}
        </div>
      )}
      <footer className="election-county-directory-footer">
        <span>Names: U.S. Census Bureau TIGERweb</span>
        <span>Election results: not loaded</span>
        {preparedAt ? (
          <span>
            Prepared {new Date(preparedAt).toLocaleDateString(undefined, { timeZone: "UTC" })}
          </span>
        ) : null}
      </footer>
    </section>
  )
}

export function RaceTable({
  aggregates,
  office,
  onRowClick,
  selectedFips,
}: {
  aggregates: Map<StateFips, StateAggregate>
  office: Office
  onRowClick: (fips: StateFips) => void
  selectedFips: StateFips | null
}) {
  const rows = useMemo(() => {
    return Array.from(aggregates.entries())
      .filter(([, row]) => row.total > 0)
      .map(([fips, row]) => ({ fips, row }))
      .sort((a, b) => b.row.total - a.row.total || a.row.name.localeCompare(b.row.name))
      .slice(0, 12)
  }, [aggregates])

  return (
    <section className="election-map-table" aria-label="States with the most candidate filings">
      <div className="election-map-table-head">
        <h3 className="election-map-table-title">States with the most candidate filings</h3>
        <span className="election-map-data-status" data-loading="false" data-error="false">
          {rows.length} of {aggregates.size} states · {OFFICE_LABELS[office]}
        </span>
      </div>
      <div className="election-map-table-wrap">
        <table>
          <thead>
            <tr>
              <th>State</th>
              <th>Candidates</th>
              <th>Incumbents</th>
              <th>Open seats</th>
              <th>Reported party mix</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="election-map-table-empty">
                  No candidate rows for this office in this cycle. Try another office
                  or widen the cycle.
                </td>
              </tr>
            ) : (
              rows.map(({ fips, row }) => {
                return (
                  <tr
                    key={fips}
                    onClick={() => onRowClick(fips)}
                    className={selectedFips === fips ? "is-selected" : ""}
                  >
                    <td>
                      <button type="button" className="election-map-race-link">
                        {row.name} ({row.abbr})
                      </button>
                    </td>
                    <td>{row.total}</td>
                    <td>{row.incumbents}</td>
                    <td>{row.open}</td>
                    <td className="font-mono text-xs">
                      D {row.democratic} · R {row.republican} · Other {row.independent + row.other}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="election-map-stat">
      <span className="election-map-stat-label">{label}</span>
      <strong className="election-map-stat-value">{value}</strong>
    </div>
  )
}

function BarRow({
  label,
  value,
  total,
  cls,
}: {
  label: string
  value: number
  total: number
  cls: "dem" | "rep" | "ind" | "neutral"
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="election-map-bar-row">
      <div className="election-map-bar-meta">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="election-map-bar-track">
        <div className={`election-map-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Legend({
  view,
  metric,
  maxValue,
}: {
  view: MapView
  metric: Metric
  maxValue: number
}) {
  if (view !== "national") {
    return (
      <div className="election-map-legend" aria-hidden="true">
        <div className="election-map-legend-title">County boundaries</div>
        <div className="election-map-legend-items">
          <span className="election-map-legend-item">
            <i className="election-map-swatch" data-lean="no-data" />
            Click any county
          </span>
          <span className="election-map-legend-item">
            <MapIcon size={11} aria-hidden="true" style={{ color: "var(--election-dem)" }} />
            Drill into local view
          </span>
        </div>
      </div>
    )
  }
  const label = METRIC_LABELS[metric]
  return (
    <div className="election-map-legend" aria-hidden="true">
      <div className="election-map-legend-title">{label}</div>
      <div className="election-map-legend-gradient">
        <span>0</span>
        <div className="election-map-gradient-bar" data-metric={metric} />
        <span>{maxValue > 0 ? maxValue : "—"}</span>
      </div>
    </div>
  )
}

export function MapTooltip({
  clientX,
  clientY,
  row,
  abbr,
  name,
  metric,
  tooltipType,
}: {
  clientX: number
  clientY: number
  row: StateAggregate | null
  abbr: string
  name: string
  metric: Metric
  tooltipType: "state" | "county"
}) {
  return (
    <div
      className="election-map-tooltip-card"
      style={{ left: clientX, top: clientY }}
      aria-live="polite"
    >
      <div className="election-map-tooltip-title">
        <MapPin size={12} aria-hidden="true" />
        {name || "Unknown"}{abbr ? ` (${abbr})` : ""}
      </div>
      <div className="election-map-tooltip-grid">
        {tooltipType === "county" ? (
          <>
            <span>Geography</span>
            <strong>Available</strong>
            <span>Election results</span>
            <strong>Not loaded</strong>
          </>
        ) : (
          <>
            <span>Total rows</span>
            <strong>{row?.total ?? 0}</strong>
            <span>Democratic</span>
            <strong>{row?.democratic ?? 0}</strong>
            <span>Republican</span>
            <strong>{row?.republican ?? 0}</strong>
            <span>Independent / other</span>
            <strong>{(row?.independent ?? 0) + (row?.other ?? 0)}</strong>
            <span>Incumbents</span>
            <strong>{row?.incumbents ?? 0}</strong>
            <span>Open seats</span>
            <strong>{row?.open ?? 0}</strong>
            <span>{METRIC_LABELS[metric]}</span>
            <strong>
              {metricValue(row ?? undefined, metric)}
            </strong>
          </>
        )}
      </div>
    </div>
  )
}
