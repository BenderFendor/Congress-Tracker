"use client"

import "./election-map.css"

import { useState, useEffect, useMemo } from "react"
import { CompactMasthead, ElectionsHierarchyVisual } from "@/components/ui/mockup-visuals"
import { ElectionMap } from "@/components/elections/election-map"
import { createLogger } from "@/lib/tracing"
import { getChamberDashboard, type ChamberDashboard } from "@/lib/services/chambers"
import { getAllCandidates, type FECandidate } from "@/lib/services/fec"
import { formatCurrency } from "@/lib/format"
import {
  ArchivePage,
  ArchivePanel,
  ArchiveMetrics,
  DataState,
  EvidenceSpine,
} from "@/components/ui/archive-ui"

const log = createLogger("ElectionsPage")

type Party = "democratic" | "republican" | "independent" | "other"

function partyClass(party: string | undefined): Party {
  if (!party) return "other"
  const lower = party.toLowerCase()
  if (lower.includes("democrat")) return "democratic"
  if (lower.includes("republican")) return "republican"
  if (lower.includes("independent") || lower.includes("libertarian") || lower.includes("nonpartisan")) return "independent"
  return "other"
}

function partyShort(party: string | undefined): string {
  const p = partyClass(party)
  if (p === "democratic") return "D"
  if (p === "republican") return "R"
  if (p === "independent") return "I"
  return "O"
}

function partyColor(party: string | undefined): string {
  const p = partyClass(party)
  if (p === "democratic") return "var(--party-dem)"
  if (p === "republican") return "var(--party-rep)"
  if (p === "independent") return "var(--party-ind)"
  return "var(--party-other)"
}

function statusPillClass(status: FECandidate["status"]): string {
  if (status === "incumbent") return "election-status--incumbent"
  if (status === "open") return "election-status--open"
  if (status === "primary") return "election-status--primary"
  if (status === "challenger") return "election-status--challenger"
  return "election-status--unknown"
}

function statusLabel(status: FECandidate["status"]): string {
  if (status === "incumbent") return "Incumbent"
  if (status === "open") return "Open seat"
  if (status === "primary") return "Primary"
  if (status === "challenger") return "Challenger"
  return "Filed"
}

function officeLabel(office: string | undefined): string {
  if (office === "H") return "House"
  if (office === "S") return "Senate"
  if (office === "P") return "President"
  return "—"
}

function ChamberBar({
  breakdown,
  total,
}: {
  breakdown: Record<string, number> | undefined
  total: number
}) {
  if (!breakdown || total === 0) {
    return <div className="election-chamber-bar empty">No party data loaded</div>
  }
  const parties = ["Democratic", "Republican", "Independent", "Other"]
  const segments = parties
    .map((p) => ({
      party: p,
      count: breakdown[p] ?? 0,
      pct: ((breakdown[p] ?? 0) / total) * 100,
      cls: partyClass(p),
    }))
    .filter((s) => s.count > 0)
  return (
    <figure className="election-chamber-bar">
      <figcaption className="sr-only">Party seat distribution</figcaption>
      {segments.map((s) => (
        <div
          key={s.party}
          className={`election-chamber-bar-segment ${s.cls}`}
          style={{ width: `${s.pct}%` }}
          title={`${s.party}: ${s.count} (${s.pct.toFixed(1)}%)`}
        />
      ))}
    </figure>
  )
}

