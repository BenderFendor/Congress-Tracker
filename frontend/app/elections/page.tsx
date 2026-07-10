"use client"

import { useState, useEffect, useMemo } from "react"
import { getChamberDashboard, type ChamberDashboard } from "@/lib/services/chambers"
import { getAllCandidates, type FECandidate } from "@/lib/services/fec"
import { formatCurrency } from "@/lib/format"
import {
  ArchivePage,
  ArchiveHero,
  ArchivePanel,
  ArchiveMetrics,
} from "@/components/ui/archive-ui"

type MapState = { code: string; x: number; y: number; label?: string }

// A compact, accessible cartogram. Coordinates are presentation-only; the
// fill and counts are always derived from the live FEC candidate response.
const NATIONAL_MAP: MapState[] = [
  { code: "WA", x: 54, y: 54 }, { code: "OR", x: 54, y: 108 }, { code: "CA", x: 54, y: 162 },
  { code: "NV", x: 116, y: 162 }, { code: "ID", x: 116, y: 54 }, { code: "UT", x: 116, y: 216 },
  { code: "AZ", x: 116, y: 270 }, { code: "MT", x: 178, y: 54 }, { code: "WY", x: 178, y: 108 },
  { code: "CO", x: 178, y: 162 }, { code: "NM", x: 178, y: 216 }, { code: "ND", x: 240, y: 54 },
  { code: "SD", x: 240, y: 108 }, { code: "NE", x: 240, y: 162 }, { code: "KS", x: 240, y: 216 },
  { code: "OK", x: 240, y: 270 }, { code: "TX", x: 240, y: 324 }, { code: "MN", x: 302, y: 54 },
  { code: "IA", x: 302, y: 108 }, { code: "MO", x: 302, y: 162 }, { code: "AR", x: 302, y: 216 },
  { code: "LA", x: 302, y: 270 }, { code: "WI", x: 364, y: 54 }, { code: "IL", x: 364, y: 108 },
  { code: "IN", x: 364, y: 162 }, { code: "MI", x: 426, y: 54 }, { code: "OH", x: 426, y: 108 },
  { code: "KY", x: 426, y: 162 }, { code: "TN", x: 426, y: 216 }, { code: "MS", x: 364, y: 270 },
  { code: "AL", x: 426, y: 270 }, { code: "GA", x: 488, y: 270 }, { code: "FL", x: 488, y: 324 },
  { code: "PA", x: 488, y: 108 }, { code: "NY", x: 550, y: 54 }, { code: "NJ", x: 550, y: 108 },
  { code: "MD", x: 550, y: 162 }, { code: "DE", x: 612, y: 108 }, { code: "VA", x: 550, y: 216 },
  { code: "WV", x: 488, y: 162 }, { code: "NC", x: 612, y: 216 }, { code: "SC", x: 612, y: 270 },
  { code: "ME", x: 674, y: 54 }, { code: "NH", x: 674, y: 108 }, { code: "VT", x: 612, y: 54 },
  { code: "MA", x: 736, y: 108 }, { code: "RI", x: 736, y: 162 }, { code: "CT", x: 674, y: 162 },
  { code: "AK", x: 54, y: 390 }, { code: "HI", x: 178, y: 390 },
]

