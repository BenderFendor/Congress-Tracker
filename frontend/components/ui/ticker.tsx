"use client"

import { useEffect, useState } from "react"
import { getSourceCoverage, type SourceFreshness } from "@/lib/services/sources"

function freshnessClass(f: SourceFreshness): string {
  switch (f.freshness) {
    case "fresh": return "fresh"
    case "stale": return "stale"
    case "failed": return "failed"
    default: return ""
  }
}

function freshnessLabel(f: SourceFreshness): string {
  const display = f.display_name || f.source
  if (f.freshness === "failed") return `${display} — request failed`
  const rows = f.rows_written ?? 0
  return `${display} — ${rows.toLocaleString()} rows indexed`
}

export function Ticker() {
  const [sources, setSources] = useState<SourceFreshness[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const coverage = await getSourceCoverage()
        if (mounted) {
          setSources(coverage.sources)
          setError(false)
        }
      } catch {
        if (mounted) setError(true)
      }
    }
    load()
    const interval = setInterval(load, 60000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  const items = sources.length > 0
    ? sources
    : []

  if (error && items.length === 0) {
    return (
      <div className="ct-ticker" aria-label="Source status ticker">
        <div className="ct-ticker-track">
          <span className="ct-ticker-item">
            <i className="ct-ticker-dot" />
            Source coverage unavailable
          </span>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="ct-ticker" aria-label="Source status ticker">
        <div className="ct-ticker-track">
          <span className="ct-ticker-item">
            <i className="ct-ticker-dot" />
            Loading source status...
          </span>
        </div>
      </div>
    )
  }

  const track = [...items, ...items]

  return (
    <div className="ct-ticker" aria-label="Live source status ticker">
      <div className="ct-ticker-track">
        {track.map((src, i) => (
          <span className="ct-ticker-item" key={`${src.source}-${i}`}>
            <i className={`ct-ticker-dot ${freshnessClass(src)}`} />
            <b>{src.display_name || src.source}</b>
            {freshnessLabel(src).split(" — ")[1] || ""}
          </span>
        ))}
      </div>
    </div>
  )
}
