"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

export default function ElectionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Elections page error:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-sm border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-red-500/30 bg-red-500/10 text-red-500">
            <AlertTriangle size={22} aria-hidden="true" />
          </div>
          <h1 className="font-serif text-2xl font-medium text-foreground">
            Election atlas could not load
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {error.message || "An unexpected error prevented the elections data from rendering."}
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">Error reference: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex items-center gap-2 rounded-sm border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Try again
          </button>
          <p className="mt-6 text-xs text-muted-foreground">
            The cartogram and candidate roster remain on the page below when the interactive map fails to load.
          </p>
        </div>
      </div>
    </div>
  )
}
