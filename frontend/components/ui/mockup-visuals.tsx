"use client"

import { type ReactNode } from "react"
import { FileText, Network, Vote, ArrowRight, Landmark } from "lucide-react"

/* ==========================================================================
   MockupVisuals — visual components from the HTML mockup, adapted to React.
   These are pure presentation; data is passed in from pages that fetch
   from the real backend API.
   =========================================================================*/

/* -- Network Hero Visual (Home) ----------------------------------------- */

export function NetworkHeroVisual() {
  return (
    <div className="ct-hero-network">
      <div className="ct-network-glass" />
      <svg className="ct-network-svg" viewBox="0 0 560 430" fill="none" aria-hidden="true">
        <ellipse className="orbit" cx="280" cy="215" rx="205" ry="135" />
        <ellipse className="orbit" cx="280" cy="215" rx="150" ry="185" transform="rotate(53 280 215)" />
        <path className="link" d="M108 146C180 80 230 175 280 215S386 220 462 126" />
        <path className="link blue" d="M106 302C182 252 206 271 280 215S380 139 459 315" />
        <path className="link" d="M280 215C300 116 361 80 415 97" />
        <circle className="signal signal-one" r="5">
          <animateMotion dur="5s" repeatCount="indefinite" path="M108 146C180 80 230 175 280 215S386 220 462 126" />
        </circle>
        <circle className="signal signal-two" r="4">
          <animateMotion dur="6.5s" repeatCount="indefinite" path="M106 302C182 252 206 271 280 215S380 139 459 315" />
        </circle>
        <circle className="node" cx="108" cy="146" r="14" />
        <circle className="node" cx="106" cy="302" r="10" />
        <circle className="node" cx="462" cy="126" r="12" />
        <circle className="node" cx="459" cy="315" r="15" />
        <circle className="node" cx="415" cy="97" r="9" />
        <circle className="node-hot" cx="280" cy="215" r="36" />
        <g transform="translate(253 188)" style={{ color: "white" }}>
          <Landmark size={34} strokeWidth={1.5} />
        </g>
      </svg>
      <div className="ct-network-card one">
        <span className="ct-network-card-icon"><FileText size={17} /></span>
        <span>
          <small>Latest source</small>
          <strong>House disclosure</strong>
        </span>
      </div>
      <div className="ct-network-card two">
        <span className="ct-network-card-icon"><Network size={17} /></span>
        <span>
          <small>Cross-source match</small>
          <strong>Lobbyist to committee</strong>
        </span>
      </div>
      <div className="ct-network-card three">
        <span className="ct-network-card-icon"><Vote size={17} /></span>
        <span>
          <small>Live linkage</small>
          <strong>Bill to roll call</strong>
        </span>
      </div>
      <div className="ct-network-caption">
        <span><i /> Source record</span>
        <span><i /> Verified relationship</span>
      </div>
    </div>
  )
}

/* -- Source Status Card (Home hero overlay) ----------------------------- */

export function SourceStatusCard({
  sources,
}: {
  sources: Array<{ name: string; health: number; label: string }>
}) {
  if (sources.length === 0) return null
  return (
    <div className="ct-source-status">
      <div className="ct-source-status-head">
        <span>Source health</span>
        <b>{sources.filter((s) => s.health >= 80).length} online</b>
      </div>
      <div className="ct-source-bars">
        {sources.map((src, i) => (
          <div className="ct-source-bar" key={src.name}>
            <span>{src.name}</span>
            <div className="ct-bar">
              <i
                style={{
                  width: `${src.health}%`,
                  background: i === 1 ? "#3567df" : i === 2 ? "#16805e" : undefined,
                }}
              />
            </div>
            <b>{src.health}%</b>
          </div>
        ))}
      </div>
    </div>
  )
}

/* -- Bill Flow Visual (Bills hero) -------------------------------------- */

export function BillFlowVisual({
  steps,
  activeStep,
}: {
  steps: string[]
  activeStep: number
}) {
  return (
    <div className="ct-bill-flow">
      {steps.map((step, i) => (
        <div key={step} style={{ display: "contents" }}>
          <div
            className={`ct-flow-step ${
              i < activeStep ? "done" : i === activeStep ? "active" : ""
            }`}
          >
            {step}
          </div>
          {i < steps.length - 1 && (
            <span className="ct-flow-arrow"><ArrowRight size={14} /></span>
          )}
        </div>
      ))}
    </div>
  )
}

