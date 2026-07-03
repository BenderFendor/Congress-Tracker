"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { ArrowRight, Landmark, Shield } from "lucide-react"

export function ArchivePage({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <main className={`archive-page ${isDark ? "archive-page-dark" : "archive-page-light"}`}>
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
      <div className="archive-hero-art" aria-hidden="true">
        <div className="archive-folder-stack">
          <div className="archive-folder archive-folder-a" />
          <div className="archive-folder archive-folder-b" />
          <div className="archive-folder archive-folder-c" />
        </div>
        <div className="archive-seal">
          <Landmark size={34} />
        </div>
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
    <section className="archive-metrics">
      {metrics.map((metric) => (
        <div className="archive-metric" key={metric.label}>
          <div className="archive-metric-icon">{metric.icon ?? <Shield size={20} />}</div>
          <div>
            <div className="archive-metric-label">{metric.label}</div>
            <div className="archive-metric-value">{metric.value}</div>
            {metric.detail ? <div className="archive-metric-detail">{metric.detail}</div> : null}
          </div>
        </div>
      ))}
    </section>
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
  return (
    <section className={`archive-panel ${className}`}>
      <div className="archive-panel-head">
        <div>
          {kicker ? <div className="archive-panel-kicker">{kicker}</div> : null}
          <h2>{title}</h2>
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
  return (
    <div className="archive-search-row">
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {children}
    </div>
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
