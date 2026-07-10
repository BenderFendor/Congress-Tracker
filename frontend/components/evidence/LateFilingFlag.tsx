"use client";

import { Clock } from "lucide-react";

type LateFilingFlagProps = {
  lateFiling: boolean;
  disclosureLagDays: number | null;
};

export function LateFilingFlag({ lateFiling, disclosureLagDays }: LateFilingFlagProps) {
  if (lateFiling) {
    const label =
      disclosureLagDays != null
        ? `Filed ${disclosureLagDays} days after transaction`
        : ">45 days";
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border text-red-400 border-red-500/40">
        <Clock className="h-3 w-3" />
        {label}
      </span>
    );
  }

  if (disclosureLagDays != null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border text-muted-foreground border-border">
        <Clock className="h-3 w-3" />
        Filed in {disclosureLagDays} days
      </span>
    );
  }

  return null;
}
