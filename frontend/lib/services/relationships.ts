import type { ProvenanceSummary } from "./provenance";
import { BACKEND_URL } from "@/lib/constants";

export type RelationshipEvidence = {
  relationship_id: number;
  subject_key: string;
  object_key: string;
  relation_type: string;
  evidence_tier: "direct" | "derived" | "contextual";
  confidence: string;
  source: string;
  source_record_id?: string | null;
  source_url?: string | null;
  observed_at?: string | null;
  amount_min?: number | null;
  amount_max?: number | null;
  details?: Record<string, unknown>;
};
export type RelationshipsResponse = {
  relationships: RelationshipEvidence[];
  provenance?: Record<string, unknown>;
};

export async function getRelationships(filters: {
  subjectKey?: string;
  objectKey?: string;
  relationType?: string;
  limit?: number;
} = {}, signal?: AbortSignal): Promise<RelationshipsResponse> {
  const params = new URLSearchParams();
  if (filters.subjectKey) params.set("subject_key", filters.subjectKey);
  if (filters.objectKey) params.set("object_key", filters.objectKey);
  if (filters.relationType) params.set("relation_type", filters.relationType);
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  const response = await fetch(`${BACKEND_URL}/api/relationships${query ? `?${query}` : ""}`, { signal });
  if (!response.ok) throw new Error(`Relationships request failed (${response.status})`);
  return response.json();
}

export type OrganizationIdentifier = {
  scheme: string;
  value: string;
  source: string;
};

export type OrganizationProfile = {
  organization_id: number;
  canonical_name: string;
  organization_type: string;
  description?: string | null;
  website_url?: string | null;
  identifiers: OrganizationIdentifier[];
  relationships: RelationshipEvidence[];
  provenance?: ProvenanceSummary;
};

export async function getOrganization(organizationId: string): Promise<OrganizationProfile | null> {
  const response = await fetch(`${BACKEND_URL}/api/organizations/${encodeURIComponent(organizationId)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Organization request failed (${response.status})`);
  return response.json();
}

export type MemberDisclosures = {
  bioguide_id: string;
  documents: Array<{
    document_id: number;
    chamber: string;
    report_type: string;
    filing_date?: string;
    source: string;
    source_url: string;
    parse_status: string;
    parse_error?: string;
  }>;
  holdings: Array<{
    document_id: number;
    owner_type: string;
    asset_name: string;
    ticker?: string;
    value_min?: number;
    value_max?: number;
    income_min?: number;
    income_max?: number;
  }>;
  transactions: Array<{
    document_id: number;
    owner_type: string;
    asset_name: string;
    ticker?: string;
    transaction_type: string;
    amount_min?: number;
    amount_max?: number;
    transaction_date?: string;
    filing_url?: string;
  }>;
  provenance?: ProvenanceSummary;
};

export async function getMemberDisclosures(bioguideId: string, signal?: AbortSignal): Promise<MemberDisclosures> {
  const response = await fetch(`${BACKEND_URL}/api/members/${encodeURIComponent(bioguideId)}/disclosures`, { signal });
  if (!response.ok) throw new Error(`Disclosures request failed (${response.status})`);
  return response.json();
}
