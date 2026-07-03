"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getCommittees, type Committee } from "@/lib/services/committees"
import {
  ArchivePage,
  ArchiveHero,
  ArchivePanel,
  ArchiveMetrics,
  ArchiveSearch,
} from "@/components/ui/archive-ui"
import { Button } from "@/components/ui/button"

export default function CommitteesListPage() {
  const [committees, setCommittees] = useState<Committee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [chamberFilter, setChamberFilter] = useState<string>("")

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      try {
        const data = await getCommittees(chamberFilter || undefined)
        setCommittees(data)
      } catch (err) {
        console.error("Failed to fetch committees:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [chamberFilter])

  const filtered = committees.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.jurisdiction && c.jurisdiction.toLowerCase().includes(q)) ||
      c.committee_id.toLowerCase().includes(q)
    )
  })

  const houseCount = committees.filter((c) => c.chamber.toLowerCase() === "house").length
  const senateCount = committees.filter((c) => c.chamber.toLowerCase() === "senate").length
  const jointCount = committees.filter((c) => c.chamber.toLowerCase() === "joint").length

  const metrics = [
    { label: "Total Committees", value: committees.length },
    { label: "House", value: houseCount },
    { label: "Senate", value: senateCount },
    { label: "Joint", value: jointCount },
  ]

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Congressional Infrastructure"
        title="Committees &"
        accent="Jurisdictions"
        description="Official House, Senate, and Joint congressional committees governing legislative policy and oversight."
        mode="capitol"
      />

      <ArchiveMetrics metrics={metrics} />

      <div className="my-8">
        <ArchiveSearch
          value={search}
          onChange={setSearch}
          placeholder="Search committees by name, identifier, or policy jurisdiction..."
        >
          <div className="flex gap-2">
            <Button
              variant={chamberFilter === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setChamberFilter("")}
            >
              All Chambers
            </Button>
            <Button
              variant={chamberFilter === "House" ? "default" : "outline"}
              size="sm"
              onClick={() => setChamberFilter("House")}
            >
              House
            </Button>
            <Button
              variant={chamberFilter === "Senate" ? "default" : "outline"}
              size="sm"
              onClick={() => setChamberFilter("Senate")}
            >
              Senate
            </Button>
            <Button
              variant={chamberFilter === "Joint" ? "default" : "outline"}
              size="sm"
              onClick={() => setChamberFilter("Joint")}
            >
              Joint
            </Button>
          </div>
        </ArchiveSearch>
      </div>

      <ArchivePanel title="Congressional Directory" kicker="Rosters">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading committees...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No matching congressional committees found.</div>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {filtered.map((c) => (
              <Link
                key={c.committee_id}
                href={`/committees/${c.committee_id}`}
                className="block p-6 hover:bg-muted/30 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase px-2 py-0.5 bg-muted text-muted-foreground rounded">
                        {c.chamber}
                      </span>
                      <span className="font-mono text-xs text-accent uppercase font-semibold">
                        {c.committee_id}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{c.name}</h3>
                    {c.jurisdiction && (
                      <p className="text-sm text-muted-foreground line-clamp-2 max-w-3xl">
                        {c.jurisdiction}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center text-sm font-medium text-primary shrink-0">
                    View Roster <ArrowRight className="h-4 w-4 ml-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </ArchivePanel>
    </ArchivePage>
  )
}
