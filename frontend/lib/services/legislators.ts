import { getTradesByPoliticianId, StockTrade } from "./stocks";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:4020";
const CONGRESS_PROXY_BASE = "/api/congress-proxy?url=https://api.congress.gov/v3";

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
    party: string;
    state: string;
    district: string;
    chamber: string;
    avatar: string;
    bio: string;
    totalDonations: number;
    billsSponsored: number;
    votingScore: number;
    committees: string[];
    topDonors: { name: string; amount: number; industry: string }[];
    recentBills: { title: string; status: string; date: string }[];
    recentTrades: StockTrade[];
    url: string;
    twitter_account: string;
    facebook_account: string;
    youtube_account: string;
    contact_form: string;
    in_office: boolean;
    next_election: string;
    trade_summary: LegislatorTradeSummary | null;
};

type LegislatorsResponse = {
    data: Array<Record<string, unknown>>;
};

type CongressProxyMember = {
    bioguideId: string;
    name: string;
    partyName?: string;
    state?: string;
    district?: number;
    terms?: {
        item?: Array<{
            chamber?: string;
        }>;
    };
    depiction?: {
        imageUrl?: string;
    };
    url?: string;
};

function mapLegislator(raw: Record<string, unknown>, recentTrades: StockTrade[] = []): Legislator {
    const tradeSummary = raw.trade_summary as LegislatorTradeSummary | null | undefined;

    return {
        id: String(raw.id || ""),
        bioguide_id: String(raw.bioguide_id || raw.id || ""),
        name: String(raw.name || ""),
        first_name: String(raw.first_name || ""),
        last_name: String(raw.last_name || ""),
        party: String(raw.party || "Unknown"),
        state: String(raw.state || ""),
        district: String(raw.district || ""),
        chamber: String(raw.chamber || "Congress"),
        avatar: String(raw.avatar || ""),
        bio: String(raw.bio || ""),
        // Fields to populate when API enrichment is ready:
        totalDonations: 0,      // Source: OpenFEC /api/fec/receipts
        billsSponsored: Number(raw.bills_sponsored || 0),
        votingScore: 0,         // Source: Congress.gov /api/congress/votes + member filter
        committees: Array.isArray(raw.committees) ? raw.committees.map(String) : [],
        topDonors: [],          // Source: OpenFEC /api/fec/receipts aggregated by committee
        recentBills: [],        // Source: Congress.gov /api/congress/bills with member param
        recentTrades,
        url: String(raw.url || ""),
        twitter_account: "",    // Source: Congress.gov member detail
        facebook_account: "",
        youtube_account: "",
        contact_form: "",
        in_office: Boolean(raw.in_office),
        next_election: String(raw.next_election || ""), // Source: computed from Congress number
        trade_summary: tradeSummary ?? null,
    };
}

function normalizeName(value: string): string {
    return value
        .toLowerCase()
        .replace(/,/g, " ")
        .replace(/\./g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeParty(party: string): string {
    if (party.toLowerCase().includes("democrat")) return "Democrat";
    if (party.toLowerCase().includes("republican")) return "Republican";
    if (party.toLowerCase().includes("independent")) return "Independent";
    return party || "Unknown";
}

async function getCapitolTradesMap(): Promise<Map<string, LegislatorTradeSummary>> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/politicians`);
        if (!response.ok) {
            return new Map();
        }

        const payload = await response.json();
        const members = Array.isArray(payload.data) ? payload.data : [];
        const map = new Map<string, LegislatorTradeSummary>();

        members.forEach((member: any) => {
            const id = String(member._politicianId || "");
            if (!id) return;

            map.set(id, {
                politician_id: id,
                matched: true,
                match_confidence: "exact_id",
                source: "capitoltrades",
                stats: {
                    count_trades: Number(member.stats?.count_trades || 0),
                    count_issuers: Number(member.stats?.count_issuers || 0),
                    volume: Number(member.stats?.volume || 0),
                    last_traded: member.stats?.date_last_traded || null,
                },
            });
        });

        return map;
    } catch (error) {
        console.error("Error fetching CapitolTrades map:", error);
        return new Map();
    }
}

function mergeProxyMember(member: CongressProxyMember, trades: Map<string, LegislatorTradeSummary>): Legislator {
    const currentTerm = member.terms?.item?.[member.terms.item.length - 1];
    const tradeSummary = trades.get(member.bioguideId) ?? null;
    const name = member.name.includes(",")
        ? member.name.split(",").slice(1).join(",").trim() + " " + member.name.split(",")[0].trim()
        : member.name;
    const cleanedName = normalizeName(name).split(" ");
    const first_name = cleanedName.slice(0, -1).join(" ") || cleanedName[0] || "";
    const last_name = cleanedName.length > 1 ? cleanedName[cleanedName.length - 1] : "";

    return {
        id: member.bioguideId,
        bioguide_id: member.bioguideId,
        name,
        first_name,
        last_name,
        party: normalizeParty(member.partyName || "Unknown"),
        state: member.state || "",
        district: member.district ? String(member.district) : "",
        chamber: currentTerm?.chamber || "Congress",
        avatar: member.depiction?.imageUrl || `https://theunitedstates.io/images/congress/225x275/${member.bioguideId}.jpg`,
        bio: `${currentTerm?.chamber === "Senate" ? "Senator" : "Representative"} ${name} serves ${member.state || ""}.`.trim(),
        totalDonations: 0,
        billsSponsored: 0,
        votingScore: 0,
        committees: [],
        topDonors: [],
        recentBills: [],
        recentTrades: [],
        url: member.url || "",
        twitter_account: "",
        facebook_account: "",
        youtube_account: "",
        contact_form: "",
        in_office: true,
        next_election: "",
        trade_summary: tradeSummary,
    };
}

