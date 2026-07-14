import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, Building2, Landmark, Network, Users } from "lucide-react"
import { ArchivePanel } from "@/components/ui/archive-ui"
import { classifyFundingCoverage } from "@/lib/funding-coverage.mjs"
import type { MemberFunding } from "@/lib/services/funding"

function money(value: number | null | undefined) {
  if (value == null) return "Not loaded"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1_000_000 ? 1 : 0,
  }).format(value)
}

export function MemberFundingSection({ funding }: { funding: MemberFunding }) {
  const coverage = classifyFundingCoverage(funding)
  const committeeRows = funding.committee_relationships?.length
    ? funding.committee_relationships
    : funding.top_committees ?? []

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Direct receipts", value: funding.direct_receipts, icon: Landmark, tone: "border-accent" },
          { label: "Individual receipts", value: funding.individual_receipts, icon: Users, tone: "border-accent" },
          { label: "PAC receipts", value: funding.pac_receipts, icon: Building2, tone: "border-accent" },
          { label: "Independent support", value: funding.independent_expenditures_supporting, icon: ArrowUpRight, tone: "border-emerald-500" },
          { label: "Independent opposition", value: funding.independent_expenditures_opposing, icon: ArrowDownRight, tone: "border-red-500" },
        ].map((metric) => (
          <div key={metric.label} className={`border border-border border-l-4 ${metric.tone} bg-card p-4`}>
            <metric.icon size={17} className="text-muted-foreground" aria-hidden="true" />
            <div className="mt-4 font-serif text-2xl font-semibold text-foreground">{money(metric.value)}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</div>
          </div>
        ))}
      </div>

      <div className="border border-border bg-card/40 p-4 text-sm leading-6 text-muted-foreground">
        Cycle <strong className="text-foreground">{funding.cycle}</strong>. Direct receipts, committee transfers, independent support, and independent opposition remain separate legal and evidentiary channels. Opposition spending is never described as money received by the member.
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ArchivePanel
          title="Top reported contributors"
          kicker={coverage.hasCanonicalRankings ? "Canonical complete-cycle ranking" : "Coverage-limited view"}
          action={<span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{funding.top_donors.length} rows</span>}
        >
          {funding.top_donors.length > 0 ? (
            <ol className="divide-y divide-border">
              {funding.top_donors.map((donor, index) => (
                <li key={`${donor.contributor_name}-${index}`} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 py-4">
                  <span className="font-serif text-2xl text-muted-foreground/60">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{donor.contributor_name}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{donor.count.toLocaleString()} records</div>
                  </div>
                  <strong className="font-mono text-sm text-foreground">{money(donor.amount)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              {coverage.totalsOnly
                ? "Official totals are available, but canonical contributor rankings are unavailable until the cycle-complete records reconcile."
                : "No ranked contributor rows are loaded for this member and cycle."}
            </p>
          )}
        </ArchivePanel>

        <ArchivePanel title="Committee relationships" kicker="Verified FEC identities">
          {committeeRows.length > 0 ? (
            <div className="space-y-3">
              {committeeRows.map((committee) => (
                <div key={`${committee.committee_id}-${committee.relationship_type ?? "relationship"}`} className="border border-border bg-card/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/search?q=${encodeURIComponent(committee.committee_id)}`} className="font-serif text-lg font-semibold text-foreground hover:text-accent">
                        {committee.committee_name}
                      </Link>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {committee.committee_id} · {committee.relationship_type || "Committee record"}
                      </div>
                    </div>
                    <strong className="font-mono text-sm text-foreground">{money(committee.amount)}</strong>
                  </div>
                  {committee.resolution_status ? <p className="mt-3 text-xs text-muted-foreground">Identity status: {committee.resolution_status}</p> : null}
                </div>
              ))}
            </div>
          ) : <p className="text-sm leading-6 text-muted-foreground">No verified committee relationship rows are loaded for this cycle.</p>}
        </ArchivePanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ArchivePanel title="Influence networks" kicker="Channel-separated context">
          {funding.influence_networks.length > 0 ? (
            <div className="space-y-3">
              {funding.influence_networks.map((network) => (
                <Link key={network.network_slug} href={`/influence/${network.network_slug}`} className="block border border-border bg-card/50 p-4 transition-colors hover:border-accent/70">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground"><Network size={16} aria-hidden="true" /> {network.display_name}</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Confidence: {network.confidence}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>Direct {money(network.direct_pac)}</div>
                      <div className="mt-1">Support {money(network.independent_supporting)}</div>
                      <div className="mt-1">Opposition {money(network.independent_opposing)}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="text-sm leading-6 text-muted-foreground">No verified influence-network mapping is loaded for this member and cycle.</p>}
        </ArchivePanel>

        <ArchivePanel title="Leadership PACs" kicker="Separate committee entities">
          {funding.leadership_pacs.length > 0 ? (
            <div className="space-y-3">
              {funding.leadership_pacs.map((pac) => (
                <div key={pac.committee_id} className="border border-border bg-card/50 p-4">
                  <div className="font-serif text-lg font-semibold text-foreground">{pac.committee_name}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{pac.committee_id} · {pac.resolution_status}</div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div><dt className="text-muted-foreground">Receipts</dt><dd className="mt-1 font-mono text-foreground">{money(pac.total_receipts)}</dd></div>
                    <div><dt className="text-muted-foreground">Disbursements</dt><dd className="mt-1 font-mono text-foreground">{money(pac.total_disbursements)}</dd></div>
                    <div><dt className="text-muted-foreground">Cash</dt><dd className="mt-1 font-mono text-foreground">{money(pac.cash_on_hand)}</dd></div>
                  </dl>
                </div>
              ))}
            </div>
          ) : <p className="text-sm leading-6 text-muted-foreground">No leadership PAC record is loaded for this member.</p>}
        </ArchivePanel>
      </div>
    </div>
  )
}