export default function ElectionsPage() {
  const [electionCycle, setElectionCycle] = useState(2024)
  const [houseDash, setHouseDash] = useState<ChamberDashboard | null>(null)
  const [senateDash, setSenateDash] = useState<ChamberDashboard | null>(null)
  const [candidates, setCandidates] = useState<FECandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null)

  function handleStateChange(fips: string | null) {
    setSelectedState(fips)
    setSelectedCounty(null)
  }

  useEffect(() => {
    async function loadElectionsData() {
      setLoading(true)
      setError(null)
      try {
        const [hDash, sDash, cands] = await Promise.all([
          getChamberDashboard("house", 119),
          getChamberDashboard("senate", 119),
          getAllCandidates(undefined, undefined, electionCycle),
        ])
        setHouseDash(hDash)
        setSenateDash(sDash)
        setCandidates(cands)
      } catch (err) {
        log.error("Error loading election dashboards:", { error: String(err) })
        setError(err instanceof Error ? err.message : "Election data request failed")
      } finally {
        setLoading(false)
      }
    }
    loadElectionsData()
  }, [electionCycle])

  const houseSeats = 435
  const senateSeats = 33
  const incumbentsCount = candidates.filter((c) => c.incumbent === true).length
  const challengersCount = candidates.filter((c) => c.status === "challenger" || c.status === "open").length
  const visibleCandidates = useMemo(
    () => (selectedState ? candidates.filter((candidate) => candidate.state === selectedState) : candidates),
    [candidates, selectedState],
  )
  const districtSummary = useMemo(() => {
    if (!selectedState) return []
    const districts = new Map<string, { total: number; parties: Map<string, number> }>()
    visibleCandidates.forEach((candidate) => {
      const district = candidate.district || "At-large"
      const current = districts.get(district) || { total: 0, parties: new Map<string, number>() }
      current.total += 1
      const party = candidate.party || "Other"
      current.parties.set(party, (current.parties.get(party) || 0) + 1)
      districts.set(district, current)
    })
    return [...districts.entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
  }, [selectedState, visibleCandidates])

  const knownReceipts = (dashboard: ChamberDashboard | null) =>
    dashboard && dashboard.total_direct_receipts > 0 ? formatCurrency(dashboard.total_direct_receipts) : "Not loaded"

  const houseTotal = useMemo(() => {
    if (!houseDash?.party_breakdown) return 0
    return Object.values(houseDash.party_breakdown).reduce((a, b) => a + b, 0)
  }, [houseDash])
  const senateTotal = useMemo(() => {
    if (!senateDash?.party_breakdown) return 0
    return Object.values(senateDash.party_breakdown).reduce((a, b) => a + b, 0)
  }, [senateDash])

  const metrics = [
    { label: "Election Cycle", value: String(electionCycle) },
    { label: "House Seats Up", value: houseSeats },
    { label: "Senate Seats Up", value: "33 (Class II)" },
    { label: "Total Candidates", value: candidates.length },
  ]

  return (
    <ArchivePage>
      <CompactMasthead
        eyebrow="Federal campaign geography"
        title="Election"
        accent="atlas."
        description={`Explore the federal candidate records currently loaded for the ${electionCycle} cycle, then narrow from state to district without treating missing data as a race forecast.`}
        visual={<ElectionsHierarchyVisual />}
      />

      <ArchiveMetrics metrics={metrics} />

      {error && (
        <DataState
          kind="error"
          title="Election records unavailable"
          description={`${error}. Counts and blank map cells are not presented as confirmed zeroes.`}
        />
      )}

      <EvidenceSpine
        identifier={`Federal candidates / ${electionCycle}`}
        source="Federal Election Commission candidate records"
        status={error ? "Request failed" : loading ? "Loading" : "Loaded"}
        coverage={`${candidates.length} candidate rows with state and district fields shown when published`}
      />

      <ArchivePanel title="Cycle" kicker="Switch loaded FEC data">
        <div className="election-cycle-row">
          <span className="election-cycle-label">Loaded cycle:</span>
          {[2024, 2026].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setElectionCycle(c)}
              className={`election-cycle-btn${c === electionCycle ? " is-active" : ""}`}
              aria-pressed={c === electionCycle}
            >
              {c}
            </button>
          ))}
          <span className="election-cycle-status">
            {candidates.length > 0
              ? `${candidates.length} candidate rows loaded`
              : loading
                ? "Loading…"
                : "No rows for this cycle"}
          </span>
        </div>
      </ArchivePanel>

      {/* ATLAS HERO */}
      <ArchivePanel title="Race map" kicker="Interactive U.S. atlas">
        <div className="p-0 election-atlas-wrap">
          <ElectionMap
            candidates={candidates}
            loading={loading}
            error={error}
            selectedState={selectedState}
            selectedCounty={selectedCounty}
            onStateChange={handleStateChange}
            onCountyChange={setSelectedCounty}
            cycle={electionCycle}
          />
        </div>
      </ArchivePanel>

      {/* CHAMBER SUMMARIES with party share bars */}
      <div className="grid grid-cols-1 gap-4 my-6 md:grid-cols-2">
        <ArchivePanel title="U.S. House of Representatives" kicker="Chamber summary">
          <div className="election-chamber">
            <div className="election-chamber-headline">
              <div>
                <div className="election-chamber-kicker">Total seats loaded</div>
                <div className="election-chamber-total">
                  {houseTotal > 0 ? houseTotal : "—"}
                  <span className="election-chamber-of">/ {houseSeats}</span>
                </div>
              </div>
              <ChamberBar breakdown={houseDash?.party_breakdown} total={houseTotal} />
            </div>
            {houseDash?.party_breakdown && (
              <div className="election-chamber-rows">
                {Object.entries(houseDash.party_breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([party, count]) => (
                    <div key={party} className="election-chamber-row">
                      <span className={`election-chamber-dot ${partyClass(party)}`} />
                      <span className="election-chamber-name">{party}</span>
                      <span className="election-chamber-count">{count}</span>
                      <span className="election-chamber-pct">
                        {((count / Math.max(1, houseTotal)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            )}
            <div className="election-chamber-footer">
              <span className="election-chamber-kicker">Direct receipts tracked</span>
              <span className="election-chamber-receipts">{knownReceipts(houseDash)}</span>
            </div>
          </div>
        </ArchivePanel>

        <ArchivePanel title="U.S. Senate" kicker="Chamber summary">
          <div className="election-chamber">
            <div className="election-chamber-headline">
              <div>
                <div className="election-chamber-kicker">Seats loaded / up this cycle</div>
                <div className="election-chamber-total">
                  {senateTotal > 0 ? senateTotal : "—"}
                  <span className="election-chamber-of">/ {senateSeats}</span>
                </div>
              </div>
              <ChamberBar breakdown={senateDash?.party_breakdown} total={senateTotal} />
            </div>
            {senateDash?.party_breakdown && (
              <div className="election-chamber-rows">
                {Object.entries(senateDash.party_breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([party, count]) => (
                    <div key={party} className="election-chamber-row">
                      <span className={`election-chamber-dot ${partyClass(party)}`} />
                      <span className="election-chamber-name">{party}</span>
                      <span className="election-chamber-count">{count}</span>
                      <span className="election-chamber-pct">
                        {((count / Math.max(1, senateTotal)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            )}
            <div className="election-chamber-footer">
              <span className="election-chamber-kicker">Direct receipts tracked</span>
              <span className="election-chamber-receipts">{knownReceipts(senateDash)}</span>
            </div>
          </div>
        </ArchivePanel>
      </div>

      {/* CANDIDATE ACTIVITY as cards */}
      <ArchivePanel
        title={selectedState ? `${selectedState} candidate activity` : "Candidate activity"}
        kicker="FEC records loaded for this cycle"
      >
        <div className="p-6">
          {selectedState && (
            <button
              type="button"
              onClick={() => handleStateChange(null)}
              className="election-clear-btn"
            >
              ← Clear state selection
            </button>
          )}
          {selectedState && districtSummary.length > 0 && (
            <div className="mb-6 border-b border-border pb-5">
              <div className="mb-3 text-xs font-mono uppercase text-muted-foreground">
                District view · {selectedState}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {districtSummary.map(([district, summary]) => {
                  const leading = [...summary.parties.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] || "—"
                  return (
                    <div
                      key={district}
                      className="election-district-card"
                      style={{ borderLeftColor: partyColor(leading) }}
                    >
                      <div className="font-mono text-xs font-bold text-foreground">
                        {selectedState}-{district}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {summary.total} candidate row{summary.total === 1 ? "" : "s"} · {leading}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {visibleCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidate records are available for this selection.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCandidates.slice(0, 24).map((candidate) => (
                <div
                  key={candidate.candidate_id}
                  className={`election-candidate-card ${partyClass(candidate.party)}`}
                >
                  <div className="election-candidate-avatar" aria-hidden="true">
                    {partyShort(candidate.party)}
                  </div>
                  <div className="election-candidate-body">
                    <div className="election-candidate-name">{candidate.name}</div>
                    <div className="election-candidate-meta">
                      <span className="font-mono text-[0.7rem]">
                        {candidate.state || "—"}
                        {candidate.district ? `-${candidate.district}` : ""}
                      </span>
                      <span className="election-candidate-sep">·</span>
                      <span>{candidate.party || "Party unavailable"}</span>
                    </div>
                    <div className="election-candidate-bottom">
                      <span className={`election-status-pill ${statusPillClass(candidate.status)}`}>
                        {statusLabel(candidate.status)}
                      </span>
                      <span className="election-candidate-office">
                        {officeLabel(candidate.office_sought)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ArchivePanel>

      {/* INCUMBENCY with better hierarchy */}
      <ArchivePanel title="Incumbency & Reelection Defense" kicker={`${electionCycle} cycle summary`}>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="election-stat-card">
              <div className="election-stat-kicker">Tracked Incumbents</div>
              <div className="election-stat-value">{incumbentsCount}</div>
              <div className="election-stat-note">Seeking reelection in {electionCycle}</div>
            </div>
            <div className="election-stat-card">
              <div className="election-stat-kicker">Challengers & Open Seat Filers</div>
              <div className="election-stat-value">{challengersCount}</div>
              <div className="election-stat-note">Registered federal candidates</div>
            </div>
            <div className="election-stat-card">
              <div className="election-stat-kicker">Data coverage</div>
              <div className="election-stat-value accent">
                {candidates.length > 0 ? "Loaded" : "Missing"}
              </div>
              <div className="election-stat-note">FEC candidate rows for {electionCycle}</div>
            </div>
          </div>
        </div>
      </ArchivePanel>

      {/* ACTIVE CANDIDATES TABLE with party color borders */}
      <ArchivePanel title="Active Registered Federal Candidates" kicker="FEC Filings">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading candidate filings…</div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No candidate records loaded for this cycle.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="election-table">
              <thead>
                <tr>
                  <th>Candidate Identifier</th>
                  <th>Candidate Name</th>
                  <th>Party</th>
                  <th>Office Sought</th>
                  <th>State</th>
                  <th>Incumbent Status</th>
                </tr>
              </thead>
              <tbody>
                {candidates.slice(0, 100).map((cand) => (
                  <tr key={cand.candidate_id} className={partyClass(cand.party)}>
                    <td className="font-mono text-xs text-accent font-semibold">{cand.candidate_id}</td>
                    <td className="font-medium text-foreground">{cand.name}</td>
                    <td>
                      <span className="election-table-party">
                        <span className={`election-table-dot ${partyClass(cand.party)}`} />
                        {cand.party || "—"}
                      </span>
                    </td>
                    <td className="font-mono text-xs uppercase">{officeLabel(cand.office_sought)}</td>
                    <td>{cand.state || "—"}</td>
                    <td>
                      <span className={`election-status-pill ${statusPillClass(cand.status)}`}>
                        {statusLabel(cand.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ArchivePanel>
    </ArchivePage>
  )
}
