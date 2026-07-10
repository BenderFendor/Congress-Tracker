import { BACKEND_URL } from "@/lib/constants";

export interface PortfolioSummary {
    total_members: number;
    total_committees: number;
    in_office_count: number;
    house_count: number;
    senate_count: number;
    democratic_count: number;
    republican_count: number;
    independent_count: number;
    avg_years_in_office: number;
    avg_ideology_score: number;
}

export interface SectorWeight {
    sector: string;
    weight: number;
    committee_count: number;
}

export interface MemberRank {
    rank: number;
    bioguide_id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    name: string;
    party: string;
    state: string;
    chamber: string;
    years_in_office: number;
    committee_count: number;
    ideology_score: number | null;
    depiction_url: string | null;
}

export interface TopMembersResponse {
    members: MemberRank[];
    total: number;
}

export interface SectorExposureResponse {
    basis: string;
    sectors: SectorWeight[];
}

export interface MarketPulseResponse {
    status: string;
    message: string;
    total_members_tracked: number;
    total_committees: number;
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
    const res = await fetch(`${BACKEND_URL}/api/intel/portfolio/summary`);
    if (!res.ok) throw new Error("Failed to fetch portfolio summary");
    return res.json();
}

export async function fetchTopMembers(): Promise<TopMembersResponse> {
    const res = await fetch(`${BACKEND_URL}/api/intel/portfolio/members`);
    if (!res.ok) throw new Error("Failed to fetch top members");
    const data = await res.json();
    return {
        ...data,
        members: data.members.map((member: Omit<MemberRank, "name">) => ({
            ...member,
            name: member.full_name,
        })),
    };
}

export async function fetchSectorExposure(): Promise<SectorExposureResponse> {
    const res = await fetch(`${BACKEND_URL}/api/intel/portfolio/sectors`);
    if (!res.ok) throw new Error("Failed to fetch sector exposure");
    return res.json();
}

export async function fetchMarketPulse(): Promise<MarketPulseResponse> {
    const res = await fetch(`${BACKEND_URL}/api/intel/portfolio/pulse`);
    if (!res.ok) throw new Error("Failed to fetch market pulse");
    return res.json();
}
