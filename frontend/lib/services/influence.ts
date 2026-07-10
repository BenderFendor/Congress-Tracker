import { BACKEND_URL } from "@/lib/constants";
import type { ProvenanceSummary } from "./provenance";

export type InfluenceNetwork = {
  network_slug: string;
  display_name: string;
  description: string;
  category: string;
  confidence: string;
  source_citation: string;
  committees: Array<{
    committee_id: string;
    committee_name: string;
    role: string;
    confidence: string;
    source_citation: string;
  }>;
  provenance?: ProvenanceSummary;
};

export type InfluenceNetworkSummary = {
  network_slug: string;
  display_name: string;
  description: string;
  category: string;
  confidence: string;
  source_citation?: string;
  committees?: Array<{
    committee_id: string;
    committee_name: string;
    role: string;
    confidence: string;
    source_citation: string;
  }>;
};

export type InfluenceNetworkFinancials = {
  network_slug: string;
  cycle: number;
  total_direct_contributions: number;
  total_independent_supporting: number;
  total_independent_opposing: number;
  total_all: number;
  committees: Array<{ committee_id: string; committee_name: string; total_received: number }>;
  top_recipients: Array<{ bioguide_id: string; member_name: string; amount: number }>;
};

export async function getInfluenceNetworks(): Promise<InfluenceNetworkSummary[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/influence/networks`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.networks ?? [];
  } catch {
    return [];
  }
}

export async function getInfluenceNetwork(slug: string): Promise<InfluenceNetwork | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BACKEND_URL}/api/influence/networks/${slug}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getInfluenceNetworkFinancials(slug: string, cycle = 2026): Promise<InfluenceNetworkFinancials | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BACKEND_URL}/api/influence/networks/${encodeURIComponent(slug)}/financials?cycle=${cycle}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
