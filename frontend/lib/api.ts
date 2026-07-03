export interface Candidate {
    candidate_id: string;
    name: string;
    party?: string;
    state?: string;
    district?: string;
    office?: string;
    incumbent_challenge?: string;
    active_through?: number;
    first_file_date?: string;
    last_file_date?: string;
}

export interface Receipt {
    committee_id: string;
    committee_name: string;
    contributor_name: string;
    contribution_date: string;
    amount: number;
    employer?: string;
    occupation?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        paging: {
            page: number;
            size: number;
            totalItems: number;
            totalPages: number;
        };
    };
}

import { BACKEND_URL } from "./constants";

export async function fetchCandidates(name?: string, state?: string): Promise<Candidate[]> {
    let url = `${BACKEND_URL}/api/intel/fec/candidates`;
    const params = new URLSearchParams();
    if (name) params.append('name', name);
    if (state) params.append('state', state);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch candidates");
    }
    return response.json();
}

export async function fetchReceipts(committeeId?: string): Promise<PaginatedResponse<Receipt>> {
    let url = `${BACKEND_URL}/api/fec/receipts`;
    if (committeeId) {
        url += `?committee_id=${encodeURIComponent(committeeId)}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch receipts");
    }
    return response.json();
}
