
const CONGRESS_GOV_API_KEY = process.env.NEXT_PUBLIC_CONGRESS_GOV_API_KEY || process.env.CONGRESS_GOV_API_KEY;
const BASE_URL = 'https://api.congress.gov/v3';

export interface Bill {
    id: string;
    title: string;
    status: string;
    date: string;
    url: string;
}

// Mock data for fallback
const MOCK_BILLS: Bill[] = [
    { id: 'HR-405', title: 'Digital Asset Framework', status: 'PASSED', date: 'May 12, 1984', url: '#' },
    { id: 'S-221', title: 'Cybersecurity Approp.', status: 'VETOED', date: 'June 01, 1984', url: '#' },
    { id: 'HR-99', title: 'Infrastructure Rev.', status: 'COMMITTEE', date: 'June 15, 1984', url: '#' },
];

export async function getRecentBills(limit = 10): Promise<Bill[]> {
    if (!CONGRESS_GOV_API_KEY) {
        console.warn("Congress.gov API key not found. Using mock data.");
        return MOCK_BILLS;
    }

    try {
        const response = await fetch(`${BASE_URL}/bill?format=json&limit=${limit}&sort=updateDate+desc`, {
            headers: {
                'X-Api-Key': CONGRESS_GOV_API_KEY
            }
        });

        if (!response.ok) {
            console.error(`Congress.gov API error: ${response.statusText}`);
            return MOCK_BILLS;
        }

        const data = await response.json();

        if (!data.bills) {
            return MOCK_BILLS;
        }

        return data.bills.map((bill: any) => ({
            id: `${bill.type.toUpperCase()}-${bill.number}`,
            title: bill.title,
            status: bill.latestAction ? bill.latestAction.text.substring(0, 20) + (bill.latestAction.text.length > 20 ? '...' : '') : 'N/A',
            date: bill.updateDate,
            url: bill.url || '#'
        }));

    } catch (error) {
        console.error("Error fetching bills:", error);
        return MOCK_BILLS;
    }
}
