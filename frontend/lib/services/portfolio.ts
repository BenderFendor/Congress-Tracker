import { BACKEND_URL } from "@/lib/constants";

export interface PortfolioSummary {
    total_politicians: number;
    total_trades: number;
    buy_orders: number;
    sell_orders: number;
    net_activity: number;
    timely_disclosure_rate: number;
    total_volume: number;
}

export interface FeaturedMember {
    name: string;
    party: string;
    state: string;
    chamber: string;
    total_trades: number;
    volume: number;
    buy_count: number;
    sell_count: number;
    image_url: string | null;
}

export interface HoldingInfo {
    ticker: string;
    name: string;
    trades: number;
    percentage: number;
}

export interface SectorWeight {
    sector: string;
    weight: number;
    trade_count: number;
    volume: number;
}

export interface FeaturedPortfolio {
    member: FeaturedMember;
    trade_count: number;
    estimated_return_pct: number;
    top_holdings: HoldingInfo[];
    asset_allocation: SectorWeight[];
}

export interface MemberRank {
    rank: number;
    name: string;
    party: string;
    state: string;
    chamber: string;
    total_trades: number;
    volume: number;
    buy_count: number;
    sell_count: number;
    net_activity: number;
    estimated_return_pct: number;
    image_url: string | null;
}

export interface TopMembersResponse {
    members: MemberRank[];
    total: number;
}

export interface SectorExposureResponse {
    basis: string;
    sectors: SectorWeight[];
    sp500_comparison_pct: number;
}

export interface MarketPulseResponse {
    most_traded_ticker: string;
    most_traded_count: number;
    most_traded_company: string;
    trending_sector: string;
    trending_sector_weight: number;
    timely_disclosure_rate: number;
    total_trades_sampled: number;
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
    const res = await fetch(`${BACKEND_URL}/api/portfolio/summary`);
    if (!res.ok) throw new Error("Failed to fetch portfolio summary");
    return res.json();
}

export async function fetchFeaturedPortfolio(): Promise<FeaturedPortfolio> {
    const res = await fetch(`${BACKEND_URL}/api/portfolio/featured`);
    if (!res.ok) throw new Error("Failed to fetch featured portfolio");
    return res.json();
}

export async function fetchTopMembers(): Promise<TopMembersResponse> {
    const res = await fetch(`${BACKEND_URL}/api/portfolio/top-members`);
    if (!res.ok) throw new Error("Failed to fetch top members");
    return res.json();
}

export async function fetchSectorExposure(): Promise<SectorExposureResponse> {
    const res = await fetch(`${BACKEND_URL}/api/portfolio/sector-exposure`);
    if (!res.ok) throw new Error("Failed to fetch sector exposure");
    return res.json();
}

export async function fetchMarketPulse(): Promise<MarketPulseResponse> {
    const res = await fetch(`${BACKEND_URL}/api/portfolio/market-pulse`);
    if (!res.ok) throw new Error("Failed to fetch market pulse");
    return res.json();
}
