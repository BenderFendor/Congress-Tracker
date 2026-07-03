import { BACKEND_URL } from "@/lib/constants";
import type { ProvenanceSummary } from "./provenance";

export type ChamberDashboard = {
  chamber: string;
  congress: number;
  member_count: number;
  party_breakdown: Record<string, number>;
  recent_bills_count: number;
  recent_votes_count: number;
  avg_missed_vote_pct?: number;
  avg_party_line_pct?: number;
  total_lobbying_spend?: number;
  total_independent_expenditures?: number;
  provenance?: ProvenanceSummary;
};

export async function getChamberDashboard(chamber: string, congress?: number): Promise<ChamberDashboard | null> {
  const params = new URLSearchParams();
  if (congress) params.set("congress", String(congress));

  try {
    const url = `${BACKEND_URL}/api/chambers/${chamber}/dashboard${params.toString() ? `?${params.toString()}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
