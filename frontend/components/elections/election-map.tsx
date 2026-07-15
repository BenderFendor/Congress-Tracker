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
} from "lucide-react"
import type { FECandidate } from "@/lib/services/fec"
import { SUPPORTED_JURISDICTIONS } from "@/lib/county-geography.mjs"
import statesJson from "us-atlas/states-10m.json"
import countiesJson from "us-atlas/counties-10m.json"
import { renderStateMap, type MapView } from "./election-map-render"
import {
  CountyDetail,
  CountyDirectory,
  Legend,
  MapTooltip,
  NationalDetail,
  RaceTable,
  StateDetail,
  metricMax,
} from "./election-map-panels"
import {
  ALL_METRICS,
  ALL_OFFICES,
  ALL_VIEWS,
  METRIC_LABELS,
  OFFICE_LABELS,
  STATE_FIPS_TABLE,
  VIEW_LABELS,
  aggregateCandidates,
  isOfficeInCandidate,
  topologyToCountyFeatures,
  topologyToStateFeatures,
  type CountyFips,
  type CountyFeature,
  type Metric,
  type Office,
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

type CountyGeographyResponse = {
  data: Array<{ fips: string; name: string; geometry: CountyFeature["geometry"] }>
  meta: {
    coverage: "geometry_and_names" | "unavailable"
    results_coverage: "not_loaded"
    prepared_at: string
    source: { label: string; url: string }
  }
}

const NO_TOOLTIP: MapTooltipState = { type: null, fips: "", clientX: 0, clientY: 0 }
const STATE_JURISDICTIONS = SUPPORTED_JURISDICTIONS.filter(({ territory }) => !territory)
const TERRITORY_JURISDICTIONS = SUPPORTED_JURISDICTIONS.filter(({ territory }) => territory)

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
  defaultMetric = "candidates",
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
  const [countyRows, setCountyRows] = useState<Array<{ fips: CountyFips; name: string }>>([])
  const [countyGeometryFeatures, setCountyGeometryFeatures] = useState<CountyFeature[]>([])
  const [countyLoading, setCountyLoading] = useState(false)
  const [countyError, setCountyError] = useState<string | null>(null)
  const [countyPreparedAt, setCountyPreparedAt] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const searchTimer = useRef<number | null>(null)
  const selectedFips: StateFips | null = selectedState ?? null
  const selectedCountyFips: CountyFips | null = selectedCounty ?? null

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
    if (!selectedFips) {
      setCountyRows([])
      setCountyGeometryFeatures([])
      setCountyNames(new Map())
      setCountyError(null)
      setCountyPreparedAt(null)
      return
    }

    const controller = new AbortController()
    setCountyLoading(true)
    setCountyError(null)
    setCountyPreparedAt(null)
    fetch(`/api/elections/counties?state=${selectedFips}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`County geography request returned ${response.status}`)
        return response.json() as Promise<CountyGeographyResponse>
      })
      .then((response) => {
        const rows = response.data.map((row) => ({ ...row, fips: row.fips as CountyFips }))
        setCountyRows(rows.map(({ fips, name }) => ({ fips, name })))
        setCountyGeometryFeatures(rows.map((row) => ({
          type: "Feature",
          id: row.fips,
          properties: { name: row.name },
          geometry: row.geometry,
        })))
        setCountyNames(new Map(rows.map((row) => [row.fips, row.name])))
        setCountyPreparedAt(response.meta.prepared_at)
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return
        setCountyRows([])
        setCountyGeometryFeatures([])
        setCountyNames(new Map())
        setCountyError(requestError instanceof Error ? requestError.message : "County geography request failed")
      })
      .finally(() => {
        if (!controller.signal.aborted) setCountyLoading(false)
      })
    return () => controller.abort()
  }, [selectedFips])

  const officeCandidates = useMemo(
    () => candidates.filter((c) => isOfficeInCandidate(c, office)),
    [candidates, office],
  )

  const aggregates = useMemo(() => aggregateCandidates(officeCandidates), [officeCandidates])
  const stateFeatures = useMemo(() => topologyToStateFeatures(STATES_TOPOLOGY), [])
  const countyFeatures = useMemo(() => topologyToCountyFeatures(COUNTIES_TOPOLOGY), [])
  const activeCountyFeatures = countyGeometryFeatures.length > 0
    ? countyGeometryFeatures
    : countyFeatures

  const renderMap = useCallback(() => {
    if (!svgRef.current) return
    renderStateMap(svgRef.current, {
      view,
      stateFeatures,
      countyFeatures: activeCountyFeatures,
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
    activeCountyFeatures,
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
      } else if (selectedFips) {
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
            <MapPin className="election-map-field-icon" size={14} aria-hidden="true" />
            <span className="sr-only">State geography</span>
            <select
              value={selectedFips ?? ""}
              onChange={(event) => onStateChange(event.target.value || null)}
              aria-label="State geography"
            >
              <option value="">Choose a state</option>
              <optgroup label="States and District of Columbia">
                {STATE_JURISDICTIONS.map(({ fips, name }) => (
                  <option key={fips} value={fips}>{name}</option>
                ))}
              </optgroup>
              <optgroup label="U.S. territories">
                {TERRITORY_JURISDICTIONS.map(({ fips, name }) => (
                  <option key={fips} value={fips}>{name}</option>
                ))}
              </optgroup>
            </select>
          </label>
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
              placeholder={selectedFips ? "Search counties" : "Search states"}
              aria-label={selectedFips ? "Search counties" : "Search states"}
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
                    ? `${countyRows.length || "No"} named counties · results not loaded`
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
          ) : selectedFips ? (
            <StateDetail
              aggregate={aggregates.get(selectedFips) ?? null}
              metric={metric}
            />
          ) : (
            <NationalDetail aggregates={aggregates} metric={metric} cycle={cycle} />
          )}
        </aside>
      </div>

      {selectedFips ? (
        <CountyDirectory
          rows={countyRows}
          stateName={STATE_FIPS_TABLE[selectedFips]?.name ?? "Selected state"}
          selectedCounty={selectedCountyFips}
          search={searchActive}
          loading={countyLoading}
          error={countyError}
          preparedAt={countyPreparedAt}
          onSelect={(fips) => onCountyChange?.(fips)}
        />
      ) : null}

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
