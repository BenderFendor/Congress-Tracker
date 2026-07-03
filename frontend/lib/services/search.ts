import { BACKEND_URL } from "@/lib/constants";
import type { ProvenanceSummary } from "./provenance";

export type SearchResult = {
  type: "member" | "bill" | "committee" | "pac" | "lobbying_client" | "lobbying_registrant";
  id: string;
  label: string;
  subtitle?: string;
  url?: string;
  provenance?: ProvenanceSummary;
};

export type SearchResponse = {
  results: SearchResult[];
  total: number;
  query: string;
};

export async function crossEntitySearch(query: string, type?: string): Promise<SearchResponse> {
  const params = new URLSearchParams();
  params.set("q", query);
  if (type && type !== "all") {
    params.set("type", type);
  }

  const res = await fetch(`${BACKEND_URL}/api/search?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
