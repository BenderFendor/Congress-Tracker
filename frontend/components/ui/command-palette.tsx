"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Search, Shield, Users, FileText, Network, Landmark, TrendingUp, DollarSign, Map } from "lucide-react"

type PaletteItem = {
  label: string
  href: string
  icon: typeof Search
  hint: string
}

const NAV_ITEMS: PaletteItem[] = [
  { label: "Home", href: "/", icon: Shield, hint: "Page" },
  { label: "Legislators", href: "/legislators", icon: Users, hint: "Page" },
  { label: "Bills", href: "/bills", icon: FileText, hint: "Page" },
  { label: "Influence", href: "/influence", icon: Network, hint: "Page" },
  { label: "Committees", href: "/committees", icon: Landmark, hint: "Page" },
  { label: "Portfolio", href: "/portfolio", icon: TrendingUp, hint: "Page" },
  { label: "Lobbying", href: "/lobbying", icon: DollarSign, hint: "Page" },
  { label: "Elections", href: "/elections", icon: Map, hint: "Page" },
  { label: "Search", href: "/search", icon: Search, hint: "Page" },
]

const SUGGESTED_ITEMS: PaletteItem[] = [
  { label: "NVIDIA disclosure trades", href: "/portfolio?search=NVDA", icon: TrendingUp, hint: "Record" },
  { label: "House Financial Services Committee", href: "/committees/HSBA", icon: Landmark, hint: "Committee" },
  { label: "2026 election map", href: "/elections", icon: Map, hint: "Elections" },
  { label: "AIPAC influence network", href: "/influence/aipac", icon: Network, hint: "Network" },
  { label: "Lobbying filings stream", href: "/lobbying", icon: DollarSign, hint: "Lobbying" },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const allItems = [...NAV_ITEMS, ...SUGGESTED_ITEMS]
  const filtered = query.trim() === ""
    ? allItems
    : allItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = filtered[activeIndex]
      if (item) navigate(item.href)
    }
  }

  if (!open) return null

  return (
    <dialog
      open
      className="ct-palette-overlay"
      aria-modal="true"
      aria-label="Navigate CongressTracker"
    >
      <button
        type="button"
        className="ct-palette-backdrop"
        aria-label="Close navigation dialog"
        onClick={() => setOpen(false)}
      />
      <div className="ct-palette-box">
        <div className="ct-palette-input">
          <Search size={19} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, legislators, bills, committees..."
            autoComplete="off"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
            onKeyDown={handleKeyDown}
          />
          <span className="ct-palette-keycap">ESC</span>
        </div>
        <div className="ct-palette-list">
          {filtered.length === 0 ? (
            <div className="ct-palette-item text-muted-foreground">No matching page or record</div>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon
              return (
                <button
                  type="button"
                  key={`${item.label}-${i}`}
                  className={`ct-palette-item ${i === activeIndex ? "active" : ""}`}
                  onClick={() => navigate(item.href)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <Icon size={18} className="shrink-0" />
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </dialog>
  )
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
}
