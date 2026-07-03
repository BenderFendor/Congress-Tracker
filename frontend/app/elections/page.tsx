"use client"

import { useState, useEffect } from "react"
import { getChamberDashboard, type ChamberDashboard } from "@/lib/services/chambers"
import { getAllCandidates, type FECandidate } from "@/lib/services/fec"
import { formatCurrency } from "@/lib/format"
import {
  ArchivePage,
  ArchiveHero,
  ArchivePanel,
  ArchiveMetrics,
} from "@/components/ui/archive-ui"

export default function ElectionsPage() {
  const [houseDash, setHouseDash] = useState<ChamberDashboard | null>(null)
  const [senateDash, setSenateDash] = useState<ChamberDashboard | null>(null)
  const [candidates, setCandidates] = useState<FECandidate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadElectionsData() {
      setLoading(true)
      try {
        const [hDash, sDash, cands] = await Promise.all([
          getChamberDashboard("house", 119),
          getChamberDashboard("senate", 119),
          getAllCandidates(),
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

  const houseSeats = houseDash?.member_count || 435
  const senateSeats = senateDash?.member_count || 100
  const totalIndepExp = (houseDash?.total_independent_expenditures || 0) + (senateDash?.total_independent_expenditures || 0)
  const incumbentsCount = candidates.filter((c) => c.incumbent === true).length
  const challengersCount = candidates.filter((c) => c.incumbent !== true).length

  const metrics = [
    { label: "Election Cycle", value: "2026" },
    { label: "House Seats Up", value: houseSeats },
    { label: "Senate Seats Up", value: "33 (Class II)" },
    { label: "Total Candidates", value: candidates.length },
  ]

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Federal Elections & Races / 2026 Cycle"
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
              <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Independent Expenditures Tracked</div>
              <div className="text-lg font-mono font-bold text-foreground">
                {formatCurrency(houseDash?.total_independent_expenditures || 0)}
              </div>
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
              <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Independent Expenditures Tracked</div>
              <div className="text-lg font-mono font-bold text-foreground">
                {formatCurrency(senateDash?.total_independent_expenditures || 0)}
              </div>
            </div>
          </div>
        </ArchivePanel>
      </div>

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
              <div className="text-xs font-mono uppercase text-muted-foreground">Total Outside Spending</div>
              <div className="text-3xl font-bold font-mono text-accent mt-2">{formatCurrency(totalIndepExp)}</div>
              <div className="text-xs text-muted-foreground mt-1">Super PACs & independent committees</div>
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
                      {cand.incumbent ? (
                        <span className="px-2 py-0.5 text-xs font-mono bg-green-500/10 text-green-500 border border-green-500/20 rounded uppercase">
                          Incumbent
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-mono bg-muted text-muted-foreground rounded uppercase">
                          Challenger / Open
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
