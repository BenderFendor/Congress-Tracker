import { BACKEND_URL } from "@/lib/constants";
import type { ProvenanceSummary } from "./provenance";

export type MemberFunding = {
  bioguide_id: string;
  cycle: number;
  direct_receipts: number;
  pac_receipts: number;
  individual_receipts: number;
  independent_expenditures_supporting: number;
  independent_expenditures_opposing: number;
  top_donors: Array<{
    contributor_name: string;
    amount: number;
    count: number;
  }>;
  top_committees: Array<{
    committee_id: string;
    committee_name: string;
    amount: number;
  }>;
  influence_networks: Array<{
    network_slug: string;
    display_name: string;
    direct_pac: number;
    independent_supporting: number;
    independent_opposing: number;
    confidence: string;
  }>;
  has_successful_fec_run?: boolean;
  provenance?: ProvenanceSummary;
};

export async function getMemberFunding(bioguideId: string, cycle?: number): Promise<MemberFunding | null> {
  const url = `${BACKEND_URL}/api/members/${encodeURIComponent(bioguideId)}/funding${cycle ? `?cycle=${cycle}` : ""}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Funding request failed (${res.status})`);
  return res.json();
}
