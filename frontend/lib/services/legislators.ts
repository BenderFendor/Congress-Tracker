import { getTradesByPoliticianId, StockTrade } from "./stocks";

const BASE_URL = '/api/congress-proxy?url=https://api.congress.gov/v3';

export interface Legislator {
    id: string;
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
}

export async function getLegislator(id: string): Promise<Legislator | null> {
    try {
        const [congressResponse, trades] = await Promise.all([
            fetch(`${BASE_URL}/member/${id}?format=json`),
            getTradesByPoliticianId(id)
        ]);

        if (!congressResponse.ok) {
            console.error(`Congress.gov API error: ${congressResponse.statusText}`);
            return null;
        }

        const data = await congressResponse.json();
        const member = data.member;

        if (!member) {
            return null;
        }

        const currentTerm = member.terms ? member.terms.item[member.terms.item.length - 1] : {};

        return {
            id: member.bioguideId,
            name: `${member.firstName} ${member.lastName}`,
            first_name: member.firstName,
            last_name: member.lastName,
            party: member.partyHistory ? member.partyHistory.item[0].partyName : "N/A",
            state: member.state,
            district: member.district ? member.district.toString() : "",
            chamber: currentTerm.chamber || "Congress",
            avatar: member.depiction ? member.depiction.imageUrl : `https://theunitedstates.io/images/congress/225x275/${member.bioguideId}.jpg`,
            bio: `Representative ${member.firstName} ${member.lastName} serves ${member.state}.`,
            totalDonations: 0,
            billsSponsored: member.sponsoredLegislation ? member.sponsoredLegislation.count : 0,
            votingScore: 0,
            committees: [],
            topDonors: [],
            recentBills: [],
            recentTrades: trades,
            url: member.officialWebsiteUrl || "",
            twitter_account: "",
            facebook_account: "",
            youtube_account: "",
            contact_form: "",
            in_office: !!member.currentMember,
            next_election: ""
        };
    } catch (error) {
        console.error("Error fetching legislator:", error);
        return null;
    }
}

export async function getAllLegislators(chamber = 'house', congress = 118): Promise<Legislator[]> {
    try {
        const response = await fetch(`${BASE_URL}/member?format=json&limit=250`);

        if (!response.ok) {
            console.error(`Congress.gov API error: ${response.statusText}`);
            return [];
        }

        const data = await response.json();

        if (!data.members || !data.members.map) {
            return [];
        }

        return data.members.map((member: any) => ({
            id: member.bioguideId,
            name: member.name,
            first_name: member.name.split(',')[1]?.trim() || "",
            last_name: member.name.split(',')[0]?.trim() || "",
            party: member.partyName,
            state: member.state,
            district: member.district ? member.district.toString() : "",
            chamber: member.terms ? member.terms.item[0].chamber : chamber,
            avatar: member.depiction ? member.depiction.imageUrl : `https://theunitedstates.io/images/congress/225x275/${member.bioguideId}.jpg`,
            bio: "",
            totalDonations: 0,
            billsSponsored: 0,
            votingScore: 0,
            committees: [],
            topDonors: [],
            recentBills: [],
            url: member.url || "",
            twitter_account: "",
            facebook_account: "",
            youtube_account: "",
            contact_form: "",
            in_office: true,
            next_election: ""
        }));

    } catch (error) {
        console.error("Error fetching legislators:", error);
        return [];
    }
}