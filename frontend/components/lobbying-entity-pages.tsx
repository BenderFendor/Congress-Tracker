"use client"

import Link from "next/link"
import { useCallback, useDeferredValue, useEffect, useState } from "react"
import { ArrowLeft, Building2, FileSearch, SearchX, Users } from "lucide-react"
import { ArchiveHero, ArchiveMetrics, ArchivePage, ArchivePanel, ArchiveSearch, DataState, EvidenceSpine } from "@/components/ui/archive-ui"
import { getLobbyingEntities, getLobbyingEntity, type LobbyingEntity, type LobbyingEntityKind } from "@/lib/services/lobbying"

const labels: Record<LobbyingEntityKind, string> = {
  clients: "Lobbying clients",
  registrants: "Lobbying registrants",
  lobbyists: "Lobbyists",
}

const descriptions: Record<LobbyingEntityKind, string> = {
  clients: "Organizations represented in official LDA filings",
  registrants: "Firms and organizations that register lobbying activity",
  lobbyists: "People identified by stable Senate LDA identifiers",
}

const entityKinds = Object.keys(labels) as LobbyingEntityKind[]

function EntitySwitcher({ active }: { active: LobbyingEntityKind }) {
  return (
    <nav className="entity-switcher" aria-label="Lobbying entity type">
      {entityKinds.map((kind) => (
        <Link key={kind} href={`/lobbying/${kind}`} aria-current={kind === active ? "page" : undefined}>
          {labels[kind]}
        </Link>
      ))}
    </nav>
  )
}

export function LobbyingEntityListPage({ kind }: { kind: LobbyingEntityKind }) {
  const [search, setSearch] = useState("")
  const [entities, setEntities] = useState<LobbyingEntity[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(25)
  const deferredSearch = useDeferredValue(search)

  const load = useCallback(async () => {
    const result = await getLobbyingEntities(kind, deferredSearch, limit)
    setEntities(result.entities)
    setTotal(result.total)
  }, [deferredSearch, kind, limit])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    load()
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Lobbying entity request failed")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [load])

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Official LDA entity index"
        title={labels[kind]}
        accent="index"
        description={descriptions[kind]}
        mode="network"
        actions={<EntitySwitcher active={kind} />}
      />
      <ArchiveMetrics metrics={[
        { label: "Official identities", value: total.toLocaleString(), detail: labels[kind], icon: <Users size={18} /> },
        { label: "Visible records", value: entities.length.toLocaleString(), detail: search ? "Filtered result window" : "Current result window", icon: <FileSearch size={18} /> },
        { label: "Evidence rail", value: "LDA", detail: "Kept separate from FEC totals", icon: <Building2 size={18} /> },
        { label: "Source state", value: error ? "Failed" : loading ? "Loading" : "Loaded", detail: "Canonical backend request" },
      ]} />
      <div className="entity-browser-toolbar">
        <ArchiveSearch value={search} onChange={(value) => { setSearch(value); setLimit(25) }} placeholder={`Search ${labels[kind].toLowerCase()}`}>
          {search ? (
            <button className="entity-clear-search" onClick={() => { setSearch(""); setLimit(25) }} type="button">
              <SearchX size={16} /> Clear
            </button>
          ) : null}
        </ArchiveSearch>
      </div>
      <div className="archive-content">
      <ArchivePanel
        className="entity-directory-panel"
        title={labels[kind]}
        kicker={`${entities.length.toLocaleString()} of ${total.toLocaleString()} identities shown`}
        action={!loading && !error ? <span className="archive-chip">{deferredSearch ? `Filtered by ${deferredSearch}` : "Canonical index"}</span> : undefined}
      >
        {loading ? (
          <DataState title={`Loading ${labels[kind].toLowerCase()}`} description="Requesting normalized LDA identities from the canonical backend." />
        ) : error ? (
          <DataState kind="error" title={`${labels[kind]} unavailable`} description={`${error}. This failed request is not presented as an empty result.`} />
        ) : entities.length === 0 ? (
          <DataState title="No matching identities" description="No loaded official identity matches this search." />
        ) : (
          <div className="entity-record-list">
            {entities.map((entity, index) => (
              <article key={entity.id} className="entity-record-row" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                <span className="entity-record-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-serif text-lg font-semibold">{entity.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[entity.state, entity.country].filter(Boolean).join(", ") || "Location not published"}
                  </p>
                </div>
                <span className="entity-record-count">{(entity.filing_count ?? 0).toLocaleString()} filings</span>
                <Link className="archive-link" href={`/lobbying/${kind}/${entity.id}`}>View filing history</Link>
              </article>
            ))}
            {entities.length < total ? (
              <button className="entity-load-more" type="button" onClick={() => setLimit((current) => current + 25)} disabled={loading}>
                {loading ? "Loading records" : `Load ${Math.min(25, total - entities.length)} more`}
              </button>
            ) : null}
          </div>
        )}
      </ArchivePanel>
      </div>
    </ArchivePage>
  )
}

export function LobbyingEntityDetailPage({ kind, id }: { kind: LobbyingEntityKind; id: string }) {
  const [entity, setEntity] = useState<LobbyingEntity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    getLobbyingEntity(kind, id)
      .then((result) => { if (active) setEntity(result) })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : "Lobbying entity request failed") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, kind])

  return (
    <ArchivePage>
      <div className="archive-context-bar">
        <Link className="archive-link" href={`/lobbying/${kind}`}><ArrowLeft size={14} /> {labels[kind]}</Link>
        <span>Official identity record</span>
      </div>
      <ArchiveHero
        eyebrow={`Official LDA ${kind.slice(0, -1)} record`}
        title={entity?.name || labels[kind]}
        accent={entity ? String(entity.id) : "record"}
        description="Filing history is kept separate from campaign-finance records and amounts."
        mode="network"
        actions={<EntitySwitcher active={kind} />}
      />
      {loading ? (
        <DataState title="Loading entity evidence" description="Requesting the official identity and filing history." />
      ) : error ? (
        <DataState kind="error" title="Entity unavailable" description={error} />
      ) : !entity ? (
        <DataState title="Entity not found" description="No canonical LDA identity matches this identifier." />
      ) : (
        <div className="archive-content archive-grid-two">
          <ArchivePanel title="Filing history" kicker={`${entity.filing_count ?? entity.filings?.length ?? 0} filings`}>
            {entity.filings?.length ? entity.filings.map((filing) => (
              <article key={filing.filing_uuid} className="border-b border-border py-4 last:border-0">
                <Link className="font-semibold text-foreground hover:text-accent" href={`/lobbying/${encodeURIComponent(filing.filing_uuid)}`}>
                  {filing.filing_year ?? "Year unavailable"} {filing.filing_period ?? "filing"}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[filing.registrant_name, filing.client_name].filter(Boolean).join(" for ") || "Parties not published"}
                </p>
                {filing.source_url ? <a className="archive-link mt-2" href={filing.source_url} target="_blank" rel="noreferrer">Official filing source</a> : null}
              </article>
            )) : <DataState title="No filing history loaded" description="The identity exists, but no linked filing rows are currently loaded." />}
          </ArchivePanel>
          <div className="archive-sticky-aside">
            <EvidenceSpine
              identifier={String(entity.id)}
              source="Senate Lobbying Disclosure Act"
              status="Loaded"
              coverage="Official identity fields and normalized filing links"
            />
          </div>
        </div>
      )}
    </ArchivePage>
  )
}
