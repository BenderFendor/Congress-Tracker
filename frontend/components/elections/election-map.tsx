"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react"
import {
  Search,
  RotateCcw,
  Link2,
  ChevronRight,
  Vote,
  MapPin,
  Building2,
  Map as MapIcon,
} from "lucide-react"
import type { FECandidate } from "@/lib/services/fec"
import statesJson from "us-atlas/states-10m.json"
import countiesJson from "us-atlas/counties-10m.json"
import { renderStateMap, type MapView } from "./election-map-render"
import {
  ALL_METRICS,
  ALL_OFFICES,
  ALL_VIEWS,
  METRIC_LABELS,
  OFFICE_LABELS,
  STATE_FIPS_TABLE,
  VIEW_LABELS,
  aggregateCandidates,
  competitivenessScore,
  isOfficeInCandidate,
  metricValue,
  partyLean,
  pillClassForRating,
  ratingLabel,
  topologyToCountyFeatures,
  topologyToStateFeatures,
  type CountyFips,
  type Metric,
  type Office,
  type StateAggregate,
  type StateFips,
  type UsAtlasTopology,
  type View,
} from "./election-map-helpers"

const STATES_TOPOLOGY = statesJson as unknown as UsAtlasTopology
const COUNTIES_TOPOLOGY = countiesJson as unknown as UsAtlasTopology

type MapTooltipState = {
  type: "state" | "county" | null
  fips: string
  clientX: number
  clientY: number
}

const NO_TOOLTIP: MapTooltipState = { type: null, fips: "", clientX: 0, clientY: 0 }

type ElectionMapProps = {
  candidates: FECandidate[]
  loading: boolean
  error: string | null
  selectedState: string | null
  selectedCounty?: string | null
  onStateChange: (fips: string | null) => void
  onCountyChange?: (fips: string | null) => void
  defaultOffice?: Office
  defaultMetric?: Metric
  cycle: number
}

