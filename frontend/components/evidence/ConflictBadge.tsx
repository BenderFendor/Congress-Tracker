"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { CommitteeConflict } from "@/lib/services/stocks";
import { cn } from "@/lib/utils";

type ConflictBadgeProps = {
  severity: string;
  conflictCount: number;
  conflicts: CommitteeConflict[];
  committeeNames: string[];
};

function SeverityPill({ severity }: { severity: string }) {
  if (severity === "CLEAN" || severity === "") return null;
  const colorClass =
    severity === "DIRECT OVERLAP"
      ? "text-red-400 border-red-500/40 bg-red-950/30"
      : severity === "ADJACENT"
        ? "text-amber-400 border-amber-500/40 bg-amber-950/30"
        : "text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
        colorClass,
      )}
    >
      {severity.replace(/_/g, " ")}
    </span>
  );
}

export function ConflictBadge({
  severity,
  conflictCount,
  conflicts,
  committeeNames,
}: ConflictBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  // Nothing to show for clean / empty severity
  if (severity === "" || severity === "CLEAN") {
    return null;
  }

  const isDirect = severity === "DIRECT OVERLAP";

  const badgeClass = isDirect
    ? "text-red-400 border-red-500/40 bg-red-950/30 hover:bg-red-950/50"
    : "text-amber-400 border-amber-500/40 bg-amber-950/30 hover:bg-amber-950/50";

  const Icon = isDirect ? AlertTriangle : AlertTriangle;

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none transition-colors cursor-pointer",
          badgeClass,
        )}
      >
        <Icon className="size-3" />
        <span>
          {isDirect ? "Direct committee overlap" : "Adjacent committee overlap"} ({conflictCount})
        </span>
        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {expanded && (
        <div className="ml-1 flex flex-col gap-2 border-l-2 border-border pl-3 pt-1">
          {conflicts.length === 0 && committeeNames.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">
              No committee jurisdiction overlap detected based on sector mapping.
            </p>
          )}

          {conflicts.length === 0 && committeeNames.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[11px] text-muted-foreground">
                Committees: {committeeNames.join(", ")}
              </p>
              <p className="text-[11px] text-muted-foreground italic">
                No committee jurisdiction overlap detected based on sector mapping.
              </p>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="flex flex-col gap-2">
              {committeeNames.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Committees: {committeeNames.join(", ")}
                </p>
              )}
              {conflicts.map((c, i) => (
                <div
                  key={`${c.committee}-${c.ticker}-${i}`}
                  className="flex flex-col gap-0.5"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-medium text-foreground">
                      {c.committee}
                    </span>
                    <SeverityPill severity={c.severity} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {c.ticker} &middot; {c.sector}
                    {c.industry ? ` / ${c.industry}` : ""}
                  </p>
                  {c.description && (
                    <p className="text-[10px] text-muted-foreground/80">
                      {c.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