/* -- Committee Orbit Visual (Committees hero) --------------------------- */

export function CommitteeOrbitVisual({
  items,
}: {
  items: string[]
}) {
  const classes = ["a", "b", "c", "d", "e"]
  return (
    <div className="ct-committee-orbit">
      <div className="ring" />
      <div className="ring two" />
      <div className="ct-orbit-center">
        Congressional<br />jurisdiction
      </div>
      {items.slice(0, 5).map((item, i) => (
        <div key={item} className={`ct-orbit-item ${classes[i]}`}>
          {item}
        </div>
      ))}
    </div>
  )
}

/* -- Market Visual (Portfolio hero) ------------------------------------- */

export function MarketVisual() {
  return (
    <div className="ct-market-visual">
      <svg className="ct-market-svg" viewBox="0 0 500 300" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="ctMarketArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[50, 100, 150, 200, 250].map((y) => (
          <path className="grid" key={y} d={`M20 ${y}H480`} />
        ))}
        <path
          fill="url(#ctMarketArea)"
          d="M20 238C70 205 84 225 124 184S190 204 232 148 305 169 345 110 414 127 480 62V280H20Z"
        />
        <path
          className="trend"
          d="M20 238C70 205 84 225 124 184S190 204 232 148 305 169 345 110 414 127 480 62"
        />
        <circle className="ticker-dot" cx="480" cy="62" r="7" />
      </svg>
    </div>
  )
}

/* -- Sankey Flow Visual (Lobbying hero) --------------------------------- */

export function SankeyFlowVisual() {
  return (
    <div className="ct-sankey">
      <svg viewBox="0 0 520 330" fill="none" aria-hidden="true">
        <path className="flow red" d="M80 70C190 70 195 145 280 145S390 70 455 70" />
        <path className="flow blue" d="M80 165C185 165 205 145 280 145S385 165 455 165" />
        <path className="flow gold" d="M80 260C185 260 190 145 280 145S390 260 455 260" />
        <path className="flowline red" d="M80 70C190 70 195 145 280 145S390 70 455 70" />
        <path className="flowline blue" d="M80 165C185 165 205 145 280 145S385 165 455 165" />
        <path className="flowline gold" d="M80 260C185 260 190 145 280 145S390 260 455 260" />
        <g fill="var(--card)" stroke="var(--border)">
          <rect x="30" y="42" width="100" height="55" rx="12" />
          <rect x="30" y="138" width="100" height="55" rx="12" />
          <rect x="30" y="232" width="100" height="55" rx="12" />
          <rect x="230" y="115" width="100" height="60" rx="12" />
          <rect x="405" y="42" width="95" height="55" rx="12" />
          <rect x="405" y="138" width="95" height="55" rx="12" />
          <rect x="405" y="232" width="95" height="55" rx="12" />
        </g>
        <text x="80" y="73" textAnchor="middle">CLIENTS</text>
        <text x="80" y="169" textAnchor="middle">FIRMS</text>
        <text x="80" y="263" textAnchor="middle">PACs</text>
        <text x="280" y="151" textAnchor="middle">ISSUES</text>
        <text x="452" y="73" textAnchor="middle">BILLS</text>
        <text x="452" y="169" textAnchor="middle">AGENCIES</text>
        <text x="452" y="263" textAnchor="middle">MEMBERS</text>
      </svg>
    </div>
  )
}

/* -- Graph Stage (Influence page) --------------------------------------- */

export function GraphNode({
  x,
  y,
  r,
  label,
  cls = "",
  onSelect,
}: {
  x: number
  y: number
  r: number
  label: string
  cls?: string
  onSelect?: (label: string) => void
}) {
  return (
    <g
      className={`ct-graph-node ${cls}`}
      transform={`translate(${x} ${y})`}
      onClick={() => onSelect?.(label)}
      role="button"
      tabIndex={0}
      aria-label={label}
    >
      <circle r={r} />
      <text textAnchor="middle" dominantBaseline="middle">{label}</text>
    </g>
  )
}

/* -- Activity Item (Home) ----------------------------------------------- */

export function ActivityItem({
  icon,
  badge,
  title,
  meta,
  href,
}: {
  icon: ReactNode
  badge: string
  title: string
  meta: string
  href?: string
}) {
  return (
    <a
      className="ct-activity-item"
      href={href || "#"}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <span className="ct-activity-icon">{icon}</span>
      <div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[0.61rem] uppercase"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
            background: "color-mix(in srgb, var(--accent) 7%, transparent)",
            color: "var(--accent)",
          }}
        >
          {badge}
        </span>
        <h4>{title}</h4>
        <p>{meta}</p>
      </div>
      <ArrowRight size={16} className="text-muted-foreground" />
    </a>
  )
}

