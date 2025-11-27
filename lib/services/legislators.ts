
const CONGRESS_GOV_API_KEY = process.env.NEXT_PUBLIC_CONGRESS_GOV_API_KEY || process.env.CONGRESS_GOV_API_KEY;
const BASE_URL = 'https://api.congress.gov/v3';

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
    url: string;
    twitter_account: string;
    facebook_account: string;
    youtube_account: string;
    contact_form: string;
    in_office: boolean;
    next_election: string;
}

// Mock data for fallback
const MOCK_LEGISLATORS: Record<string, Legislator> = {
    "A000370": {
        id: "A000370",
        name: "Alma Adams",
        first_name: "Alma",
        last_name: "Adams",
        party: "D",
        state: "NC",
        district: "12",
        chamber: "House",
        avatar: "https://theunitedstates.io/images/congress/225x275/A000370.jpg",
        bio: "Representative Alma Adams serves North Carolina's 12th Congressional District.",
        totalDonations: 450000,
        billsSponsored: 15,
        votingScore: 92,
        committees: ["Agriculture", "Education and Labor"],
        topDonors: [
            { name: "Education Assoc", amount: 50000, industry: "Education" },
            { name: "Labor Union Local", amount: 45000, industry: "Labor" }
        ],
        recentBills: [
            { title: "H.R. 123: Education Access Act", status: "Introduced", date: "2023-01-15" }
        ],
        url: "https://adams.house.gov",
        twitter_account: "RepAdams",
        facebook_account: "CongresswomanAdams",
        youtube_account: "RepAlmaAdams",
        contact_form: "",
        in_office: true,
        next_election: "2024"
    },
    "O000172": {
        id: "O000172",
        name: "Alexandria Ocasio-Cortez",
        first_name: "Alexandria",
        last_name: "Ocasio-Cortez",
        party: "D",
        state: "NY",
        district: "14",
        chamber: "House",
        avatar: "https://theunitedstates.io/images/congress/225x275/O000172.jpg",
        bio: "Representative Alexandria Ocasio-Cortez proudly serves New York's 14th Congressional District.",
        totalDonations: 8500000,
        billsSponsored: 23,
        votingScore: 95,
        committees: ["Financial Services", "Oversight and Reform"],
        topDonors: [
            { name: "ActBlue", amount: 2100000, industry: "Political Action" },
            { name: "Justice Democrats", amount: 850000, industry: "Political Action" }
        ],
        recentBills: [
            { title: "Green New Deal Resolution", status: "Introduced", date: "2023-04-20" }
        ],
        url: "https://ocasio-cortez.house.gov",
        twitter_account: "RepAOC",
        facebook_account: "RepAOC",
        youtube_account: "RepAOC",
        contact_form: "",
        in_office: true,
        next_election: "2024"
    }
};

export async function getLegislator(id: string): Promise<Legislator | null> {
    if (!CONGRESS_GOV_API_KEY) {
        console.warn("Congress.gov API key not found. Using mock data.");
        return MOCK_LEGISLATORS[id] || MOCK_LEGISLATORS["O000172"];
    }

    try {
        const response = await fetch(`${BASE_URL}/member/${id}?format=json`, {
            headers: {
                'X-Api-Key': CONGRESS_GOV_API_KEY
            }
        });

        if (!response.ok) {
            console.error(`Congress.gov API error: ${response.statusText}`);
            return MOCK_LEGISLATORS[id] || MOCK_LEGISLATORS["O000172"];
        }

        const data = await response.json();
        const member = data.member;

        if (!member) {
            return MOCK_LEGISLATORS[id] || MOCK_LEGISLATORS["O000172"];
        }

        // Extract latest term for current details
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
            totalDonations: 0, // Not available in this API
            billsSponsored: member.sponsoredLegislation ? member.sponsoredLegislation.count : 0,
            votingScore: 0, // Not available directly
            committees: [], // Would need separate call
            topDonors: [],
            recentBills: [],
            url: member.officialWebsiteUrl || "",
            twitter_account: "", // Not consistently available
            facebook_account: "",
            youtube_account: "",
            contact_form: "",
            in_office: !!member.currentMember,
            next_election: ""
        };
    } catch (error) {
        console.error("Error fetching legislator:", error);
        return MOCK_LEGISLATORS[id] || MOCK_LEGISLATORS["O000172"];
    }
}

export async function getAllLegislators(chamber = 'house', congress = 118): Promise<Legislator[]> {
    if (!CONGRESS_GOV_API_KEY) {
        return Object.values(MOCK_LEGISLATORS);
    }

    try {
        // Congress.gov API pagination is limited, we might need to loop if we want ALL, 
        // but for now let's get the first batch (default 20, max 250)
        const response = await fetch(`${BASE_URL}/member?format=json&limit=250`, {
            headers: {
                'X-Api-Key': CONGRESS_GOV_API_KEY
            }
        });

        if (!response.ok) {
            console.error(`Congress.gov API error: ${response.statusText}`);
            return Object.values(MOCK_LEGISLATORS);
        }

        const data = await response.json();

        if (!data.members || !data.members.map) {
            return Object.values(MOCK_LEGISLATORS);
        }

        return data.members.map((member: any) => ({
            id: member.bioguideId,
            name: member.name,
            first_name: member.name.split(',')[1]?.trim() || "",
            last_name: member.name.split(',')[0]?.trim() || "",
            party: member.partyName,
            state: member.state,
            district: member.district ? member.district.toString() : "",
            chamber: member.terms ? member.terms.item[0].chamber : chamber, // Simplified
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
            in_office: true, // Assuming list returns current members mostly
            next_election: ""
        }));

    } catch (error) {
        console.error("Error fetching legislators:", error);
        return Object.values(MOCK_LEGISLATORS);
    }
}
