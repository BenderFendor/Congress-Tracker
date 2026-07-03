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
    const res = await fetch(`${BACKEND_URL}/api/influence/networks/${slug}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
