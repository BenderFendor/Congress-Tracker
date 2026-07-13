import { BACKEND_URL } from "@/lib/constants";

export type FinancialSnapshot = {
  bioguide_id: string;
  member_name: string;
  chamber: string;
  state: string;
  reporting_year: number;
  asset_min: number;
  asset_max: number | null;
  liability_min: number;
  liability_max: number | null;
  net_worth_min: number | null;
  net_worth_max: number | null;
  upper_bound_unavailable: boolean;
  lower_bound_unavailable: boolean;
  personal_residence_unavailable: boolean;
  calculation_version: string;
  methodology_warnings: string[];
  calculated_at: string;
};

export type FinancialSnapshotResponse = {
  snapshots: FinancialSnapshot[];
  coverage: "empty" | "loaded" | string;
  provenance: {
    sources?: Array<{ source: string; status: string; confidence?: string | null }>;
    warnings?: string[];
  };
};

export async function getFinancialSnapshots(year?: number): Promise<FinancialSnapshotResponse> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  const query = params.toString();
  const response = await fetch(`${BACKEND_URL}/api/financial-snapshots${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Financial snapshots request failed (${response.status})`);
  return response.json();
}
