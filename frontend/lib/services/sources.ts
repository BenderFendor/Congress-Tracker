import { BACKEND_URL } from "@/lib/constants";

export type SourceFreshness = {
  source: string;
  display_name?: string;
  source_type?: string;
  default_ttl_seconds?: number;
  status?: string;
  fetched_at?: string;
  rows_seen?: number;
  rows_written?: number;
  error_message?: string;
  freshness: "fresh" | "stale" | "missing" | "failed";
};

export type SourceCoverage = {
  sources: SourceFreshness[];
  summary: { total: number; successful: number; stale_or_missing: number; failed: number };
};

export async function getSourceCoverage(): Promise<SourceCoverage> {
  const response = await fetch(`${BACKEND_URL}/api/sources/coverage`);
  if (!response.ok) throw new Error(`Source coverage request failed (${response.status})`);
  return response.json();
}
