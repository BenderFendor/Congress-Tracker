import { ExternalLink } from "lucide-react";
import { getSourceTier } from "@/lib/services/stocks";
import { SourceProvenancePill } from "./SourceProvenancePill";

type OverlapCardProps = {
  subjectName: string;
  predicate: string;
  objectName: string;
  evidenceTier: string;
  source: string;
  sourceUrl?: string | null;
  observedAt?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function formatDollar(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function tierBadgeClass(tier: string): string {
  const t = tier.toLowerCase();
  if (t === "direct") return "bg-emerald-500/10 text-emerald-400";
  if (t === "derived") return "bg-amber-500/10 text-amber-400";
  return "bg-muted text-muted-foreground";
}

function tierLabel(tier: string): string {
  const t = tier.toLowerCase();
  if (t === "direct") return "Direct";
  if (t === "derived") return "Derived";
  return "Contextual";
}

export function OverlapCard({
  subjectName,
  predicate,
  objectName,
  evidenceTier,
  source,
  sourceUrl,
  observedAt,
  amountMin,
  amountMax,
}: OverlapCardProps) {
  return (
    <div className="border border-border rounded-lg p-4 flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-foreground">{subjectName}</span>
          <span className="text-sm text-muted-foreground">{predicate}</span>
          <span className="font-semibold text-foreground">{objectName}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tierBadgeClass(evidenceTier)}`}>
            {tierLabel(evidenceTier)}
          </span>
          {observedAt && (
            <span className="text-xs text-muted-foreground">{formatDate(observedAt)}</span>
          )}
          {amountMin != null && amountMax != null && (
            <span className="text-xs text-muted-foreground">
              {formatDollar(amountMin)} – {formatDollar(amountMax)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <SourceProvenancePill source={source} sourceTier={getSourceTier(source)} />
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="View source"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
