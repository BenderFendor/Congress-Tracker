"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { crossEntitySearch, type SearchResult, type SearchResponse } from "@/lib/services/search"
import { Button } from "@/components/ui/button"
import {
  ArchivePage,
  ArchiveHero,
  ArchivePanel,
  ArchiveMetrics,
  ArchiveSearch,
} from "@/components/ui/archive-ui"

const GROUPS = [
  { key: "member", title: "Members of Congress", kicker: "Legislators" },
  { key: "bill", title: "Legislation & Resolutions", kicker: "Bills" },
  { key: "committee", title: "Congressional Committees", kicker: "Committees" },
  { key: "pac", title: "Political Action Committees", kicker: "PACs & Super PACs" },
  { key: "lobbying_client", title: "Lobbying Clients", kicker: "Represented Entities" },
  { key: "lobbying_registrant", title: "Lobbying Registrants", kicker: "Firms & Lobbyists" },
] as const

type GroupKey = (typeof GROUPS)[number]["key"]

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [activeQuery, setActiveQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<SearchResponse>({ results: [], total: 0, query: "" })

  async function performSearch(q: string) {
    if (!q.trim()) {
      setResponse({ results: [], total: 0, query: "" })
      return
    }
    setLoading(true)
    setActiveQuery(q)
    try {
      const res = await crossEntitySearch(q)
      setResponse(res)
    } catch (err) {
      console.error("Search execution failed:", err)
    } finally {
      setLoading(false)
    }
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    performSearch(query)
  }

  // Grouping results
  const grouped: Record<GroupKey, SearchResult[]> = {
    member: [],
    bill: [],
    committee: [],
    pac: [],
    lobbying_client: [],
    lobbying_registrant: [],
  }

  for (const item of response.results) {
    if (grouped[item.type as GroupKey]) {
      grouped[item.type as GroupKey].push(item)
    }
  }

  const metrics = [
    { label: "Total Matches", value: response.total },
    { label: "Members", value: grouped.member.length },
    { label: "Bills", value: grouped.bill.length },
    { label: "Committees", value: grouped.committee.length },
    { label: "PACs", value: grouped.pac.length },
    { label: "Lobbying Clients", value: grouped.lobbying_client.length },
    { label: "Lobbying Firms", value: grouped.lobbying_registrant.length },
  ]

  function getFallbackUrl(item: SearchResult): string {
    if (item.url) return item.url
    switch (item.type) {
      case "member":
        return `/legislators/${item.id}`
      case "bill":
        return `/bills/${item.id}`
      case "committee":
        return `/committees/${item.id}`
      case "lobbying_client":
      case "lobbying_registrant":
        return `/lobbying/${item.id}`
      case "pac":
        return "#"
      default:
        return "#"
    }
  }

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Universal Intelligence Repository"
        title="Cross-Entity"
        accent="Search Engine"
        description="Search across current congressional members, legislative bills, committees, political action committees, lobbying firms, and represented corporate clients."
        mode="network"
      />

      <form onSubmit={handleSearchSubmit} className="my-8">
        <ArchiveSearch
          value={query}
          onChange={setQuery}
          placeholder="Enter keyword, bioguide ID, bill number (e.g., hr1-119), PAC name, or lobbying firm..."
        >
          <Button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Execute Search"}
          </Button>
        </ArchiveSearch>
      </form>

      {activeQuery && <ArchiveMetrics metrics={metrics} />}

      {loading ? (
        <ArchivePanel title="Executing Search Query" kicker="Processing">
          <div className="p-12 text-center text-muted-foreground">Searching database across all entity indexes...</div>
        </ArchivePanel>
      ) : !activeQuery ? (
        <ArchivePanel title="Search Index Ready" kicker="Instructions">
          <div className="p-12 text-center text-muted-foreground">
            Enter a search term above to query the unified intelligence database.
          </div>
        </ArchivePanel>
      ) : response.total === 0 ? (
        <ArchivePanel title="No Matches Found" kicker="Zero Results">
          <div className="p-12 text-center text-muted-foreground">
            No records matched query &quot;<span className="font-semibold text-foreground">{activeQuery}</span>&quot;. Try broadening your keywords.
          </div>
        </ArchivePanel>
      ) : (
        <div className="space-y-8 mt-8">
          {GROUPS.map((group) => {
            const items = grouped[group.key]
            return (
              <ArchivePanel
                key={group.key}
                title={group.title}
                kicker={group.kicker}
                action={
                  <div className="px-3 py-1 font-mono text-xs font-bold bg-accent/10 text-accent rounded-sm uppercase">
                    Count: {items.length}
                  </div>
                }
              >
                {items.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">No matches in this category.</div>
                ) : (
                  <div className="divide-y divide-border border-t border-border">
                    {items.map((item, idx) => {
                      const linkHref = getFallbackUrl(item)
                      return (
                        <Link
                          key={`${item.type}-${item.id}-${idx}`}
                          href={linkHref}
                          className="block p-4 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-xs text-accent uppercase font-semibold">
                                  {item.id}
                                </span>
                              </div>
                              <h4 className="font-bold text-foreground">{item.label}</h4>
                              {item.subtitle && (
                                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                            <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </ArchivePanel>
            )
          })}
        </div>
      )}
    </ArchivePage>
  )
}
