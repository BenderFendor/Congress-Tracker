import type { StockTrade } from "@/lib/services/stocks";
import { ConflictBadge } from "./ConflictBadge";
import { LateFilingFlag } from "./LateFilingFlag";
import { SourceProvenancePill } from "./SourceProvenancePill";

type EvidenceRowProps = {
  trade: StockTrade;
};

export function EvidenceRow({ trade }: EvidenceRowProps) {
  if (
    (trade.highest_conflict_severity === "" ||
      trade.highest_conflict_severity === "CLEAN") &&
    trade.late_filing === false &&
    trade.disclosure_lag_days === null
  ) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <ConflictBadge
        severity={trade.highest_conflict_severity}
        conflictCount={trade.conflict_flag_count}
        conflicts={trade.committee_conflicts}
        committeeNames={trade.committee_names}
      />
      <LateFilingFlag
        lateFiling={trade.late_filing}
        disclosureLagDays={trade.disclosure_lag_days}
      />
      <SourceProvenancePill source={trade.source} />
    </div>
  );
}
