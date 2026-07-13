"use client"
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The ARIA combobox pattern requires listbox and option roles on interactive command results. */

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { navigationItemMatches, navigationItems } from "@/lib/navigation"

const SUGGESTED_ITEMS = [
  { label: "NVIDIA disclosure trades", href: "/portfolio?search=NVDA", hint: "Record" },
  { label: "House Financial Services Committee", href: "/committees/HSBA", hint: "Committee" },
  { label: "2026 election map", href: "/elections", hint: "Elections" },
  { label: "AIPAC influence network", href: "/influence/aipac", hint: "Network" },
  { label: "Lobbying filings stream", href: "/lobbying", hint: "Lobbying" },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const router = useRouter()

  function openPalette() {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery("")
    setActiveIndex(0)
    setOpen(true)
  }

  function closePalette() {
    setOpen(false)
  }

  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        openPalette()
      }
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault()
        openPalette()
      }
      if (e.key === "Escape") {
        closePalette()
      }
    }
    function openFromNavigation() {
      openPalette()
    }
    document.addEventListener("keydown", handler)
    window.addEventListener("congress-tracker:open-command-palette", openFromNavigation)
    return () => {
      document.removeEventListener("keydown", handler)
      window.removeEventListener("congress-tracker:open-command-palette", openFromNavigation)
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    function handleCancel(event: Event) {
      event.preventDefault()
      setOpen(false)
    }
    dialog.addEventListener("cancel", handleCancel)
    if (open && !dialog.open) {
      dialog.showModal()
      inputRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
      openerRef.current?.focus()
    }
    return () => dialog.removeEventListener("cancel", handleCancel)
  }, [open])

  const allItems = [...navigationItems, ...SUGGESTED_ITEMS]
  const filtered = query.trim() === ""
    ? allItems
    : allItems.filter((item) => "keywords" in item
      ? navigationItemMatches(item, query)
      : item.label.toLowerCase().includes(query.toLowerCase()))

  function navigate(href: string) {
    closePalette()
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

  return (
    <dialog
      ref={dialogRef}
      className="ct-palette-overlay"
      aria-label="Navigate CongressTracker"
    >
      <button
        type="button"
        className="ct-palette-backdrop"
        aria-label="Close navigation dialog"
        onClick={closePalette}
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
            role="combobox"
            aria-expanded="true"
            aria-controls="ct-palette-results"
            aria-activedescendant={filtered[activeIndex] ? `ct-palette-option-${activeIndex}` : undefined}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
            onKeyDown={handleKeyDown}
          />
          <span className="ct-palette-keycap">ESC</span>
        </div>
        <div className="ct-palette-list" id="ct-palette-results" role="listbox" aria-label="Research destinations">
          {filtered.length === 0 ? (
            <div className="ct-palette-item text-muted-foreground">No matching page or record</div>
          ) : (
            filtered.map((item, i) => {
              return (
                <button
                  type="button"
                  key={`${item.label}-${i}`}
                  id={`ct-palette-option-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`ct-palette-item ${i === activeIndex ? "active" : ""}`}
                  onClick={() => navigate(item.href)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <Search size={18} className="shrink-0" aria-hidden="true" />
                  <strong>{item.label}</strong>
                  <span>{"section" in item ? item.section : item.hint}</span>
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
