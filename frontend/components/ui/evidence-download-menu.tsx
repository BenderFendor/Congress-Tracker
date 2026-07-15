"use client"

import { Download, FileJson2, Table2 } from "lucide-react"
import { buildDownloadFilename, serializeCsv } from "@/lib/download-utils.mjs"

function saveText(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.style.display = "none"
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function EvidenceDownloadMenu({
  filenamePrefix,
  json,
  csvRows,
}: {
  filenamePrefix: string
  json: unknown
  csvRows: Array<Record<string, unknown>>
}) {
  const hasCsv = csvRows.length > 0

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Download dossier data">
      <span className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Download size={14} aria-hidden="true" /> Export loaded evidence
      </span>
      <button
        type="button"
        onClick={() => saveText(
          `${JSON.stringify(json, null, 2)}\n`,
          "application/json;charset=utf-8",
          buildDownloadFilename(filenamePrefix, "json"),
        )}
        className="inline-flex min-h-10 items-center gap-2 border border-border bg-card px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <FileJson2 size={14} aria-hidden="true" /> JSON
      </button>
      <button
        type="button"
        disabled={!hasCsv}
        onClick={() => saveText(
          `${serializeCsv(csvRows)}\n`,
          "text/csv;charset=utf-8",
          buildDownloadFilename(filenamePrefix, "csv"),
        )}
        className="inline-flex min-h-10 items-center gap-2 border border-border bg-card px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Table2 size={14} aria-hidden="true" /> CSV
      </button>
    </div>
  )
}
