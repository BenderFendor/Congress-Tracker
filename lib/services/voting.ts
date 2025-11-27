
export interface Vote {
    bill: {
        bill_id: string;
        number: string;
        title: string;
        latest_action: string;
    };
    question: string;
    description: string;
    date: string;
    time: string;
    result: string;
    position: string; // Yes, No, Not Voting, Present
}

// Fallback data for key issues if API fails or key is missing
const MOCK_VOTES: Record<string, Vote[]> = {
    "Israel": [
        {
            bill: { bill_id: "hr6126-118", number: "H.R. 6126", title: "Israel Security Supplemental Appropriations Act, 2024", latest_action: "Passed House" },
            question: "On Passage",
            description: "Providing emergency supplemental appropriations to respond to the attacks in Israel for the fiscal year ending September 30, 2024, and for other purposes.",
            date: "2023-11-02",
            time: "17:00",
            result: "Passed",
            position: "Yes"
        },
        {
            bill: { bill_id: "hres771-118", number: "H.Res. 771", title: "Standing with Israel as it defends itself against the barbaric war launched by Hamas and other terrorists.", latest_action: "Agreed to in House" },
            question: "On Motion to Suspend the Rules and Agree",
            description: "Standing with Israel as it defends itself against the barbaric war launched by Hamas and other terrorists.",
            date: "2023-10-25",
            time: "16:30",
            result: "Passed",
            position: "Yes"
        }
    ],
    "Ukraine": [
        {
            bill: { bill_id: "hr8035-118", number: "H.R. 8035", title: "Ukraine Security Supplemental Appropriations Act, 2024", latest_action: "Passed House" },
            question: "On Passage",
            description: "Making emergency supplemental appropriations to respond to the situation in Ukraine and for related expenses for the fiscal year ending September 30, 2024, and for other purposes.",
            date: "2024-04-20",
            time: "13:45",
            result: "Passed",
            position: "Yes"
        },
        {
            bill: { bill_id: "hr7691-117", number: "H.R. 7691", title: "Additional Ukraine Supplemental Appropriations Act, 2022", latest_action: "Became Public Law" },
            question: "On Passage",
            description: "Making emergency supplemental appropriations for assistance for the situation in Ukraine for the fiscal year ending September 30, 2022, and for other purposes.",
            date: "2022-05-10",
            time: "19:30",
            result: "Passed",
            position: "Yes"
        }
    ]
};

const PROPUBLICA_API_KEY = process.env.NEXT_PUBLIC_PROPUBLICA_API_KEY || process.env.PROPUBLICA_API_KEY;
const BASE_URL = 'https://api.propublica.org/congress/v1';

export async function getMemberVotes(memberId: string): Promise<Vote[]> {
    if (!PROPUBLICA_API_KEY) {
        console.warn("ProPublica API key not found. Using mock data.");
        return [...MOCK_VOTES["Israel"], ...MOCK_VOTES["Ukraine"]];
    }

    try {
        const response = await fetch(`${BASE_URL}/members/${memberId}/votes.json`, {
            headers: {
                'X-API-Key': PROPUBLICA_API_KEY
            }
        });

        if (!response.ok) {
            // Fallback if API fails (e.g. rate limit or invalid ID)
            console.error(`ProPublica API error: ${response.statusText}`);
            return [...MOCK_VOTES["Israel"], ...MOCK_VOTES["Ukraine"]];
        }

        const data = await response.json();
        return data.results[0].votes.map((v: any) => ({
            bill: {
                bill_id: v.bill.bill_id,
                number: v.bill.number,
                title: v.bill.title,
                latest_action: v.bill.latest_action
            },
            question: v.question,
            description: v.description,
            date: v.date,
            time: v.time,
            result: v.result,
            position: v.position
        }));
    } catch (error) {
        console.error("Error fetching votes:", error);
        return [...MOCK_VOTES["Israel"], ...MOCK_VOTES["Ukraine"]];
    }
}

export async function getVotesOnTopic(topic: string): Promise<Vote[]> {
    // In a real app, we would search for bills related to the topic and then find votes.
    // For this demo, we return the curated mock votes for the requested topics.
    if (topic.toLowerCase().includes("israel") || topic.toLowerCase().includes("palestine")) {
        return MOCK_VOTES["Israel"];
    }
    if (topic.toLowerCase().includes("ukraine")) {
        return MOCK_VOTES["Ukraine"];
    }
    return [];
}
