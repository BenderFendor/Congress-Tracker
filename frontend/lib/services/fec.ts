import { BACKEND_URL } from "@/lib/constants";
import { buildFecReceiptQuery } from "@/lib/fec-receipts.mjs";

export interface FECandidate {
    candidate_id: string;
    name: string;
    party?: string;
    state?: string;
    district?: string;
    office_sought?: string;
    incumbent?: boolean;
    status?: "incumbent" | "challenger" | "open" | "primary" | "unknown";
    committee_id?: string;
    committee_name?: string;
}

export interface FECReceipt {
    source_record_id: string;
    committee_id: string;
    committee_name: string;
    contributor_name: string;
    contributor_committee_id?: string | null;
    contributor_type: string;
    contribution_date?: string | null;
    amount: number;
    employer?: string | null;
    occupation?: string | null;
    transaction_type?: string | null;
    record_kind: string;
    memo_text?: string | null;
    include_in_totals: boolean;
    source_url?: string | null;
}

export type FECReceiptQuery = {
    committeeId?: string;
    cycle?: number;
    search?: string;
    recordKind?: string;
    minAmount?: number;
    maxAmount?: number;
    page?: number;
    perPage?: number;
};

export type FECReceiptResponse = {
    data: FECReceipt[];
    meta: {
        paging: {
            page: number;
            size: number;
            total_items: number;
            total_pages: number;
            total_is_exact: boolean;
            has_more: boolean;
        };
        cycle: number;
        coverage_status: "loaded" | "partial" | "not_ingested";
        unresolved_linkage_issues: number;
        source_updated_at?: string | null;
    };
    provenance: {
        source: string;
        source_url: string;
        scope: string;
        warnings: string[];
    };
}

export type FECDisbursement = {
    source_record_id: string;
    committee_id: string;
    committee_name: string;
    recipient_name: string;
    transaction_date?: string | null;
    amount: number;
    purpose?: string | null;
    category_code?: string | null;
    category_description?: string | null;
    memo_code?: string | null;
    memo_text?: string | null;
    entity_type?: string | null;
    source_url: string;
};

export type FECDisbursementResponse = Omit<FECReceiptResponse, "data"> & {
    data: FECDisbursement[];
};

export async function getAllCandidates(name?: string, state?: string, cycle?: number): Promise<FECandidate[]> {
    const params = new URLSearchParams();
    if (name) params.set("name", name);
    if (state) params.set("state", state);
    if (cycle) params.set("cycle", String(cycle));
    const response = await fetch(`${BACKEND_URL}/api/elections/candidates?${params}`);
    if (!response.ok) throw new Error(`Failed to fetch candidates: ${response.status} ${response.statusText}`);
    const candidates = await response.json();
    return candidates.map((c: Record<string, unknown>) => {
        const challenge = String(c.incumbent_challenge ?? "").toUpperCase();
        const status = challenge === "I" || challenge === "INCUMBENT"
            ? "incumbent"
            : challenge === "C" || challenge === "CHALLENGER"
                ? "challenger"
                : challenge === "O" || challenge === "OPEN"
                    ? "open"
                    : challenge === "P" || challenge === "PRIMARY"
                        ? "primary"
                        : "unknown";
        return {
        candidate_id: String(c.candidate_id),
        name: formatFecName(String(c.name)),
        party: c.party ? String(c.party) : undefined,
        state: c.state ? String(c.state) : undefined,
        district: c.district ? String(c.district) : undefined,
        office_sought: c.office ? String(c.office) : undefined,
        incumbent: status === "incumbent",
        status,
        };
    });
}

function formatFecName(value: string): string {
    const [left, ...right] = value.split(",").map((part) => part.trim()).filter(Boolean);
    const source = right.length > 0 && /\d/.test(left) ? right.join(" ") : right.length > 0 ? `${right.join(" ")} ${left}` : value;
    return source
        .toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase())
        .replace(/\bJr\b/g, "Jr.")
        .replace(/\bSr\b/g, "Sr.")
        .trim();
}

export async function getFecReceipts(query: FECReceiptQuery): Promise<FECReceiptResponse> {
    const params = buildFecReceiptQuery(query);
    const response = await fetch(`${BACKEND_URL}/api/fec/receipts?${params}`, {
        cache: "no-store",
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Failed to fetch FEC receipts: ${response.status} ${detail}`);
    }
    return response.json();
}

export async function getFecDisbursements(query: FECReceiptQuery): Promise<FECDisbursementResponse> {
    const params = buildFecReceiptQuery({ ...query, recordKind: undefined });
    const response = await fetch(`${BACKEND_URL}/api/fec/disbursements?${params}`, {
        cache: "no-store",
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Failed to fetch FEC disbursements: ${response.status} ${detail}`);
    }
    return response.json();
}

export async function getRecentCandidates(limit = 50, name?: string, state?: string, cycle?: number): Promise<FECandidate[]> {
    const allCandidates = await getAllCandidates(name, state, cycle);
    return allCandidates.slice(0, limit);
}

export async function getCandidatesByState(state: string, cycle?: number): Promise<FECandidate[]> {
    return getAllCandidates(undefined, state, cycle);
}

export async function getCandidatesByName(name: string): Promise<FECandidate[]> {
    return getAllCandidates(name);
}

export interface FECCommittee {
    committee_id: string;
    committee_name: string;
    committee_type?: string;
    party?: string;
    state?: string;
    designation?: string;
    organization_type?: string;
    candidate_id?: string;
}

export async function getCommittees(): Promise<FECCommittee[]> {
    const res = await fetch(`${BACKEND_URL}/api/intel/fec/committees`);
    if (!res.ok) throw new Error(`Failed to fetch FEC committees: ${res.status} ${res.statusText}`);
    return res.json();
}
