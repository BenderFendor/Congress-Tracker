"use client"

import Link from "next/link"
import { useRef, useState, type FormEvent } from "react"
import { ArrowRight, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ArchivePage,
  ArchivePanel,
  ArchiveSearch,
  DataState,
  EvidenceSpine,
} from "@/components/ui/archive-ui"
import { CompactMasthead, SearchHeroVisual } from "@/components/ui/mockup-visuals"
import { crossEntitySearch, type SearchResult, type SearchResponse } from "@/lib/services/search"
import { createLogger } from "@/lib/tracing"

const GROUPS = [
  { key: "member", title: "Members of Congress", shortLabel: "Members" },
  { key: "bill", title: "Legislation and resolutions", shortLabel: "Bills" },
  { key: "committee", title: "Congressional committees", shortLabel: "Committees" },
  { key: "pac", title: "Political action committees", shortLabel: "PACs" },
  { key: "lobbying_client", title: "Lobbying clients", shortLabel: "Clients" },
  { key: "lobbying_registrant", title: "Lobbying registrants", shortLabel: "Registrants" },
] as const

type GroupKey = (typeof GROUPS)[number]["key"]
type GroupFilter = "all" | GroupKey

const EMPTY_RESPONSE: SearchResponse = { results: [], total: 0, query: "" }
const log = createLogger("SearchPage")

function resultKey(item: SearchResult): string {
  return `${item.type}-${item.id}`
}

function normalizeIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function resultSource(item: SearchResult): string {
  const provenanceSource = item.provenance?.sources[0]?.source
  if (provenanceSource) return provenanceSource
  switch (item.type) {
    case "member": return "CongressTracker member index"
    case "bill": return "CongressTracker legislative index"
    case "committee": return "CongressTracker committee index"
    case "pac": return "CongressTracker FEC committee index"
    case "lobbying_client": return "CongressTracker lobbying client index"
    case "lobbying_registrant": return "CongressTracker lobbying registrant index"
  }
}

