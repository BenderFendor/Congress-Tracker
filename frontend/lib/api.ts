export interface Politician {
    _politicianId: string;
    _stateId?: string;
    party?: "democrat" | "republican" | "other" | "independent";
    first_name?: string;
    last_name?: string;
    full_name: string;
    chamber?: "house" | "senate";
    stats: {
        volume?: number;
        count_trades?: number;
        count_issuers?: number;
    };
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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4020';

export async function fetchPoliticians(): Promise<PaginatedResponse<Politician>> {
    const response = await fetch(`${BACKEND_URL}/api/politicians`);
    if (!response.ok) {
        throw new Error("Failed to fetch politicians");
    }
    return response.json();
}
