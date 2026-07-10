"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createLogger } from "@/lib/tracing"
import { ArrowRight, Landmark, X } from "lucide-react"
import { BACKEND_URL } from "@/lib/constants"
import { type Committee } from "@/lib/services/committees"
import {
  ArchivePage,
  ArchivePanel,
  ArchiveSearch,
  DataState,
  EvidenceSpine,
} from "@/components/ui/archive-ui"
import {
  CompactMasthead,
  CommitteeOrbitVisual,
} from "@/components/ui/mockup-visuals"
import { Button } from "@/components/ui/button"

const log = createLogger("CommitteesPage")

function isCommittee(value: unknown): value is Committee {
  if (typeof value !== "object" || value === null) return false
  const committee = value as Record<string, unknown>
  return typeof committee.committee_id === "string" &&
    typeof committee.chamber === "string" &&
    typeof committee.name === "string"
}

export default function CommitteesListPage() {
  const [committees, setCommittees] = useState<Committee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [chamberFilter, setChamberFilter] = useState<"" | "house" | "senate" | "joint">("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${BACKEND_URL}/api/committees`)
        if (!response.ok) throw new Error(`Committee request failed (${response.status})`)
        const data: unknown = await response.json()
        if (!Array.isArray(data) || !data.every(isCommittee)) {
          throw new Error("Committee response did not match the expected record list")
        }
        if (!cancelled) setCommittees(data)
      } catch (err) {
        log.error("Failed to fetch committees:", { error: String(err) })
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load committees")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return committees.filter((committee) => {
      const matchesChamber = !chamberFilter || committee.chamber.toLowerCase() === chamberFilter
      const matchesSearch = !q || committee.name.toLowerCase().includes(q) ||
        Boolean(committee.jurisdiction?.toLowerCase().includes(q)) ||
        committee.committee_id.toLowerCase().includes(q)
      return matchesChamber && matchesSearch
    })
  }, [chamberFilter, committees, search])

  const houseCount = committees.filter((c) => c.chamber.toLowerCase() === "house").length
  const senateCount = committees.filter((c) => c.chamber.toLowerCase() === "senate").length
  const jointCount = committees.filter((c) => c.chamber.toLowerCase() === "joint").length

  const provenanceSources = committees.flatMap((committee) => committee.provenance?.sources ?? [])
  const latestSource = provenanceSources
    .filter((source) => source.fetched_at)
    .sort((a, b) => String(b.fetched_at).localeCompare(String(a.fetched_at)))[0]
  const activeFilterCount = Number(Boolean(search.trim())) + Number(Boolean(chamberFilter))

  function clearFilters() {
    setSearch("")
    setChamberFilter("")
  }

  return (
    <ArchivePage>
      <CompactMasthead
        eyebrow="Congressional infrastructure"
        title="Committees &"
        accent="jurisdictions."
        description="Find a committee by chamber, identifier, or jurisdiction, then open its roster and referred legislation."
        visual={<CommitteeOrbitVisual items={['Finance','Foreign Affairs','Judiciary','Agriculture','Oversight']} />}
      />

      <div className="mt-4">
        <ArchiveSearch
          value={search}
          onChange={setSearch}
          placeholder="Search committees by name, identifier, or policy jurisdiction..."
        >
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Filter committees by chamber</legend>
            <Button
              variant={chamberFilter === "" ? "default" : "outline"}
              size="sm"
              aria-pressed={chamberFilter === ""}
              onClick={() => setChamberFilter("")}
            >
              All Chambers
            </Button>
            <Button
              variant={chamberFilter === "house" ? "default" : "outline"}
              size="sm"
              aria-pressed={chamberFilter === "house"}
              onClick={() => setChamberFilter("house")}
            >
              House
            </Button>
            <Button
              variant={chamberFilter === "senate" ? "default" : "outline"}
              size="sm"
              aria-pressed={chamberFilter === "senate"}
              onClick={() => setChamberFilter("senate")}
            >
              Senate
            </Button>
            <Button
              variant={chamberFilter === "joint" ? "default" : "outline"}
              size="sm"
              aria-pressed={chamberFilter === "joint"}
              onClick={() => setChamberFilter("joint")}
            >
              Joint
            </Button>
          </fieldset>
        </ArchiveSearch>
      </div>

      <div className="mx-auto -mt-3 mb-4 flex w-[calc(100%-2rem)] max-w-[106rem] flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        <strong className="text-foreground">{filtered.length} results</strong>
        {chamberFilter ? <span className="archive-chip">Chamber: {chamberFilter}</span> : null}
        {search.trim() ? <span className="archive-chip">Query: {search.trim()}</span> : null}
        {activeFilterCount > 0 ? (
          <button className="ml-auto inline-flex min-h-10 items-center gap-1 px-2 font-semibold text-accent" onClick={clearFilters}>
            <X size={14} /> Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>

      <div className="archive-content archive-grid-two">
        <ArchivePanel title="Congressional directory" kicker="Jurisdiction and rosters" action={<span className="font-mono text-xs text-muted-foreground">{filtered.length} shown</span>}>
          {loading ? (
            <output className="block p-12 text-center text-muted-foreground">Loading committees...</output>
          ) : error ? (
            <DataState kind="error" title="Committee directory unavailable" description={`${error}. An API failure is not shown as an empty committee list.`} />
          ) : filtered.length === 0 ? (
            <DataState title="No committees match these filters" description="Clear the search or choose another chamber to return to the loaded committee directory." action={<Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <div className="divide-y divide-border border-t border-border">
              {filtered.map((committee) => (
                <Link
                  key={committee.committee_id}
                  href={`/committees/${committee.committee_id}`}
                  className="block px-2 py-4 transition-colors hover:bg-muted/30 sm:px-4"
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="archive-chip">{committee.chamber}</span>
                        <span className="font-mono text-xs font-semibold uppercase text-accent">
                          {committee.committee_id}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-foreground">{committee.name}</h3>
                      {committee.jurisdiction ? (
                        <p className="line-clamp-2 max-w-3xl text-sm text-muted-foreground">
                          {committee.jurisdiction}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Jurisdiction summary not available in this response.</p>
                      )}
                    </div>
                    <div className="flex min-h-11 shrink-0 items-center text-sm font-medium text-primary">
                      View roster <ArrowRight className="ml-1 h-4 w-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ArchivePanel>

        <div className="grid content-start gap-4 lg:sticky lg:top-36 lg:self-start">
          <ArchivePanel title="Directory evidence" kicker="Provenance">
            <EvidenceSpine
              source={latestSource?.source || "CongressTracker committee API"}
              status={error ? "API request failed" : loading ? "Loading" : latestSource?.status || "Response loaded"}
              updated={latestSource?.fetched_at}
              coverage={loading ? "Pending" : `${committees.length} committees loaded; ${filtered.length} match the current view`}
            >
              <p className="text-sm leading-6 text-muted-foreground">
                Chamber counts describe the complete loaded response. Search and chamber filters run locally so the totals do not change meaning.
              </p>
            </EvidenceSpine>
          </ArchivePanel>

          <ArchivePanel title="Chamber coverage" kicker="Current response">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="archive-metric-label">All</dt><dd className="mt-1 font-mono text-xl text-foreground"><Landmark className="mr-1 inline" size={16} />{committees.length}</dd></div>
              <div><dt className="archive-metric-label">House</dt><dd className="mt-1 font-mono text-xl text-foreground">{houseCount}</dd></div>
              <div><dt className="archive-metric-label">Senate</dt><dd className="mt-1 font-mono text-xl text-foreground">{senateCount}</dd></div>
              <div><dt className="archive-metric-label">Joint</dt><dd className="mt-1 font-mono text-xl text-foreground">{jointCount}</dd></div>
            </dl>
          </ArchivePanel>
        </div>
      </div>
    </ArchivePage>
  )
}
