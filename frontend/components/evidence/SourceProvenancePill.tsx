"use client";

import type { SourceTier } from "@/lib/services/stocks";
import { getSourceTier } from "@/lib/services/stocks";

type SourceProvenancePillProps = {
  source: string;
  /** Pre-computed source tier; auto-derived from source if omitted */
  sourceTier?: SourceTier;
};

function formatSourceName(source: string): string {
  return source
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getPrimaryLabel(source: string): string {
  switch (source) {
    case "house_disclosures":
    case "house_clerk":
      return "House PTR";
    case "house_clerk_index":
      return "House Clerk index";
    case "congress_gov":
      return "Congress.gov";
    case "openfec":
      return "OpenFEC";
    case "lda":
      return "LDA.gov";
    case "senate_efd":
    case "senate_disclosures":
      return "Senate eFD";
    default:
      return "Official";
  }
}

function getLabel(source: string, tier: string): string {
  if (tier === "primary") {
    return getPrimaryLabel(source);
  }
  return formatSourceName(source);
}

function getStyles(tier: string): string {
  switch (tier) {
    case "primary":
      return "border-emerald-500/40 text-emerald-400";
    case "secondary":
      return "border-border text-muted-foreground";
    default:
      return "border-border/40 text-muted-foreground/60";
  }
}

export function SourceProvenancePill({ source, sourceTier }: SourceProvenancePillProps) {
  const tier = sourceTier ?? getSourceTier(source);
  const label = getLabel(source, tier);
  const styles = getStyles(tier);

  return (
    <span
      className={`inline-block text-[10px] px-1.5 py-0.5 rounded border leading-normal ${styles}`}
    >
      {label}
    </span>
  );
}
