import * as d3 from "d3"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import type {
  CountyFeature,
  CountyFips,
  Metric,
  StateAggregate,
  StateFeature,
  StateFips,
} from "./election-map-helpers"
import { createCountyPath } from "@/lib/county-map-projection.mjs"
import {
  STATE_ABBR_BY_FIPS,
  STATE_NAME_BY_FIPS,
  countiesInState,
} from "./election-map-helpers"

export type MapView = "national" | "state" | "county"

export type MapRenderOptions = {
  view: MapView
  stateFeatures: StateFeature[]
  countyFeatures: CountyFeature[]
  aggregates: Map<StateFips, StateAggregate>
  selectedState: StateFips | null
  selectedCounty: CountyFips | null
  metric: Metric
  searchQuery: string
  countyNames: Map<CountyFips, string>
  onSelectState: (fips: StateFips) => void
  onSelectCounty: (fips: CountyFips) => void
  onHover: (
    feature: { type: "state" | "county"; fips: string },
    clientX: number,
    clientY: number,
  ) => void
}

function bucketFor(row: StateAggregate | undefined): string {
  if (!row || row.total === 0) return "no-data"
  return "data-rich"
}

function fillPctFor(row: StateAggregate | undefined, metric: Metric, maxValue: number): number {
  if (!row || row.total === 0) return 0
  const value = metric === "candidates" ? row.total : metric === "incumbents" ? row.incumbents : row.open
  if (maxValue <= 0) return 0
  return Math.min(1, value / maxValue)
}

function metricMax(aggregates: Map<StateFips, StateAggregate>, metric: Metric): number {
  let max = 0
  for (const row of aggregates.values()) {
    const v = metric === "candidates" ? row.total : metric === "incumbents" ? row.incumbents : row.open
    if (v > max) max = v
  }
  return max
}

function stateNameOf(fips: StateFips, aggregates: Map<StateFips, StateAggregate>): string {
  return aggregates.get(fips)?.name ?? STATE_NAME_BY_FIPS[fips] ?? ""
}

function stateAbbrOf(fips: StateFips, aggregates: Map<StateFips, StateAggregate>): string {
  return aggregates.get(fips)?.abbr ?? STATE_ABBR_BY_FIPS[fips] ?? ""
}

function countyNameOf(fips: CountyFips, names: Map<CountyFips, string>): string {
  return names.get(fips) ?? `County ${fips.slice(2)}`
}

