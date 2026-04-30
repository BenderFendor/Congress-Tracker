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

export interface CongressMember {
    id: string;
    name: string;
    first_name: string;
    last_name: string;
    party: string;
    state: string;
    district: string;
    chamber: string;
    bio: string;
    url: string;
    in_office: boolean;
    next_election: string;
}

export interface Candidate {
    candidate_id: string;
    name: string;
    party?: string;
    state?: string;
    district?: string;
    office_sought?: string;
    incumbent?: boolean;
    committee_id?: string;
    committee_name?: string;
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

export interface BackendTrade {
    _txId: number;
    _politicianId: string;
    _assetId: number | null;
    _issuerId: number;
    pubDate: string;
    filingDate: string | null;
    txDate: string;
    txType: string;
    hasCapitalGains: boolean;
    owner: string;
    chamber: string;
    price: number | null;
    size: number | null;
    sizeRangeHigh: number | null;
    sizeRangeLow: number | null;
    value: number;
    filingId: number | null;
    filingURL: string | null;
    reportingGap: number;
    committees: string[];
    asset: {
        assetType: string;
        assetTicker: string | null;
        instrument: string | null;
    } | null;
    issuer: {
        issuerName: string;
        issuerTicker: string | null;
        sector: string | null;
    };
    politician: {
        _stateId: string;
        chamber: string;
        firstName: string;
        lastName: string;
        party: string;
        gender: string | null;
        dob: string | null;
        nickname: string | null;
    };
}

export interface Trade {
    disclosure_year: number;
    disclosure_date: string;
    transaction_date: string;
    owner: string;
    ticker: string;
    asset_description: string;
    type: string;
    amount: string;
    representative: string;
    district: string;
    ptr_link: string;
    cap_gains_over_200_usd: boolean;
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

// CapitolTrades Endpoints
export async function fetchPoliticians(): Promise<PaginatedResponse<Politician>> {
    const response = await fetch(`${BACKEND_URL}/api/politicians`);
    if (!response.ok) {
        throw new Error("Failed to fetch politicians");
    }
    return response.json();
}

export async function fetchTrades(politicianId?: string): Promise<PaginatedResponse<Trade>> {
    const url = politicianId 
        ? `${BACKEND_URL}/api/trades?size=1000&politician=${encodeURIComponent(politicianId)}`
        : `${BACKEND_URL}/api/trades?size=1000`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch trades");
    }
    const raw = await response.json() as { data: BackendTrade[]; meta?: { paging?: { totalItems?: number; page?: number; size?: number; totalPages?: number } } };
    return {
        data: (raw.data || []).map(mapBackendTrade),
        meta: {
            paging: {
                page: raw.meta?.paging?.page ?? 1,
                size: raw.meta?.paging?.size ?? raw.data?.length ?? 0,
                totalItems: raw.meta?.paging?.totalItems ?? raw.data?.length ?? 0,
                totalPages: raw.meta?.paging?.totalPages ?? 1,
            },
        },
    };
}

function mapBackendTrade(bt: BackendTrade): Trade {
    const repName = bt.politician 
        ? `${bt.politician.firstName} ${bt.politician.lastName}`.trim()
        : "Unknown";
    const ticker = bt.asset?.assetTicker || bt.issuer?.issuerTicker || "N/A";
    const assetDesc = bt.asset?.assetType || bt.issuer?.issuerName || "Unknown";
    return {
        disclosure_year: new Date(bt.pubDate).getFullYear(),
        disclosure_date: bt.pubDate,
        transaction_date: bt.txDate,
        owner: bt.owner,
        ticker,
        asset_description: assetDesc,
        type: bt.txType,
        amount: bt.value ? `$${bt.value.toLocaleString()}` : "Undisclosed",
        representative: repName,
        district: bt.chamber,
        ptr_link: bt.filingURL || "",
        cap_gains_over_200_usd: bt.hasCapitalGains,
    };
}

// Congress.gov Endpoints
export async function fetchCongressMembers(state?: string, district?: string): Promise<PaginatedResponse<CongressMember>> {
    let url = `${BACKEND_URL}/api/congress/members`;
    const params = new URLSearchParams();
    if (state) params.append('state', state);
    if (district) params.append('district', district);
    if (params.toString()) url += `?${params.toString()}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch Congress members");
    }
    return response.json();
}

export async function fetchBills(member?: string, congress?: number): Promise<PaginatedResponse<any>> {
    let url = `${BACKEND_URL}/api/congress/bills`;
    const params = new URLSearchParams();
    if (member) params.append('member', member);
    if (congress) params.append('congress', congress.toString());
    if (params.toString()) url += `?${params.toString()}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch bills");
    }
    return response.json();
}

// OpenFEC Endpoints
export async function fetchCandidates(name?: string, state?: string): Promise<PaginatedResponse<Candidate>> {
    let url = `${BACKEND_URL}/api/fec/candidates`;
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