async function getAllLegislatorsFromProxy(chamber?: string): Promise<Legislator[]> {
    try {
        const tradesPromise = getCapitolTradesMap();
        const members: CongressProxyMember[] = [];
        let offset = 0;
        let totalCount = Number.POSITIVE_INFINITY;

        while (members.length < totalCount) {
            const response = await fetch(`${CONGRESS_PROXY_BASE}/member?format=json&limit=250&offset=${offset}`);
            if (!response.ok) {
                throw new Error(`Congress proxy error: ${response.statusText}`);
            }

            const data = await response.json();
            const pageMembers = Array.isArray(data.members) ? data.members : [];
            const count = Number(data.pagination?.count || pageMembers.length || 0);

            totalCount = Number.isFinite(count) && count > 0 ? count : pageMembers.length;
            members.push(...pageMembers);

            if (pageMembers.length === 0 || pageMembers.length < 250) {
                break;
            }

            offset += pageMembers.length;
        }

        const trades = await tradesPromise;

        return members
            .map((member: CongressProxyMember) => mergeProxyMember(member, trades))
            .filter((member) => !chamber || chamber === "all" || member.chamber.toLowerCase() === chamber.toLowerCase());
    } catch (error) {
        console.error("Error fetching legislators from proxy:", error);
        return [];
    }
}

async function getLegislatorFromProxy(id: string): Promise<Legislator | null> {
    try {
        const [memberResponse, trades] = await Promise.all([
            fetch(`${CONGRESS_PROXY_BASE}/member/${id}?format=json`),
            getCapitolTradesMap(),
        ]);

        if (!memberResponse.ok) {
            throw new Error(`Congress proxy error: ${memberResponse.statusText}`);
        }

        const data = await memberResponse.json();
        if (!data.member) {
            return null;
        }

        const legislator = mergeProxyMember(data.member as CongressProxyMember, trades);
        const tradeId = legislator.trade_summary?.politician_id || legislator.bioguide_id;
        const recentTrades = tradeId ? await getTradesByPoliticianId(tradeId) : [];
        return { ...legislator, recentTrades };
    } catch (error) {
        console.error("Error fetching legislator from proxy:", error);
        return null;
    }
}

export async function getLegislator(id: string): Promise<Legislator | null> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/legislators/${id}`);
        if (!response.ok) {
            return getLegislatorFromProxy(id);
        }

        const raw = await response.json();
        const tradeId = raw.trade_summary?.politician_id || raw.bioguide_id || raw.id;
        const recentTrades = tradeId ? await getTradesByPoliticianId(String(tradeId)) : [];
        return mapLegislator(raw, recentTrades);
    } catch (error) {
        console.error("Error fetching legislator:", error);
        return getLegislatorFromProxy(id);
    }
}

export async function getAllLegislators(chamber?: string, congress?: number): Promise<Legislator[]> {
    void congress;

    try {
        const params = new URLSearchParams();
        params.set("limit", "535");
        if (chamber && chamber !== "all") {
            params.set("chamber", chamber);
        }

        const response = await fetch(`${BACKEND_URL}/api/legislators?${params.toString()}`);
        if (!response.ok) {
            return getAllLegislatorsFromProxy(chamber);
        }

        const data = (await response.json()) as LegislatorsResponse;
        return (data.data || []).map((item) => mapLegislator(item));
    } catch (error) {
        console.error("Error fetching legislators:", error);
        return getAllLegislatorsFromProxy(chamber);
    }
}