export function ElectionMap({
  candidates,
  loading,
  error,
  selectedState,
  selectedCounty,
  onStateChange,
  onCountyChange,
  defaultOffice = "H",
  defaultMetric = "rating",
  cycle,
}: ElectionMapProps) {
  const [office, setOffice] = useState<Office>(defaultOffice)
  const [metric, setMetric] = useState<Metric>(defaultMetric)
  const [view, setView] = useState<MapView>(selectedCounty ? "county" : selectedState ? "state" : "national")
  const [searchInput, setSearchInput] = useState("")
  const [searchActive, setSearchActive] = useState("")
  const [tooltip, setTooltip] = useState<MapTooltipState>(NO_TOOLTIP)
  const [shareToast, setShareToast] = useState<string | null>(null)
  const [countyNames, setCountyNames] = useState<Map<CountyFips, string>>(new Map())
  const svgRef = useRef<SVGSVGElement | null>(null)
  const searchTimer = useRef<number | null>(null)

  useEffect(() => {
    clearTimeout(searchTimer.current ?? undefined)
    searchTimer.current = window.setTimeout(() => {
      setSearchActive(searchInput.trim())
    }, 200)
    return () => clearTimeout(searchTimer.current ?? undefined)
  }, [searchInput])

  useEffect(() => {
    if (selectedCounty) setView("county")
    else if (selectedState) setView("state")
    else setView("national")
  }, [selectedState, selectedCounty])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(
          "https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*",
        )
        if (!res.ok) return
        const rows: string[][] = await res.json()
        const map = new Map<CountyFips, string>()
        for (const row of rows.slice(1)) {
          const [name, stateCode, countyCode] = row
          if (name && stateCode && countyCode) {
            map.set(`${stateCode}${countyCode}`, String(name).replace(/, .*$/, ""))
          }
        }
        if (!cancelled) setCountyNames(map)
      } catch {
        // Census API may be blocked; fall back to FIPS labels.
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const officeCandidates = useMemo(
    () => candidates.filter((c) => isOfficeInCandidate(c, office)),
    [candidates, office],
  )

  const aggregates = useMemo(() => aggregateCandidates(officeCandidates), [officeCandidates])
  const selectedFips: StateFips | null = selectedState ?? null
  const selectedCountyFips: CountyFips | null = selectedCounty ?? null
  const stateFeatures = useMemo(() => topologyToStateFeatures(STATES_TOPOLOGY), [])
  const countyFeatures = useMemo(() => topologyToCountyFeatures(COUNTIES_TOPOLOGY), [])

  const renderMap = useCallback(() => {
    if (!svgRef.current) return
    renderStateMap(svgRef.current, {
      view,
      stateFeatures,
      countyFeatures,
      aggregates,
      selectedState: selectedFips,
      selectedCounty: selectedCountyFips,
      metric,
      searchQuery: searchActive,
      countyNames,
      onSelectState: (fips) => onStateChange(fips === selectedFips ? null : fips),
      onSelectCounty: (fips) => onCountyChange?.(fips),
      onHover: (feature, clientX, clientY) =>
        setTooltip({ type: feature.type, fips: feature.fips, clientX, clientY }),
    })
  }, [
    view,
    stateFeatures,
    countyFeatures,
    aggregates,
    selectedFips,
    selectedCountyFips,
    metric,
    searchActive,
    countyNames,
    onStateChange,
    onCountyChange,
  ])

  useEffect(() => {
    renderMap()
  }, [renderMap])

  useEffect(() => {
    if (!svgRef.current) return
    const ro = new ResizeObserver(() => renderMap())
    ro.observe(svgRef.current)
    return () => ro.disconnect()
  }, [renderMap])

  const tooltipRow = tooltip.fips && tooltip.type === "state"
    ? aggregates.get(tooltip.fips) ?? null
    : null
  const tooltipMeta = tooltip.fips
    ? tooltip.type === "state"
      ? {
          abbr: STATE_FIPS_TABLE[tooltip.fips]?.abbr ?? "",
          name: STATE_FIPS_TABLE[tooltip.fips]?.name ?? "",
        }
      : {
          abbr: STATE_FIPS_TABLE[tooltip.fips.slice(0, 2)]?.abbr ?? "",
          name: countyNames.get(tooltip.fips) ?? `County ${tooltip.fips.slice(2)}`,
        }
    : null

  const resetView = useCallback(() => {
    onStateChange(null)
    onCountyChange?.(null)
    setSearchInput("")
    setSearchActive("")
    setView("national")
    const node = svgRef.current as (SVGSVGElement & { __resetZoom?: () => void }) | null
    node?.__resetZoom?.()
  }, [onStateChange, onCountyChange])

  const goToView = useCallback(
    (target: View) => {
      if (target === "national") {
        onStateChange(null)
        onCountyChange?.(null)
      } else if (target === "state") {
        if (!selectedFips) return
        onCountyChange?.(null)
      }
      setView(target)
    },
    [onStateChange, onCountyChange, selectedFips],
  )

  const copyShareLink = useCallback(async () => {
    try {
      const url = new URL(window.location.href)
      url.search = ""
      url.searchParams.set("office", office)
      url.searchParams.set("metric", metric)
      url.searchParams.set("view", view)
      if (selectedFips) url.searchParams.set("state", selectedFips)
      if (selectedCountyFips) url.searchParams.set("county", selectedCountyFips)
      await navigator.clipboard.writeText(url.href)
      setShareToast("Map link copied to clipboard")
    } catch {
      setShareToast("Clipboard blocked. Copy the URL bar instead.")
    }
  }, [office, metric, view, selectedFips, selectedCountyFips])

  useEffect(() => {
    if (!shareToast) return
    const id = window.setTimeout(() => setShareToast(null), 2400)
    return () => clearTimeout(id)
  }, [shareToast])

  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setSearchInput("")
      setSearchActive("")
    } else if (event.key === "Enter") {
      setSearchActive(searchInput.trim())
      const q = searchInput.trim().toLowerCase()
      if (view === "national") {
        for (const [fips, meta] of Object.entries(STATE_FIPS_TABLE)) {
          if (meta.abbr.toLowerCase() === q || meta.name.toLowerCase() === q) {
            onStateChange(fips)
            return
          }
        }
      } else if (view === "state" && selectedFips) {
        for (const [fips, name] of countyNames.entries()) {
          if (fips.startsWith(selectedFips) && name.toLowerCase() === q) {
            onCountyChange?.(fips)
            return
          }
        }
      }
    }
  }

  const handleOfficeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setOffice(event.target.value as Office)
  }

  const handleMetricChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setMetric(event.target.value as Metric)
  }

  return (
    <div className="election-map-explorer">
      <div className="election-map-toolbar">
        <div className="election-map-toolbar-group">
          <div className="election-map-segments" role="tablist" aria-label="Geographic level">
            {ALL_VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={`election-map-segment${view === v ? " is-active" : ""}`}
                onClick={() => goToView(v)}
                disabled={v !== "national" && !selectedFips}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          <label className="election-map-field">
            <span className="sr-only">Office</span>
            <Building2 className="election-map-field-icon" size={14} aria-hidden="true" />
            <select value={office} onChange={handleOfficeChange} aria-label="Office filter">
              {ALL_OFFICES.map((o) => (
                <option key={o} value={o}>
                  {OFFICE_LABELS[o]}
                </option>
              ))}
            </select>
          </label>
          <label className="election-map-field">
            <span className="sr-only">Map metric</span>
            <Vote className="election-map-field-icon" size={14} aria-hidden="true" />
            <select value={metric} onChange={handleMetricChange} aria-label="Map metric">
              {ALL_METRICS.map((m) => (
                <option key={m} value={m}>
                  {METRIC_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="election-map-toolbar-divider" aria-hidden="true" />
        <div className="election-map-toolbar-group">
          <label className="election-map-field election-map-search">
            <Search className="election-map-field-icon" size={14} aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder={view === "county" ? "Search a county" : "Search a state"}
              aria-label={view === "county" ? "Search a county" : "Search a state"}
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("")
                  setSearchActive("")
                }}
                className="election-map-clear"
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </label>
          <button
            type="button"
            onClick={copyShareLink}
            className="election-map-icon-btn"
            aria-label="Copy share link"
            title="Copy share link"
          >
            <Link2 size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="election-map-icon-btn"
            aria-label="Reset map view"
            title="Reset view"
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="election-map-grid">
        <section className="election-map-stage" aria-label="Interactive election map">
          <div className="election-map-header">
            <div className="election-map-breadcrumb">
              <button
                type="button"
                onClick={() => goToView("national")}
                className="election-map-breadcrumb-link"
                aria-pressed={view === "national"}
              >
                United States
              </button>
              {selectedFips ? (
                <>
                  <ChevronRight size={12} aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => goToView("state")}
                    className="election-map-breadcrumb-link"
                    aria-pressed={view === "state"}
                  >
                    {STATE_FIPS_TABLE[selectedFips]?.name ?? "Unknown state"}
                  </button>
                </>
              ) : (
                <>
                  <ChevronRight size={12} aria-hidden="true" />
                  <span className="text-muted-foreground">All states</span>
                </>
              )}
              {selectedCountyFips ? (
                <>
                  <ChevronRight size={12} aria-hidden="true" />
                  <strong>
                    {countyNames.get(selectedCountyFips) ?? `County ${selectedCountyFips.slice(2)}`}
                  </strong>
                </>
              ) : null}
            </div>
            <div
              className="election-map-data-status"
              data-loading={loading ? "true" : "false"}
              data-error={error ? "true" : "false"}
            >
              {loading
                ? "Loading candidate rows..."
                : error
                  ? "FEC request failed"
                  : view === "county"
                    ? `County view · ${officeCandidates.length} state rows · cycle ${cycle}`
                    : `${officeCandidates.length} rows · cycle ${cycle}`}
            </div>
          </div>
          <div className="election-map-svg-wrap">
            <svg
              ref={svgRef}
              aria-label={`Map of U.S. ${OFFICE_LABELS[office]} activity, ${cycle} cycle`}
              className="election-map-svg"
            >
              <title>{`Map of U.S. ${OFFICE_LABELS[office]} activity, ${cycle} cycle`}</title>
            </svg>
            <Legend
              view={view}
              metric={metric}
              maxValue={metricMax(aggregates, metric)}
            />
          </div>
          {tooltip.fips && tooltipMeta ? (
            <MapTooltip
              clientX={tooltip.clientX}
              clientY={tooltip.clientY}
              row={tooltipRow}
              abbr={tooltipMeta.abbr}
              name={tooltipMeta.name}
              metric={metric}
              tooltipType={tooltip.type ?? "state"}
            />
          ) : null}
        </section>

        <aside className="election-map-detail" aria-live="polite">
          {view === "county" && selectedCountyFips && selectedFips ? (
            <CountyDetail
              countyFips={selectedCountyFips}
              countyName={countyNames.get(selectedCountyFips) ?? `County ${selectedCountyFips.slice(2)}`}
              stateAbbr={STATE_FIPS_TABLE[selectedFips]?.abbr ?? ""}
              stateName={STATE_FIPS_TABLE[selectedFips]?.name ?? ""}
            />
          ) : view === "state" && selectedFips ? (
            <StateDetail
              aggregate={aggregates.get(selectedFips) ?? null}
              metric={metric}
            />
          ) : (
            <NationalDetail aggregates={aggregates} metric={metric} cycle={cycle} />
          )}
        </aside>
      </div>

      <RaceTable
        aggregates={aggregates}
        office={office}
        onRowClick={(fips) => onStateChange(fips === selectedFips ? null : fips)}
        selectedFips={selectedFips}
      />

      {shareToast ? <output className="election-map-toast">{shareToast}</output> : null}
    </div>
  )
}

function metricMax(aggregates: Map<StateFips, StateAggregate>, metric: Metric): number {
  if (metric === "rating") return 1
  let max = 0
  for (const row of aggregates.values()) {
    const v = metricValue(row, metric)
    if (v > max) max = v
  }
  return max
}

function NationalDetail({
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
    let tossUps = 0
    let statesWithData = 0
    for (const row of aggregates.values()) {
      total += row.total
      dem += row.democratic
      rep += row.republican
      ind += row.independent
      other += row.other
      incumbents += row.incumbents
      open += row.open
      if (ratingLabel(row) === "Toss-up") tossUps += 1
      if (row.total > 0) statesWithData += 1
    }
    return { total, dem, rep, ind, other, incumbents, open, tossUps, statesWithData }
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
        <Stat label="Toss-up" value={String(totals.tossUps)} />
      </div>
      <div className="election-map-detail-section">
        <div className="election-map-kicker">Party share · {meta}</div>
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
          Aggregated from FEC candidate rows. Empty map cells are states without
          loaded rows — they are not contested races.
        </p>
      </div>
    </div>
  )
}

function StateDetail({
  aggregate,
  metric,
}: {
  aggregate: StateAggregate | null
  metric: Metric
}) {
  const rating = ratingLabel(aggregate ?? undefined)
  const pillCls = pillClassForRating(rating)
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
          <span className={`election-map-pill election-map-pill--${pillCls}`}>{rating}</span>
        </div>
      </div>
      <div className="election-map-stats-strip" aria-label="State summary">
        <Stat label="Candidates" value={String(total)} />
        <Stat label="Incumbents" value={String(aggregate.incumbents)} />
        <Stat label="Challengers" value={String(aggregate.challengers)} />
        <Stat label="Open seats" value={String(aggregate.open)} />
      </div>
      <div className="election-map-detail-section">
        <div className="election-map-kicker">Party share · {meta}</div>
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
          rows that color the state map. No modeled spending or turnout;
          empty fields are not treated as zero.
        </p>
      </div>
    </div>
  )
}

