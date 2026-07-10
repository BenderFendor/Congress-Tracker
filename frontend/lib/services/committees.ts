import { BACKEND_URL } from "@/lib/constants";
import type { ProvenanceSummary } from "./provenance";

export type Committee = {
  committee_id: string;
  chamber: string;
  name: string;
  thomas_id?: string;
  senate_committee_id?: string;
  house_committee_id?: string;
  jurisdiction?: string;
  parent_committee_id?: string;
  url?: string;
  members?: Array<{
    bioguide_id: string;
    first_name: string;
    last_name: string;
    party: string;
    state: string;
    district?: string;
    rank?: number;
    title?: string;
  }>;
  bills?: Array<{
    bill_id?: string;
    title?: string;
    congress?: number;
    bill_type?: string;
    bill_number?: number;
    latest_action_date?: string;
    status?: string;
  }>;
  provenance?: ProvenanceSummary;
};

export async function getCommittees(chamber?: string): Promise<Committee[]> {
  try {
    const url = chamber ? `${BACKEND_URL}/api/committees?chamber=${encodeURIComponent(chamber)}` : `${BACKEND_URL}/api/committees`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getCommittee(id: string): Promise<Committee | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/committees/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ...data,
      members: Array.isArray(data.roster)
        ? data.roster.map((member: Record<string, unknown>) => ({
            bioguide_id: String(member.bioguide_id ?? ""),
            first_name: String(member.first_name ?? ""),
            last_name: String(member.last_name ?? ""),
            party: String(member.party ?? ""),
            state: String(member.state ?? ""),
            district: member.district ? String(member.district) : undefined,
            rank: typeof member.rank === "number" ? member.rank : undefined,
            title: member.title ? String(member.title) : undefined,
          }))
        : [],
      bills: Array.isArray(data.bills) ? data.bills : [],
    };
  } catch {
    return null;
  }
}