export default function ElectionsPage() {
  const electionCycle = 2026
  const [houseDash, setHouseDash] = useState<ChamberDashboard | null>(null)
  const [senateDash, setSenateDash] = useState<ChamberDashboard | null>(null)
  const [candidates, setCandidates] = useState<FECandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedState, setSelectedState] = useState<string | null>(null)

  useEffect(() => {
    async function loadElectionsData() {
      setLoading(true)
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
        console.error("Error loading election dashboards:", err)
      } finally {
        setLoading(false)
      }
    }
    loadElectionsData()
  }, [])

  const houseSeats = 435
  const senateSeats = 33
  const incumbentsCount = candidates.filter((c) => c.incumbent === true).length
  const challengersCount = candidates.filter((c) => c.status === "challenger" || c.status === "open").length
  const stateSummary = Array.from(
    candidates.reduce((states, candidate) => {
      const state = candidate.state?.length === 2 ? candidate.state : null
      if (!state) return states
      const current = states.get(state) || { total: 0, democratic: 0, republican: 0, other: 0 }
      current.total += 1
      const party = candidate.party?.toLowerCase() || ""
      if (party.includes("democrat")) current.democratic += 1
      else if (party.includes("republican")) current.republican += 1
      else current.other += 1
      states.set(state, current)
      return states
    }, new Map<string, { total: number; democratic: number; republican: number; other: number }>()),
  ).sort(([, left], [, right]) => right.total - left.total)
  const stateSummaryMap = new Map(stateSummary)
  const visibleCandidates = useMemo(
    () => selectedState ? candidates.filter((candidate) => candidate.state === selectedState) : candidates,
    [candidates, selectedState],
  )
  const districtSummary = useMemo(() => {
    if (!selectedState) return []
    const districts = new Map<string, { total: number; parties: Map<string, number> }>()
    visibleCandidates.forEach((candidate) => {
      const district = candidate.district || "At-large / district unavailable"
      const current = districts.get(district) || { total: 0, parties: new Map<string, number>() }
      current.total += 1
      const party = candidate.party || "Party unavailable"
      current.parties.set(party, (current.parties.get(party) || 0) + 1)
      districts.set(district, current)
    })
    return [...districts.entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
  }, [selectedState, visibleCandidates])

  const knownReceipts = (dashboard: ChamberDashboard | null) =>
    dashboard && dashboard.total_direct_receipts > 0 ? formatCurrency(dashboard.total_direct_receipts) : "Not loaded"

  const metrics = [
    { label: "Election Cycle", value: "2026" },
    { label: "House Seats Up", value: houseSeats },
    { label: "Senate Seats Up", value: "33 (Class II)" },
    { label: "Total Candidates", value: candidates.length },
  ]

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow={`Federal Elections & Races / ${electionCycle} Cycle`}
        title="Congressional"
        accent="Elections"
        description="Comprehensive real-time tracking of federal congressional campaigns, incumbency defense, open seats, and independent expenditure financing."
        mode="capitol"
      />

      <ArchiveMetrics metrics={metrics} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8">
        {/* House Seat Counts & Dashboard */}
        <ArchivePanel title="U.S. House of Representatives" kicker="Chamber Summary">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <span className="text-sm font-medium text-muted-foreground">Total Chamber Seats</span>
              <span className="text-2xl font-bold font-mono text-foreground">{houseSeats}</span>
            </div>
            {houseDash?.party_breakdown && (
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase text-muted-foreground">Party Composition</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(houseDash.party_breakdown).map(([party, count]) => (
                    <div key={party} className="p-2 bg-muted/40 rounded border border-border flex justify-between">
                      <span className="font-semibold">{party}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-2">
              <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Direct receipts tracked</div>
              <div className="text-lg font-mono font-bold text-foreground">{knownReceipts(houseDash)}</div>
            </div>
          </div>
        </ArchivePanel>

        {/* Senate Seat Counts & Dashboard */}
        <ArchivePanel title="U.S. Senate" kicker="Chamber Summary">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <span className="text-sm font-medium text-muted-foreground">Total Chamber Seats</span>
              <span className="text-2xl font-bold font-mono text-foreground">{senateSeats}</span>
            </div>
            {senateDash?.party_breakdown && (
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase text-muted-foreground">Party Composition</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(senateDash.party_breakdown).map(([party, count]) => (
                    <div key={party} className="p-2 bg-muted/40 rounded border border-border flex justify-between">
                      <span className="font-semibold">{party}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-2">
              <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Direct receipts tracked</div>
              <div className="text-lg font-mono font-bold text-foreground">{knownReceipts(senateDash)}</div>
            </div>
          </div>
        </ArchivePanel>
      </div>

      <ArchivePanel title="Race map" kicker="Candidate activity by state">
        <div className="p-6">
          {stateSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No state-coded candidate records are available for this cycle.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-border bg-slate-950/5 p-2">
              <svg viewBox="0 0 820 470" className="h-auto min-w-[680px] w-full">
                <title>Interactive cartogram showing 2026 FEC candidate activity by state</title>
                <rect x="0" y="0" width="820" height="470" rx="8" fill="currentColor" className="text-background" />
                {NATIONAL_MAP.map(({ code, x, y }) => {
                  const summary = stateSummaryMap.get(code)
                  const total = summary?.total ?? 0
                  const demShare = total ? (summary?.democratic ?? 0) / total : 0
                  const repShare = total ? (summary?.republican ?? 0) / total : 0
                  const fill = total === 0 ? "#334155" : demShare > repShare ? "#2563eb" : repShare > demShare ? "#dc2626" : "#b7791f"
                  const isSelected = selectedState === code
                  return (
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG cartogram cells need keyboard semantics without fake HTML overlays.
                    <g key={code} role="button" tabIndex={0} aria-label={`${code}: ${total} candidates`} aria-pressed={isSelected} onClick={() => setSelectedState(isSelected ? null : code)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedState(isSelected ? null : code) } }} className="cursor-pointer outline-none">
                      <rect x={x} y={y} width="56" height="42" rx="3" fill={fill} opacity={total === 0 ? 0.38 : 0.92} stroke={isSelected ? "#fbbf24" : "#f8fafc"} strokeWidth={isSelected ? 4 : 1} />
                      <text x={x + 28} y={y + 18} textAnchor="middle" fill="white" fontSize="12" fontWeight="700">{code}</text>
                      <text x={x + 28} y={y + 34} textAnchor="middle" fill="white" fontSize="10">{total || "—"}</text>
                    </g>
                  )
                })}
                <text x="54" y="458" fill="currentColor" className="text-muted-foreground" fontSize="11">AK</text>
                <text x="178" y="458" fill="currentColor" className="text-muted-foreground" fontSize="11">HI</text>
              </svg>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />Democratic</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Republican</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />Mixed</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-500" />No candidate rows</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Each tile is selectable. The number is the count of FEC candidate rows returned for {electionCycle}; colors show the party majority of those rows, not a projected election result.</p>
        </div>
      </ArchivePanel>

      <ArchivePanel title={selectedState ? `${selectedState} candidate activity` : "Candidate activity"} kicker="FEC records loaded for this cycle">
        <div className="p-6">
          {selectedState && <button type="button" onClick={() => setSelectedState(null)} className="mb-4 text-xs font-semibold text-accent">Clear state selection</button>}
          {selectedState && districtSummary.length > 0 && (
            <div className="mb-6 border-b border-border pb-5">
              <div className="mb-3 text-xs font-mono uppercase text-muted-foreground">District view · {selectedState}</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {districtSummary.map(([district, summary]) => {
                  const leadingParty = [...summary.parties.entries()].sort(([, left], [, right]) => right - left)[0]?.[0] || "Party unavailable"
                  return <div key={district} className="rounded border border-border bg-muted/20 p-3"><div className="font-mono text-xs font-bold text-foreground">{selectedState}-{district}</div><div className="mt-1 text-xs text-muted-foreground">{summary.total} candidate row{summary.total === 1 ? "" : "s"} · {leadingParty}</div></div>
                })}
              </div>
            </div>
          )}
          {visibleCandidates.length === 0 ? <p className="text-sm text-muted-foreground">No candidate records are available for this selection.</p> : (
            <div className="grid gap-2 md:grid-cols-2">
              {visibleCandidates.slice(0, 24).map((candidate) => (
                <div key={candidate.candidate_id} className="flex items-center justify-between border-b border-border py-3 text-sm">
                  <div><div className="font-semibold">{candidate.name}</div><div className="text-xs text-muted-foreground">{candidate.state}{candidate.district ? `-${candidate.district}` : ""} · {candidate.party || "Party unavailable"}</div></div>
                  <span className="text-xs uppercase text-muted-foreground">{candidate.status || "status unavailable"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </ArchivePanel>

      {/* Incumbency & Reelection Status Summary */}
      <ArchivePanel title="Incumbency & Reelection Defense" kicker="2026 Cycle Summary">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 border border-border rounded-sm bg-card">
              <div className="text-xs font-mono uppercase text-muted-foreground">Tracked Incumbents</div>
              <div className="text-3xl font-bold text-foreground mt-2">{incumbentsCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Seeking reelection in 2026</div>
            </div>
            <div className="p-4 border border-border rounded-sm bg-card">
              <div className="text-xs font-mono uppercase text-muted-foreground">Challengers & Open Seat Filers</div>
              <div className="text-3xl font-bold text-foreground mt-2">{challengersCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Registered federal candidates</div>
            </div>
            <div className="p-4 border border-border rounded-sm bg-card">
              <div className="text-xs font-mono uppercase text-muted-foreground">Data coverage</div>
              <div className="text-3xl font-bold font-mono text-accent mt-2">{candidates.length > 0 ? "Loaded" : "Missing"}</div>
              <div className="text-xs text-muted-foreground mt-1">FEC candidate rows for {electionCycle}</div>
            </div>
          </div>
        </div>
      </ArchivePanel>

      {/* Candidate Roster Table */}
      <ArchivePanel title="Active Registered Federal Candidates" kicker="FEC Filings">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading candidate filings...</div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No candidate records loaded for this cycle.</div>
        ) : (
          <div className="border-t border-border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border font-mono text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Candidate Identifier</th>
                  <th className="p-3">Candidate Name</th>
                  <th className="p-3">Party</th>
                  <th className="p-3">Office Sought</th>
                  <th className="p-3">State</th>
                  <th className="p-3">Incumbent Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.slice(0, 100).map((cand) => (
                  <tr key={cand.candidate_id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs text-accent font-semibold">{cand.candidate_id}</td>
                    <td className="p-3 font-medium text-foreground">{cand.name}</td>
                    <td className="p-3">{cand.party || "-"}</td>
                    <td className="p-3 uppercase font-mono text-xs">{cand.office_sought || "-"}</td>
                    <td className="p-3">{cand.state || "-"}</td>
                    <td className="p-3">
                      {cand.status === "incumbent" ? (
                        <span className="px-2 py-0.5 text-xs font-mono bg-green-500/10 text-green-500 border border-green-500/20 rounded uppercase">
                          Incumbent
                        </span>
                      ) : cand.status === "open" ? (
                        <span className="px-2 py-0.5 text-xs font-mono bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded uppercase">Open seat</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-mono bg-muted text-muted-foreground rounded uppercase">
                          {cand.status === "primary" ? "Primary" : "Challenger"}
                        </span>
                      )}
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
