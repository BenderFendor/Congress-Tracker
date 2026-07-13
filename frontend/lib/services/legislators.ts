import { getTradesByPoliticianId, StockTrade } from "./stocks";
import { createLogger } from "@/lib/tracing";

import { BACKEND_URL } from "@/lib/constants";
import type { ProvenanceSummary } from "./provenance";
const log = createLogger("LegislatorsService");


export type LegislatorTradeSummary = {
    politician_id: string;
    matched: boolean;
    match_confidence: string;
    source: string;
    stats: {
        count_trades: number;
        count_issuers: number;
        volume: number;
        last_traded: string | null;
    };
};

export type Legislator = {
    id: string;
    bioguide_id: string;
    name: string;
    first_name: string;
    last_name: string;
    official_full_name?: string;
    party: string;
    current_party?: string;
    state: string;
    current_state?: string;
    district: string;
    current_district?: string;
    chamber: string;
    current_chamber?: string;
    avatar: string;
    bio: string;
    totalDonations?: number;
    billsSponsored: number;
    votingScore?: number;
    committees?: Array<string | { committee_id?: string; name?: string; chamber?: string; rank?: number; title?: string; congress?: number }>;
    topDonors?: Array<{ name: string; amount: number; industry?: string }>;
    recentBills?: Array<{ id?: string; title: string; status?: string; date: string }>;
    recentTrades: StockTrade[];
    url: string;
    twitter_account: string;
    facebook_account: string;
    youtube_account: string;
    contact_form?: string | null;
    in_office: boolean;
    next_election: string;
    trade_summary: LegislatorTradeSummary | null;
    // New intelligence fields from MemberProfile
    depiction_url?: string | null;
    website_url?: string | null;
    office_address?: string | null;
    phone?: string | null;
    years_in_office?: number | null;
    birthday?: string | null;
    age?: number | null;
    gender?: string | null;
    service_start?: string | null;
    current_term_end?: string | null;
    party_history?: Array<{ party: string; start?: string; end?: string }>;
    terms?: Array<{ chamber: string; state: string; district?: string; party: string; start_date: string; end_date?: string | null; senate_class?: number | null }>;
    identifiers?: Record<string, string[]>;
    education?: string[];
    prior_employment?: string[];
    hometown?: string | null;
    birthplace?: string | null;
    nominate_dim1?: number | null;
    nominate_dim2?: number | null;
    vote_summary?: {
        bioguide_id?: string;
        congress?: number;
        total_votes?: number;
        missed_votes?: number;
        missed_vote_pct?: number | null;
        party_line_votes?: number;
        party_line_pct?: number | null;
        recent_votes?: Array<{
            vote_id: string;
            congress?: number;
            chamber?: string;
            roll_number?: number;
            vote_date?: string | null;
            question: string;
            position: string;
        }>;
    } | null;
    matchConfidence?: string;
    biography_summary?: string | null;
    biography_full?: string | null;
    provenance?: ProvenanceSummary;
};

type LegislatorsResponse = {
    data?: Array<Record<string, unknown>>;
    members?: Array<Record<string, unknown>>;
};