/* -- Proof Row (Home hero) ---------------------------------------------- */

export function ProofRow() {
  return (
    <div className="ct-proof-row">
      <span><i>&#10003;</i> Source-linked records</span>
      <span><i>&#10003;</i> Explicit missing-data warnings</span>
      <span><i>&#10003;</i> No invented certainty</span>
    </div>
  )
}

/* -- Compact Masthead (internal pages) ---------------------------------- */

export function CompactMasthead({
  eyebrow,
  title,
  accent,
  description,
  visual,
}: {
  eyebrow: string
  title: string
  accent?: string
  description: string
  visual?: ReactNode
}) {
  return (
    <section className="ct-masthead">
      <div className="ct-masthead-grid">
        <div>
          <div
            className="font-mono text-[0.69rem] uppercase font-semibold"
            style={{ color: "var(--accent)", letterSpacing: "0.13em" }}
          >
            {eyebrow}
          </div>
          <h1>
            {title} {accent ? <em>{accent}</em> : null}
          </h1>
          <p>{description}</p>
        </div>
        {visual ? <div className="ct-masthead-visual">{visual}</div> : null}
      </div>
    </section>
  )
}

/* -- Elections Hierarchy Visual ----------------------------------------- */

export function ElectionsHierarchyVisual() {
  return (
    <div style={{ width: 430, height: 300, position: "relative", maxWidth: "100%" }}>
      <svg viewBox="0 0 430 300" style={{ width: "100%", height: "100%" }} fill="none" aria-hidden="true">
        <path d="M48 192C80 111 157 80 238 92s126 45 145 98" stroke="color-mix(in srgb, var(--border) 55%, transparent)" strokeDasharray="5 10" />
        <path
          d="M48 192C117 214 167 171 238 92S337 120 383 190"
          stroke="color-mix(in srgb, var(--accent) 40%, transparent)"
          strokeDasharray="5 9"
          style={{ animation: "ct-route 10s linear infinite" }}
        />
        <g fill="var(--card)" stroke="var(--border)">
          <circle cx="48" cy="192" r="18" />
          <circle cx="238" cy="92" r="23" />
          <circle cx="383" cy="190" r="18" />
        </g>
        <circle cx="238" cy="92" r="8" fill="var(--accent)" />
        <text x="48" y="229" textAnchor="middle" fontFamily="ui-monospace" fontSize="9" fill="var(--muted-foreground)">COUNTY</text>
        <text x="238" y="58" textAnchor="middle" fontFamily="ui-monospace" fontSize="9" fill="var(--muted-foreground)">STATE</text>
        <text x="383" y="229" textAnchor="middle" fontFamily="ui-monospace" fontSize="9" fill="var(--muted-foreground)">DISTRICT</text>
      </svg>
    </div>
  )
}

/* -- Search Hero Visual ------------------------------------------------- */

export function SearchHeroVisual({
  query,
  counts,
}: {
  query: string
  counts: Array<{ label: string; count: number; color: "red" | "blue" | "gold" }>
}) {
  return (
    <div style={{ width: 430, maxWidth: "100%" }}>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          background: "color-mix(in srgb, var(--card) 80%, transparent)",
          boxShadow: "0 1.5rem 4rem rgba(0,0,0,0.12)",
        }}
      >
        <div
          className="font-mono text-[0.66rem] uppercase font-semibold"
          style={{ color: "var(--accent)" }}
        >
          Example query
        </div>
        <div
          className="font-serif text-8"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif", fontSize: "2rem", margin: "0.75rem 0" }}
        >
          &ldquo;{query}&rdquo;
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {counts.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[0.61rem] uppercase"
              style={{
                borderColor: c.color === "red" ? "color-mix(in srgb, var(--accent) 25%, transparent)" : c.color === "blue" ? "rgba(53,103,223,0.25)" : "rgba(185,128,47,0.25)",
                background: c.color === "red" ? "color-mix(in srgb, var(--accent) 7%, transparent)" : c.color === "blue" ? "rgba(53,103,223,0.07)" : "rgba(185,128,47,0.08)",
                color: c.color === "red" ? "var(--accent)" : c.color === "blue" ? "#3567df" : "#b9802f",
              }}
            >
              {c.count} {c.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