function CountyDetail({
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
        <Stat label="Total rows" value="0" />
        <Stat label="Democratic" value="—" />
        <Stat label="Republican" value="—" />
        <Stat label="Other" value="—" />
      </div>
      <div className="election-map-detail-section">
        <div className="election-map-kicker">Geography</div>
        <p className="election-map-source-note">
          County outlines load from the public U.S. Census Bureau boundary
          geometry. State and district-level FEC filings do not break down to
          individual counties — the federal pipeline reports at the
          congressional-district level. Local candidate filings would come
          from the county election office or the state campaign-finance
          portal.
        </p>
      </div>
      <div className="election-map-detail-section">
        <p className="election-map-source-note">
          When county-level data is published, this view will show
          per-county candidate counts, party share, and filing activity.
        </p>
      </div>
    </div>
  )
}

function RaceTable({
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
      .map(([fips, row]) => ({
        fips,
        row,
        competitiveness: competitivenessScore(row),
      }))
      .sort((a, b) => a.competitiveness - b.competitiveness || b.row.total - a.row.total)
      .slice(0, 12)
  }, [aggregates])

  return (
    <section className="election-map-table" aria-label="Most competitive states">
      <div className="election-map-table-head">
        <h3 className="election-map-table-title">Most competitive state races</h3>
        <span className="election-map-data-status" data-loading="false" data-error="false">
          {rows.length} of {aggregates.size} states · {OFFICE_LABELS[office]}
        </span>
      </div>
      <div className="election-map-table-wrap">
        <table>
          <thead>
            <tr>
              <th>State</th>
              <th>Rating</th>
              <th>Candidates</th>
              <th>Incumbents</th>
              <th>Party lean</th>
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
                const rating = ratingLabel(row)
                const pillCls = pillClassForRating(rating)
                const lean = partyLean(row)
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
                    <td>
                      <span className={`election-map-pill election-map-pill--${pillCls}`}>
                        {rating}
                      </span>
                    </td>
                    <td>{row.total}</td>
                    <td>{row.incumbents}</td>
                    <td className="font-mono text-xs">
                      {lean > 0
                        ? `+${(lean * 100).toFixed(0)} D`
                        : lean < 0
                          ? `${(lean * 100).toFixed(0)} R`
                          : "0"}
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

function Legend({
  view,
  metric,
  maxValue,
}: {
  view: MapView
  metric: Metric
  maxValue: number
}) {
  if (view === "state") {
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
  if (metric === "rating") {
    return (
      <div className="election-map-legend" aria-hidden="true">
        <div className="election-map-legend-title">Party lean</div>
        <div className="election-map-legend-items">
          <span className="election-map-legend-item">
            <i className="election-map-swatch" data-lean="safe-d" />
            Strong D
          </span>
          <span className="election-map-legend-item">
            <i className="election-map-swatch" data-lean="tilt-d" />
            Tilt D
          </span>
          <span className="election-map-legend-item">
            <i className="election-map-swatch" data-lean="toss-up" />
            Toss-up
          </span>
          <span className="election-map-legend-item">
            <i className="election-map-swatch" data-lean="tilt-r" />
            Tilt R
          </span>
          <span className="election-map-legend-item">
            <i className="election-map-swatch" data-lean="safe-r" />
            Strong R
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

function MapTooltip({
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
  const rating = ratingLabel(row ?? undefined)
  const pillCls = pillClassForRating(rating)
  const lean = partyLean(row ?? undefined)
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
        <span>{tooltipType === "county" ? "County" : "Rating"}</span>
        <strong>
          {tooltipType === "county" ? (
            <span className="election-map-pill election-map-pill--neutral">Local</span>
          ) : (
            <span className={`election-map-pill election-map-pill--${pillCls}`}>{rating}</span>
          )}
        </strong>
        <span>Total rows</span>
        <strong>{row?.total ?? 0}</strong>
        <span>Democratic</span>
        <strong>{row?.democratic ?? 0}</strong>
        <span>Republican</span>
        <strong>{row?.republican ?? 0}</strong>
        <span>Incumbents</span>
        <strong>{row?.incumbents ?? 0}</strong>
        <span>Open seats</span>
        <strong>{row?.open ?? 0}</strong>
        <span>{METRIC_LABELS[metric]}</span>
        <strong>
          {metric === "rating"
            ? lean === 0
              ? "0"
              : `${lean > 0 ? "+" : ""}${(lean * 100).toFixed(0)}%`
            : metricValue(row ?? undefined, metric)}
        </strong>
      </div>
    </div>
  )
}
