"use client"

import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react"
import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react"
import { nextMemberTab } from "@/lib/member-dossier-state.mjs"
import { MEMBER_TABS, type MemberTab, type ResourceStatus } from "./types"

export function DossierTabs({
  activeTab,
  statuses,
  onSelect,
}: {
  activeTab: MemberTab
  statuses: Partial<Record<MemberTab, ResourceStatus>>
  onSelect: (tab: MemberTab) => void
}) {
  const tabRefs = useRef<Partial<Record<MemberTab, HTMLButtonElement | null>>>({})

  useEffect(() => {
    const selected = tabRefs.current[activeTab]
    selected?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [activeTab])

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, tab: MemberTab) {
    if (!(["ArrowLeft", "ArrowRight", "Home", "End"] as string[]).includes(event.key)) return
    event.preventDefault()
    const next = nextMemberTab(tab, event.key as "ArrowLeft" | "ArrowRight" | "Home" | "End") as MemberTab
    tabRefs.current[next]?.focus()
    onSelect(next)
  }

  return (
    <div className="sticky top-0 z-30 -mx-4 border-y border-border bg-background/95 px-4 py-2 shadow-sm backdrop-blur md:mx-0 md:px-0">
      <div role="tablist" aria-label="Member dossier sections" className="flex snap-x snap-mandatory gap-1 overflow-x-auto pb-1">
        {MEMBER_TABS.map((tab) => {
          const status = statuses[tab.id] ?? "idle"
          return (
            <button
              key={tab.id}
              ref={(node) => { tabRefs.current[tab.id] = node }}
              id={`member-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`member-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, tab.id)}
              className={`group flex min-h-11 shrink-0 snap-center items-center gap-2 border px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${activeTab === tab.id ? "border-foreground bg-foreground text-background" : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${status === "error" ? "bg-red-500" : status === "loading" ? "animate-pulse bg-amber-500" : status === "loaded" ? "bg-emerald-500" : "bg-muted-foreground/35"}`}
                aria-hidden="true"
              />
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SectionFrame({ tab, activeTab, children }: { tab: MemberTab; activeTab: MemberTab; children: ReactNode }) {
  if (tab !== activeTab) return null
  return (
    <section id={`member-panel-${tab}`} role="tabpanel" aria-labelledby={`member-tab-${tab}`} tabIndex={0} className="outline-none">
      {children}
    </section>
  )
}

export function ResourceBoundary({
  status,
  error,
  hasData,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  onRetry,
  children,
}: {
  status: ResourceStatus
  error: string | null
  hasData: boolean
  loadingLabel: string
  emptyTitle: string
  emptyDescription: string
  onRetry: () => void
  children: ReactNode
}) {
  if (status === "idle" || (status === "loading" && !hasData)) {
    return (
      <div className="flex min-h-72 items-center justify-center border border-border bg-card/40 p-8" role="status">
        <div className="text-center">
          <LoaderCircle className="mx-auto animate-spin text-accent" size={28} aria-hidden="true" />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{loadingLabel}</p>
        </div>
      </div>
    )
  }

  if (status === "error" && !hasData) {
    return (
      <div className="border border-red-500/40 bg-red-500/5 p-6" role="alert">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-red-500" size={20} aria-hidden="true" />
          <div>
            <h2 className="font-serif text-xl font-semibold text-foreground">Records unavailable</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{error}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">The missing response is not presented as a factual zero.</p>
            <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-10 items-center gap-2 border border-border bg-card px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <RefreshCw size={14} aria-hidden="true" /> Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === "loaded" && !hasData) {
    return (
      <div className="border border-border bg-card/50 p-6" role="status">
        <h2 className="font-serif text-xl font-semibold text-foreground">{emptyTitle}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div aria-busy={status === "loading"}>
      {status === "error" && error ? (
        <div className="mb-4 flex items-center justify-between gap-4 border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground" role="status">
          <span>{error}. Showing the last loaded page.</span>
          <button type="button" onClick={onRetry} className="font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground hover:text-accent">Retry</button>
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function RecordCount({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 border border-border bg-card px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <strong className="text-foreground">{value.toLocaleString()}</strong> {label}
    </span>
  )
}
