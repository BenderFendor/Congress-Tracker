const CONGRESS_GOV_API_KEY = process.env.NEXT_PUBLIC_CONGRESS_GOV_API_KEY || process.env.CONGRESS_GOV_API_KEY;
const BASE_URL = 'https://api.congress.gov/v3';

export interface Bill {
    id: string;
    title: string;
    status: string;
    date: string;
    url: string;
}

interface CongressBillRaw {
  type: string;
  number: string;
  title: string;
  latestAction?: { text: string };
  updateDate: string;
  url?: string;
}

export async function getRecentBills(limit = 10): Promise<Bill[]> {
    if (!CONGRESS_GOV_API_KEY) {
        console.warn("Congress.gov API key not found. Returning empty bills.");
        return [];
    }

    try {
        const response = await fetch(`${BASE_URL}/bill?format=json&limit=${limit}&sort=updateDate+desc`, {
            headers: {
                'X-Api-Key': CONGRESS_GOV_API_KEY
            }
        });

        if (!response.ok) {
            console.error(`Congress.gov API error: ${response.statusText}`);
            return [];
        }

        const data = await response.json();

        if (!data.bills) {
            return [];
        }

        return data.bills.map((bill: CongressBillRaw) => ({
            id: `${bill.type.toUpperCase()}-${bill.number}`,
            title: bill.title,
            status: bill.latestAction ? bill.latestAction.text.substring(0, 20) + (bill.latestAction.text.length > 20 ? '...' : '') : 'N/A',
            date: bill.updateDate,
            url: bill.url || '#'
        }));

    } catch (error) {
        console.error("Error fetching bills:", error);
        return [];
    }
}