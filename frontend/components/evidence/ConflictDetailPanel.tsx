"use client";

import type { CommitteeConflict } from "@/lib/services/stocks";

type ConflictDetailPanelProps = {
  conflicts: CommitteeConflict[];
  committeeNames: string[];
};

const severityStyles: Record<CommitteeConflict["severity"], { text: string; border: string }> = {
  CLEAN: { text: "text-gray-400", border: "border-gray-500/40" },
  ADJACENT: { text: "text-amber-400", border: "border-amber-500/40" },
  "DIRECT OVERLAP": { text: "text-red-400", border: "border-red-500/40" },
};

function SeverityBadge({ severity }: { severity: CommitteeConflict["severity"] }) {
  const style = severityStyles[severity];
  return (
    <span
      className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${style.text} ${style.border}`}
    >
      {severity === "DIRECT OVERLAP" ? "Direct overlap" : severity === "ADJACENT" ? "Adjacent" : "Clean"}
    </span>
  );
}

export function ConflictDetailPanel({ conflicts, committeeNames }: ConflictDetailPanelProps) {
  if (conflicts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No committee jurisdiction overlap detected based on sector mapping.
      </p>
    );
  }

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      {committeeNames.length > 0 && (
        <div className="text-xs text-muted-foreground mb-1">
          Committees: {committeeNames.join(", ")}
        </div>
      )}
      {conflicts.map((conflict, index) => (
        <div
          key={`${conflict.committee}-${conflict.ticker}-${index}`}
          className="border border-border rounded-md p-2 space-y-1"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">{conflict.committee}</span>
            <span className="text-xs text-muted-foreground">{conflict.sector}</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {conflict.ticker}
            </span>
            <SeverityBadge severity={conflict.severity} />
          </div>
          <p className="text-xs text-muted-foreground">{conflict.description}</p>
        </div>
      ))}
    </div>
  );
}
