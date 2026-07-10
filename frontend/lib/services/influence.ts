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
  const res = await fetch(`${BACKEND_URL}/api/influence/networks`);
  if (!res.ok) throw new Error(`Influence network request failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.networks ?? [];
}

export async function getInfluenceNetwork(slug: string): Promise<InfluenceNetwork | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BACKEND_URL}/api/influence/networks/${slug}`, { signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Influence network detail request failed (${res.status})`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getInfluenceNetworkFinancials(slug: string, cycle = 2026): Promise<InfluenceNetworkFinancials | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BACKEND_URL}/api/influence/networks/${encodeURIComponent(slug)}/financials?cycle=${cycle}`, { signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Influence financial request failed (${res.status})`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}