function getResultUrl(item: SearchResult): string | null {
  if (item.url) return item.url
  switch (item.type) {
    case "member": return `/legislators/${item.id}`
    case "bill": return `/bills/${item.id}`
    case "committee": return `/committees/${item.id}`
    case "lobbying_client": return `/lobbying/clients/${item.id}`
    case "lobbying_registrant": return `/lobbying/registrants/${item.id}`
    case "pac": return `/organizations/${item.id}`
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [activeQuery, setActiveQuery] = useState("")
  const [activeGroup, setActiveGroup] = useState<GroupFilter>("all")
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<SearchResponse>(EMPTY_RESPONSE)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)

  async function performSearch(rawQuery: string) {
    const trimmedQuery = rawQuery.trim()
    const requestId = ++requestSequence.current
    if (!trimmedQuery) {
      setActiveQuery("")
      setResponse(EMPTY_RESPONSE)
      setSelectedResult(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setActiveQuery(trimmedQuery)
    setResponse(EMPTY_RESPONSE)
    setSelectedResult(null)
    setError(null)
    try {
      const nextResponse = await crossEntitySearch(trimmedQuery)
      if (requestId !== requestSequence.current) return
      setResponse(nextResponse)
      setSelectedResult(activeGroup === "all"
        ? nextResponse.results[0] ?? null
        : nextResponse.results.find((result) => result.type === activeGroup) ?? null)
    } catch (searchError) {
      if (requestId !== requestSequence.current) return
      log.error("Search execution failed", { error: String(searchError) })
      setError(searchError instanceof Error ? searchError.message : "Search request failed")
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
    }
  }

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault()
    void performSearch(query)
  }

  function clearSearch() {
    requestSequence.current += 1
    setQuery("")
    setActiveQuery("")
    setActiveGroup("all")
    setSelectedResult(null)
    setResponse(EMPTY_RESPONSE)
    setError(null)
    setLoading(false)
  }

  const grouped: Record<GroupKey, SearchResult[]> = {
    member: [],
    bill: [],
    committee: [],
    pac: [],
    lobbying_client: [],
    lobbying_registrant: [],
  }
  for (const item of response.results) grouped[item.type].push(item)

  const visibleGroups = activeGroup === "all"
    ? GROUPS.filter((group) => grouped[group.key].length > 0)
    : GROUPS.filter((group) => group.key === activeGroup)
  const visibleCount = activeGroup === "all" ? response.total : grouped[activeGroup].length
  const selectedUrl = selectedResult ? getResultUrl(selectedResult) : null
  const selectedProvenance = selectedResult?.provenance?.sources[0]
  const exactIdentifierMatch = selectedResult
    ? normalizeIdentifier(selectedResult.id) === normalizeIdentifier(activeQuery)
    : false

  function changeGroup(nextGroup: GroupFilter) {
    setActiveGroup(nextGroup)
    setSelectedResult(nextGroup === "all" ? response.results[0] ?? null : grouped[nextGroup][0] ?? null)
  }

  return (
    <ArchivePage>
      <CompactMasthead
        eyebrow="Cross-source retrieval"
        title="Search the"
        accent="public record."
        description="Find indexed members, legislation, committees, PACs, lobbying clients, and registrants from one query."
        visual={
          <SearchHeroVisual
            query="NVIDIA disclosure"
            counts={[
              { label: "trades", count: 18, color: "red" },
              { label: "members", count: 7, color: "blue" },
              { label: "committees", count: 4, color: "gold" },
            ]}
          />
        }
      />

      <form onSubmit={handleSearchSubmit} className="mt-4">
        <ArchiveSearch
          value={query}
          onChange={setQuery}
          placeholder="Search names, bill titles or IDs, committee jurisdictions, PACs, and lobbying entities"
        >
          <select
            aria-label="Filter search results by record type"
            value={activeGroup}
            onChange={(event) => changeGroup(event.target.value as GroupFilter)}
            disabled={!activeQuery || loading}
          >
            <option value="all">All record types{activeQuery ? ` (${response.total})` : ""}</option>
            {GROUPS.map((group) => (
              <option key={group.key} value={group.key}>
                {group.shortLabel}{activeQuery ? ` (${grouped[group.key].length})` : ""}
              </option>
            ))}
          </select>
          <Button className="min-h-11" type="submit" disabled={loading || !query.trim()}>
            {loading ? "Searching..." : "Search records"}
          </Button>
        </ArchiveSearch>
      </form>

      {activeQuery ? (
        <div className="mx-auto -mt-3 mb-4 flex w-[calc(100%-2rem)] max-w-[106rem] flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <strong className="text-foreground">{loading ? "Searching" : `${visibleCount} visible result${visibleCount === 1 ? "" : "s"}`}</strong>
          <span className="archive-chip">Query: {activeQuery}</span>
          {activeGroup !== "all" ? <span className="archive-chip">Type: {GROUPS.find((group) => group.key === activeGroup)?.shortLabel}</span> : null}
          <button className="ml-auto inline-flex min-h-10 items-center gap-1 px-2 font-semibold text-accent" type="button" onClick={clearSearch}>
            <X size={14} /> Clear search
          </button>
        </div>
      ) : null}

      <div className="archive-content archive-grid-two">
        <div className="min-w-0 space-y-4">
          {loading ? (
            <ArchivePanel title="Searching records" kicker="Query in progress">
              <output className="block py-10 text-center text-sm text-muted-foreground">Searching all six entity indexes...</output>
            </ArchivePanel>
          ) : error ? (
            <ArchivePanel title="Search unavailable" kicker="Request failed">
              <DataState kind="error" title="Cross-source search failed" description={`${error}. No previous or empty result set is presented as a successful response.`} />
            </ArchivePanel>
          ) : !activeQuery ? (
            <ArchivePanel title="Start with a record or subject" kicker="Search guidance">
              <DataState
                kind="setup"
                title="The search index is ready"
                description="Try a legislator surname, a policy phrase, a stored bill identifier such as HR1-119, a committee jurisdiction, a PAC name, or a lobbying organization."
              />
            </ArchivePanel>
          ) : response.total === 0 ? (
            <ArchivePanel title="No matching records" kicker="Zero results">
              <DataState
                title={`No records matched “${activeQuery}”`}
                description="Check the spelling or broaden the query. Member Bioguide IDs, committee IDs, and PAC IDs are not searched directly by every current index."
                action={<Button variant="outline" size="sm" onClick={clearSearch}>Clear search</Button>}
              />
            </ArchivePanel>
          ) : visibleCount === 0 ? (
            <ArchivePanel title="No matches in this record type" kicker="Filtered results">
              <DataState
                title="The query has matches in other categories"
                description={`No ${GROUPS.find((group) => group.key === activeGroup)?.shortLabel.toLowerCase()} matched “${activeQuery}”. Choose All record types to see the full response.`}
                action={<Button variant="outline" size="sm" onClick={() => changeGroup("all")}>Show all results</Button>}
              />
            </ArchivePanel>
          ) : (
            visibleGroups.map((group) => {
              const items = grouped[group.key]
              return (
                <ArchivePanel
                  key={group.key}
                  title={group.title}
                  kicker="Indexed records"
                  action={<span className="font-mono text-xs text-muted-foreground">{items.length} result{items.length === 1 ? "" : "s"}</span>}
                >
                  <div className="divide-y divide-border border-t border-border">
                    {items.map((item) => {
                      const linkHref = getResultUrl(item)
                      const isSelected = selectedResult ? resultKey(selectedResult) === resultKey(item) : false
                      const isExactIdentifier = normalizeIdentifier(item.id) === normalizeIdentifier(activeQuery)
                      const resultContent = (
                        <div className="flex min-w-0 items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-semibold uppercase text-accent">{item.id}</span>
                              {isExactIdentifier ? <span className="archive-chip">Exact identifier</span> : null}
                            </div>
                            <h3 className="font-bold text-foreground">{item.label}</h3>
                            {item.subtitle ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.subtitle}</p> : null}
                          </div>
                          {linkHref ? <ArrowRight className="h-4 w-4 shrink-0 text-primary" /> : <span className="shrink-0 text-xs text-muted-foreground">No detail page</span>}
                        </div>
                      )
                      return linkHref ? (
                        <Link
                          key={resultKey(item)}
                          href={linkHref}
                          onFocus={() => setSelectedResult(item)}
                          onMouseEnter={() => setSelectedResult(item)}
                          className={`block min-h-11 px-3 py-4 transition-colors hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${isSelected ? "bg-accent/5" : ""}`}
                        >
                          {resultContent}
                        </Link>
                      ) : (
                        <button
                          key={resultKey(item)}
                          type="button"
                          onClick={() => setSelectedResult(item)}
                          className={`block min-h-11 w-full px-3 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${isSelected ? "bg-accent/5" : ""}`}
                        >
                          {resultContent}
                        </button>
                      )
                    })}
                  </div>
                </ArchivePanel>
              )
            })
          )}
        </div>

        <div className="grid content-start gap-4 lg:sticky lg:top-36 lg:self-start">
          <ArchivePanel title={selectedResult?.label || "Search evidence"} kicker={selectedResult ? "Selected result" : "Index coverage"}>
            <EvidenceSpine
              identifier={selectedResult?.id}
              source={selectedResult ? resultSource(selectedResult) : "CongressTracker canonical search endpoint"}
              status={error ? "Request failed" : loading ? "Searching" : selectedResult ? selectedProvenance?.status || "Indexed match" : "Ready"}
              updated={selectedProvenance?.fetched_at}
              coverage={selectedResult
                ? exactIdentifierMatch ? "Exact identifier match" : `Matched query “${activeQuery}”`
                : "Members, bills, committees, PACs, lobbying clients, and registrants"}
            >
              {selectedResult ? (
                <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                  <p>{selectedResult.subtitle || "No additional summary is available for this result."}</p>
                  {selectedResult.provenance?.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                  {selectedUrl ? <Link className="archive-link" href={selectedUrl}>Open record <ArrowRight size={14} /></Link> : <p>This indexed record does not have a detail route yet.</p>}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">Select or focus a result to inspect its identifier, index source, match status, and available detail route.</p>
              )}
            </EvidenceSpine>
          </ArchivePanel>

          {activeQuery && !loading && !error ? (
            <ArchivePanel title="Response coverage" kicker="Current query">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {GROUPS.map((group) => (
                  <div key={group.key}>
                    <dt className="text-xs text-muted-foreground">{group.shortLabel}</dt>
                    <dd className="font-mono text-lg text-foreground">{grouped[group.key].length}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Counts describe this API response, not the total records stored in each source table. The endpoint does not expose per-index failure status, so a zero category count is not a source-health confirmation.
              </p>
            </ArchivePanel>
          ) : null}
        </div>
      </div>
    </ArchivePage>
  )
}