export function renderStateMap(container: SVGSVGElement, opts: MapRenderOptions): void {
  const svg = d3.select(container)
  svg.selectAll("*").remove()
  const rect = container.getBoundingClientRect()
  const width = Math.max(320, rect.width)
  const height = Math.max(420, rect.height)
  svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet")

  const showingCounties = opts.view !== "national" && Boolean(opts.selectedState)
  const features: Feature<Geometry, { name?: string }>[] =
    showingCounties && opts.selectedState
      ? countiesInState(opts.countyFeatures, opts.selectedState)
      : opts.stateFeatures

  const path = showingCounties
    ? createCountyPath(features, width, height)
    : d3.geoPath(d3.geoAlbersUsa())

  if (!showingCounties && features.length > 0) {
    const collection: FeatureCollection<Geometry, { name?: string }> = {
      type: "FeatureCollection",
      features,
    }
    const margin = 24
    const projection = path.projection()
    if (!projection || !("fitExtent" in projection)) return
    projection.fitExtent(
      [[margin, 64], [width - margin, height - 60]],
      collection,
    )
  }

  const root = svg.append("g").attr("class", "election-map-root")
  const maxValue = metricMax(opts.aggregates, opts.metric)
  const search = opts.searchQuery.trim().toLowerCase()

  if (showingCounties && opts.selectedState) {
    const counties = countiesInState(opts.countyFeatures, opts.selectedState)
    const countiesGroup = root
      .selectAll<SVGPathElement, CountyFeature>("path.election-map-county")
      .data(counties, (d) => String(d.id ?? ""))
      .join("path")
      .attr("class", "election-map-county")
      .attr("d", path)
      .attr("data-fips", (d) => String(d.id ?? ""))
      .attr("data-state-fips", (d) => String(d.id ?? "").slice(0, 2))
      .attr("data-name", (d) => countyNameOf(String(d.id ?? ""), opts.countyNames))
      .attr("data-lean", "no-data")
      .attr("data-search-dim", (d) => {
        if (!search) return "false"
        const name = countyNameOf(String(d.id ?? ""), opts.countyNames).toLowerCase()
        return name.includes(search) ? "false" : "true"
      })
      .attr("aria-pressed", (d) =>
        opts.selectedCounty && String(d.id ?? "") === opts.selectedCounty ? "true" : "false",
      )
      .attr("tabindex", 0)
      .attr("role", "button")
      .on("click", (_event, d) => {
        const fips = String(d.id ?? "")
        if (fips.length === 5) opts.onSelectCounty(fips)
      })
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          const fips = String(d.id ?? "")
          if (fips.length === 5) opts.onSelectCounty(fips)
        }
      })
      .on("mouseenter", (event, d) => {
        opts.onHover({ type: "county", fips: String(d.id ?? "") }, event.clientX, event.clientY)
      })
      .on("mousemove", (event, d) =>
        opts.onHover({ type: "county", fips: String(d.id ?? "") }, event.clientX, event.clientY),
      )
      .on("mouseleave", () => opts.onHover({ type: "county", fips: "" }, 0, 0))
      .on("focus", (event, d) => {
        const target = event.currentTarget as SVGPathElement
        const bbox = target.getBoundingClientRect()
        opts.onHover(
          { type: "county", fips: String(d.id ?? "") },
          bbox.left + bbox.width / 2,
          bbox.top + bbox.height / 2,
        )
      })
      .on("blur", () => opts.onHover({ type: "county", fips: "" }, 0, 0))

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reducedMotion) countiesGroup.attr("opacity", 1)
    else countiesGroup.attr("opacity", 0).transition().duration(320).attr("opacity", 1)
    return
  }

  const statePath = root
    .selectAll<SVGPathElement, StateFeature>("path.election-map-state")
    .data(opts.stateFeatures, (d) => String(d.id ?? ""))
    .join("path")
    .attr("class", "election-map-state")
    .attr("d", path)
    .attr("data-fips", (d) => String(d.id ?? ""))
    .attr("data-abbr", (d) => {
      const fips = String(d.id ?? "")
      return stateAbbrOf(fips, opts.aggregates)
    })
    .attr("data-name", (d) => {
      const fips = String(d.id ?? "")
      return stateNameOf(fips, opts.aggregates)
    })
    .attr("data-lean", (d) => bucketFor(opts.aggregates.get(String(d.id ?? ""))))
    .attr("data-fill-pct", (d) => fillPctFor(opts.aggregates.get(String(d.id ?? "")), opts.metric, maxValue).toFixed(3))
    .attr("data-search-dim", (d) => {
      if (!search) return "false"
      const abbr = stateAbbrOf(String(d.id ?? ""), opts.aggregates).toLowerCase()
      const name = stateNameOf(String(d.id ?? ""), opts.aggregates).toLowerCase()
      return name.includes(search) || abbr === search ? "false" : "true"
    })
    .attr("aria-pressed", (d) =>
      opts.selectedState && String(d.id ?? "") === opts.selectedState ? "true" : "false",
    )
    .attr("tabindex", 0)
    .attr("role", "button")
    .on("click", (_event, d) => {
      const fips = String(d.id ?? "")
      if (fips) opts.onSelectState(fips)
    })
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        const fips = String(d.id ?? "")
        if (fips) opts.onSelectState(fips)
      }
    })
    .on("mouseenter", (event, d) =>
      opts.onHover({ type: "state", fips: String(d.id ?? "") }, event.clientX, event.clientY),
    )
    .on("mousemove", (event, d) =>
      opts.onHover({ type: "state", fips: String(d.id ?? "") }, event.clientX, event.clientY),
    )
    .on("mouseleave", () => opts.onHover({ type: "state", fips: "" }, 0, 0))
    .on("focus", (event, d) => {
      const target = event.currentTarget as SVGPathElement
      const bbox = target.getBoundingClientRect()
      opts.onHover(
        { type: "state", fips: String(d.id ?? "") },
        bbox.left + bbox.width / 2,
        bbox.top + bbox.height / 2,
      )
    })
    .on("blur", () => opts.onHover({ type: "state", fips: "" }, 0, 0))

  root
    .append("path")
    .attr("class", "election-map-border")
    .attr("d", () => {
      const parts: string[] = []
      for (const f of opts.stateFeatures) {
        const d = path(f as unknown as Feature<Geometry, { name?: string }>)
        if (d) parts.push(d)
      }
      return parts.join(" ")
    })
    .attr("fill", "none")
    .attr("pointer-events", "none")

  if (opts.selectedState) {
    const f = opts.stateFeatures.find((feat) => String(feat.id ?? "") === opts.selectedState)
    if (f) {
      root
        .append("path")
        .attr("class", "election-map-selected-halo")
        .attr("data-fips", opts.selectedState)
        .attr("d", path(f as unknown as Feature<Geometry, { name?: string }>) ?? "")
        .attr("fill", "none")
        .attr("pointer-events", "none")
    }
  }

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 8])
    .translateExtent([
      [-width * 0.3, -height * 0.3],
      [width * 1.3, height * 1.3],
    ])
    .on("zoom", (event) => {
      root.attr("transform", event.transform.toString())
    })
  svg.call(zoom)
  svg.on("dblclick.zoom", null)
  const node = svg.node() as SVGSVGElement & { __resetZoom?: () => void }
  node.__resetZoom = () => {
    svg.transition().duration(280).call(zoom.transform, d3.zoomIdentity)
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (reducedMotion) statePath.attr("opacity", 1)
  else statePath.attr("opacity", 0).transition().duration(360).attr("opacity", 1)
}