function mapLegislator(raw: Record<string, unknown>, recentTrades: StockTrade[] = []): Legislator {
    const tradeSummary = raw.trade_summary as LegislatorTradeSummary | null | undefined;

    return {
        id: String(raw.id || raw.bioguide_id || ""),
        bioguide_id: String(raw.bioguide_id || raw.id || ""),
        name: String(raw.name || raw.official_full_name || raw.first_name + " " + raw.last_name || ""),
        first_name: String(raw.first_name || ""),
        last_name: String(raw.last_name || ""),
        official_full_name: raw.official_full_name as string | undefined,
        party: String(raw.party || raw.current_party || "Unknown"),
        current_party: raw.current_party as string | undefined,
        state: String(raw.state || raw.current_state || ""),
        current_state: raw.current_state as string | undefined,
        district: String(raw.district || raw.current_district || ""),
        current_district: raw.current_district as string | undefined,
        chamber: String(raw.chamber || raw.current_chamber || "Congress"),
        current_chamber: raw.current_chamber as string | undefined,
        avatar: String(raw.avatar || raw.depiction_url || ""),
        bio: String(raw.bio || ""),
        billsSponsored: Number(raw.bills_sponsored || raw.billsSponsored || 0),
        recentTrades,
        url: String(raw.url || raw.website_url || ""),
        twitter_account: String(raw.twitter_account || ""),
        facebook_account: String(raw.facebook_account || ""),
        youtube_account: String(raw.youtube_account || ""),
        contact_form: raw.contact_form as string | null | undefined ?? null,
        in_office: raw.in_office !== undefined ? Boolean(raw.in_office) : true,
        next_election: String(raw.next_election || ""),
        trade_summary: tradeSummary ?? null,
        // New intelligence fields — undefined when backend has no data
        depiction_url: raw.depiction_url as string | null | undefined,
        website_url: raw.website_url as string | null | undefined,
        office_address: raw.office_address as string | null | undefined,
        phone: raw.phone as string | null | undefined,
        years_in_office: raw.years_in_office == null ? null : Number(raw.years_in_office),
        birthday: raw.birthday as string | null | undefined,
        age: raw.age == null ? null : Number(raw.age),
        gender: raw.gender as string | null | undefined,
        service_start: raw.service_start as string | null | undefined,
        current_term_end: raw.current_term_end as string | null | undefined,
        party_history: raw.party_history as Array<{ party: string; start?: string; end?: string }> | undefined,
        terms: raw.terms as Array<{ chamber: string; state: string; district?: string; party: string; start_date: string; end_date?: string | null; senate_class?: number | null }> | undefined,
        identifiers: raw.identifiers as Record<string, string[]> | undefined,
        education: raw.education as string[] | undefined,
        prior_employment: raw.prior_employment as string[] | undefined,
        hometown: raw.hometown as string | null | undefined,
        birthplace: raw.birthplace as string | null | undefined,
        nominate_dim1: raw.nominate_dim1 as number | null | undefined,
        nominate_dim2: raw.nominate_dim2 as number | null | undefined,
        totalDonations: raw.totalDonations as number | undefined,
        votingScore: raw.votingScore as number | undefined,
        committees: raw.committees as Array<string | { committee_id?: string; name?: string; chamber?: string; rank?: number; title?: string; congress?: number }> | undefined,
        topDonors: raw.topDonors as Array<{ name: string; amount: number; industry?: string }> | undefined,
        recentBills: raw.recentBills as Array<{ id?: string; title: string; status?: string; date: string }> | undefined,
        biography_summary: raw.biography_summary as string | null | undefined,
        biography_full: raw.biography_full as string | null | undefined,
        matchConfidence: raw.matchConfidence as string | undefined,
        provenance: raw.provenance as ProvenanceSummary | undefined,
        vote_summary: raw.vote_summary as Legislator['vote_summary'] | undefined,
    };
}

export async function getLegislator(id: string, signal?: AbortSignal): Promise<Legislator | null> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/members/${encodeURIComponent(id)}/profile`, { signal });
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`Failed to fetch legislator: ${response.status} ${response.statusText}`);
        }

        const raw = await response.json();
        const memberData = raw.member || raw;
        const tradeId = memberData.trade_summary?.politician_id || memberData.bioguide_id || memberData.id;
        let recentTrades: StockTrade[] = [];
        if (tradeId) {
            try {
                recentTrades = await getTradesByPoliticianId(String(tradeId), signal);
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") throw error;
                log.warn("Trade history unavailable; continuing with the member profile", {
                    memberId: id,
                    error: String(error),
                });
            }
        }
        return mapLegislator(memberData, recentTrades);
    } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
            log.error("Error fetching legislator", { error: String(error) });
        }
        throw error;
    }
}
export async function getAllLegislators(chamber?: string): Promise<Legislator[]> {
    try {
        const params = new URLSearchParams();
        params.set("limit", chamber ? "100" : "535");
        if (chamber && chamber !== "all") {
            params.set("chamber", chamber);
        }

        const response = await fetch(`${BACKEND_URL}/api/members?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch legislators: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as LegislatorsResponse;
        const members = Array.isArray(data) ? data : (data.data || data.members || []);
        return members.map((item: Record<string, unknown>) => mapLegislator(item));
    } catch (error) {
        log.error("Error fetching legislators", { error: String(error) });
        throw error;
    }
}

export type MemberLegislationItem = {
    bill_id: string;
    congress: number;
    bill_type: string;
    bill_number: number;
    title: string;
    status: string;
    introduced_date?: string | null;
    latest_action_date?: string | null;
    latest_action_text?: string | null;
    sponsor_type: "sponsor" | "cosponsor";
    sponsorship_date?: string | null;
    is_original_cosponsor: boolean;
};

export type MemberLegislationResponse = {
    sponsor: MemberLegislationItem[];
    cosponsor: MemberLegislationItem[];
    provenance?: ProvenanceSummary;
};

export async function getMemberLegislation(
    bioguideId: string,
    congress = 119,
    signal?: AbortSignal,
): Promise<MemberLegislationResponse> {
    const params = new URLSearchParams({ congress: String(congress), limit: "200" });
    const response = await fetch(
        `${BACKEND_URL}/api/members/${encodeURIComponent(bioguideId)}/legislation?${params}`,
        { signal },
    );
    if (!response.ok) {
        throw new Error(`Failed to fetch member legislation: ${response.status}`);
    }
    return response.json();
}
