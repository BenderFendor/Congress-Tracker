"use client"

// Design direction: Civic reading room. Public records feel editorial at first glance and operational at the point of investigation.
import { useId, type ReactNode } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, Database, ExternalLink } from "lucide-react"

export function ArchivePage({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="archive-page"
    >
      {children}
    </main>
  )
}

type ArchiveHeroProps = {
  eyebrow: string
  title: string
  accent: string
  description: string
  mode?: "files" | "capitol" | "market" | "network"
  aside?: ReactNode
  actions?: ReactNode
}

export function ArchiveHero({
  eyebrow,
  title,
  accent,
  description,
  mode = "files",
  aside,
  actions,
}: ArchiveHeroProps) {
  return (
    <section className={`archive-hero archive-hero-${mode}`}>
      <div className="archive-hero-copy">
        <div className="archive-eyebrow">{eyebrow}</div>
        <h1>
          {title} <span>{accent}</span>
        </h1>
        <p>{description}</p>
        {actions ? <div className="archive-actions">{actions}</div> : null}
      </div>
      {aside ? <div className="archive-hero-aside">{aside}</div> : null}
    </section>
  )
}

type ArchiveMetric = {
  label: string
  value: string | number
  detail?: string
  icon?: ReactNode
}

export function ArchiveMetrics({ metrics }: { metrics: ArchiveMetric[] }) {
  return (
    <dl className="archive-metrics" aria-label="Record summary">
      {metrics.map((metric) => (
        <div className="archive-metric" key={metric.label}>
          {metric.icon ? <div className="archive-metric-icon">{metric.icon}</div> : null}
          <div>
            <dt className="archive-metric-label">{metric.label}</dt>
            <dd className="archive-metric-value">{metric.value}</dd>
            {metric.detail ? <dd className="archive-metric-detail">{metric.detail}</dd> : null}
          </div>
        </div>
      ))}
    </dl>
  )
}

export function ArchivePanel({
  title,
  kicker,
  action,
  children,
  className = "",
}: {
  title: string
  kicker?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  const headingId = useId()
  return (
    <section className={`archive-panel ${className}`} aria-labelledby={headingId}>
      <div className="archive-panel-head">
        <div>
          {kicker ? <div className="archive-panel-kicker">{kicker}</div> : null}
          <h2 id={headingId}>{title}</h2>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function ArchiveSearch({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  children?: ReactNode
}) {
  const inputId = useId()
  return (
    // React 18's JSX types do not yet include the HTML search element.
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
    <div className="archive-search-row" role="search">
      <label className="sr-only" htmlFor={inputId}>{placeholder}</label>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {children}
    </div>
  )
}

type DataStateProps = {
  title: string
  description: string
  kind?: "empty" | "error" | "setup" | "success"
  action?: ReactNode
}

export function DataState({ title, description, kind = "empty", action }: DataStateProps) {
  return (
    <div className={`archive-data-state archive-data-state-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <div className="archive-data-state-icon" aria-hidden="true">
        {kind === "error" ? <AlertTriangle size={18} /> : kind === "success" ? <CheckCircle2 size={18} /> : <Database size={18} />}
      </div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        {action ? <div className="archive-data-state-action">{action}</div> : null}
      </div>
    </div>
  )
}

type EvidenceSpineProps = {
  identifier?: string | null
  source: string
  status: string
  updated?: string | null
  coverage?: string | null
  sourceUrl?: string | null
  children?: ReactNode
}

export function EvidenceSpine({
  identifier,
  source,
  status,
  updated,
  coverage,
  sourceUrl,
  children,
}: EvidenceSpineProps) {
  return (
    <aside className="archive-evidence-spine" aria-label="Evidence and provenance">
      <div className="archive-panel-kicker">Evidence</div>
      <dl>
        {identifier ? <div><dt>Record</dt><dd>{identifier}</dd></div> : null}
        <div><dt>Source</dt><dd>{source}</dd></div>
        <div><dt>Status</dt><dd>{status}</dd></div>
        {updated ? <div><dt>Updated</dt><dd>{updated}</dd></div> : null}
        {coverage ? <div><dt>Coverage</dt><dd>{coverage}</dd></div> : null}
      </dl>
      {children}
      {sourceUrl ? (
        <a className="archive-source-action" href={sourceUrl} target="_blank" rel="noreferrer">
          Open official source <ExternalLink size={14} />
        </a>
      ) : null}
    </aside>
  )
}

export function ArchiveLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="archive-link" href={href}>
      {children}
      <ArrowRight size={14} />
    </a>
  )
}
