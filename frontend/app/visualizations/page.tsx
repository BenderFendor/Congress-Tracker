"use client";
import { BACKEND_URL } from "@/lib/constants";

import { ArchiveHero, ArchivePage, ArchivePanel } from "@/components/ui/archive-ui";
import { useEffect, useState } from "react";

interface SectorBreakdown {
  sector: string;
  total_receipts: number;
  committee_count: number;
}

interface CoverageMetadata {
  cycles_available: number[];
  data_freshness: string;
  source: string;
  direct_receipts: string;
  operating_disbursements: string;
  independent_expenditures: string;
  sector_limit: number;
}

interface CampaignFinanceData {
  cycle: number;
  by_sector: SectorBreakdown[];
  total_receipts: number;
  total_disbursements: number;
  independent_expenditures_supporting: number;
  independent_expenditures_opposing: number;
  committee_count: number;
  provenance: { sources: { source: string; status: string; confidence?: string }[]; warnings: string[] };
  coverage: CoverageMetadata;
}

export default function VisualizationsPage() {
  const [data, setData] = useState<CampaignFinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState(2026);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`${BACKEND_URL}/api/visualizations/campaign-finance?cycle=${cycle}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: CampaignFinanceData) => setData(d))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [cycle]);

  const maxReceipts = data ? Math.max(...data.by_sector.map((s) => s.total_receipts), 1) : 1;
  const hasAnyFinanceCoverage = data !== null && [
    data.coverage.direct_receipts,
    data.coverage.operating_disbursements,
    data.coverage.independent_expenditures,
  ].some((status) => status !== "not_loaded");

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);

  return (
    <ArchivePage>
      <ArchiveHero
        eyebrow="Evidence workspace"
        title="Visualizations"
        accent={data ? `Cycle ${data.cycle}` : "Loading..."}
        description="Campaign finance by sector with source provenance."
        mode="network"
      />

      {/* Cycle selector */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-border">
        <span className="text-sm text-muted-foreground">Cycle:</span>
        {[2022, 2024, 2026].map((c) => (
          <button
            key={c}
            onClick={() => setCycle(c)}
            className={`px-3 py-1 text-sm rounded border ${
              cycle === c
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border hover:bg-muted"
            }`}
          >
            {c}
          </button>
        ))}
        {data?.coverage.cycles_available && (
          <span className="text-xs text-muted-foreground ml-auto">
            Available cycles: {data.coverage.cycles_available.slice(0, 5).join(", ")}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <ArchivePanel title="Loading campaign finance data..." kicker="Fetching">
          <div className="p-6">
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          </div>
        </ArchivePanel>
      )}

      {/* Error state */}
      {error && !loading && (
        <ArchivePanel title="Data unavailable" kicker="Error">
          <p className="p-6 text-sm text-muted-foreground">
            Could not load campaign finance data: {error}. Ensure the FEC pipeline has been run.
          </p>
        </ArchivePanel>
      )}

      {/* Empty state */}
      {data && !hasAnyFinanceCoverage && !loading && (
        <ArchivePanel title="No data for this cycle" kicker="Empty">
          <p className="p-6 text-sm text-muted-foreground">
            No canonical campaign-finance channel is loaded with rows for cycle {cycle}. Check the
            per-source coverage state or select a different cycle before treating this as zero activity.
          </p>
        </ArchivePanel>
      )}

      {/* Chart */}
      {data && hasAnyFinanceCoverage && !loading && (
        <>
          {/* Summary stats */}
          <div className="grid gap-px border-b border-border bg-border px-px py-px sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <div className="bg-background p-5 text-xs text-muted-foreground">Direct receipts</div>
              <div className="bg-background px-5 pb-5 text-lg font-semibold">{formatCurrency(data.total_receipts)}</div>
            </div>
            <div>
              <div className="bg-background p-5 text-xs text-muted-foreground">Operating disbursements</div>
              <div className="bg-background px-5 pb-5 text-lg font-semibold">{formatCurrency(data.total_disbursements)}</div>
            </div>
            <div>
              <div className="bg-background p-5 text-xs text-muted-foreground">Outside spending supporting</div>
              <div className="bg-background px-5 pb-5 text-lg font-semibold">{formatCurrency(data.independent_expenditures_supporting)}</div>
            </div>
            <div>
              <div className="bg-background p-5 text-xs text-muted-foreground">Outside spending opposing</div>
              <div className="bg-background px-5 pb-5 text-lg font-semibold">{formatCurrency(data.independent_expenditures_opposing)}</div>
            </div>
            <div>
              <div className="bg-background p-5 text-xs text-muted-foreground">Direct-reporting committees</div>
              <div className="bg-background px-5 pb-5 text-lg font-semibold">{data.committee_count.toLocaleString()}</div>
            </div>
          </div>

          <div className="border-b border-border px-6 py-3 text-xs text-muted-foreground">
            Direct receipts and operating disbursements are committee-controlled activity. Supporting and opposing independent expenditures are outside spending and are never added to direct receipts.
          </div>

          {/* Bar chart */}
          {data.by_sector.length > 0 ? <ArchivePanel title="Receipts by Committee Type" kicker="Sector breakdown">
            <div className="p-6 space-y-3">
              {data.by_sector.map((sector) => (
                <div key={sector.sector} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate max-w-[70%]">{sector.sector}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatCurrency(sector.total_receipts)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{
                        width: `${(sector.total_receipts / maxReceipts) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sector.committee_count} committee{sector.committee_count !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>
          </ArchivePanel> : <ArchivePanel title="No direct receipt sectors" kicker="Sector breakdown">
            <p className="p-6 text-sm text-muted-foreground">
              This cycle has another canonical campaign-finance channel but no Schedule A receipt sector rows.
            </p>
          </ArchivePanel>}

          {/* Provenance */}
          <ArchivePanel title="Source provenance" kicker="Data quality">
            <div className="p-6 space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Source: </span>
                <span>{data.coverage.source}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Freshness: </span>
                <span className={data.coverage.data_freshness === "no_data" ? "text-destructive" : ""}>
                  {data.coverage.data_freshness}
                </span>
              </div>
              <div className="grid gap-2 pt-2 sm:grid-cols-3">
                <div>Schedule A: <strong>{data.coverage.direct_receipts}</strong></div>
                <div>Schedule B: <strong>{data.coverage.operating_disbursements}</strong></div>
                <div>Schedule E: <strong>{data.coverage.independent_expenditures}</strong></div>
              </div>
              <div className="text-xs text-muted-foreground">
                The chart displays the top {data.coverage.sector_limit} committee types. Headline totals include all canonical rows in the cycle.
              </div>
              {data.provenance.sources.map((s, i) => (
                <div key={i}>
                  <span className="text-muted-foreground">{s.source}: </span>
                  <span>{s.status}</span>
                  {s.confidence && <span className="text-muted-foreground"> ({s.confidence})</span>}
                </div>
              ))}
            </div>
          </ArchivePanel>
        </>
      )}
    </ArchivePage>
  );
}
