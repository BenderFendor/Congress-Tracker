import { BACKEND_URL } from "@/lib/constants";
import type { ProvenanceSummary } from "./provenance";

export type MemberFunding = {
  bioguide_id: string;
  cycle: number;
  total_receipts: number;
  pac_contributions: number;
  individual_contributions: number;
  independent_expenditures_supporting: number;
  independent_expenditures_opposing: number;
  top_contributors: Array<{
    name: string;
    committee_id?: string;
    total: number;
    pac_contributions: number;
    individual_contributions: number;
  }>;
  top_committees: Array<{
    committee_id: string;
    name: string;
    total: number;
    transaction_count: number;
  }>;
  influence_networks: Array<{
    network_slug: string;
    display_name: string;
    total_amount: number;
    direct_pac_amount: number;
    independent_expenditure_support_amount: number;
    independent_expenditure_oppose_amount: number;
  }>;
  has_successful_fec_run?: boolean;
  data_quality: "complete" | "partial" | "missing_crosswalk";
  provenance?: ProvenanceSummary;
};

export async function getMemberFunding(bioguideId: string, cycle?: number): Promise<MemberFunding | null> {
  const url = `${BACKEND_URL}/api/members/${bioguideId}/funding${cycle ? `?cycle=${cycle}` : ""}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
