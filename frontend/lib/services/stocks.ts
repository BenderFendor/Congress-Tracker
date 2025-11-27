
export interface StockTrade {
    disclosure_year: number;
    disclosure_date: string;
    transaction_date: string;
    owner: string;
    ticker: string;
    asset_description: string;
    type: string; // purchase, sale_full, sale_partial, exchange
    amount: string;
    representative: string;
    district: string;
    ptr_link: string;
    cap_gains_over_200_usd: boolean;
}

// Mock data to replace the broken S3 source
const MOCK_TRADES: StockTrade[] = [
    {
        disclosure_year: 2023,
        disclosure_date: "2023-10-15",
        transaction_date: "2023-09-28",
        owner: "self",
        ticker: "AAPL",
        asset_description: "Apple Inc.",
        type: "purchase",
        amount: "$15,001 - $50,000",
        representative: "Nancy Pelosi",
        district: "CA-12",
        ptr_link: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2023/20023893.pdf",
        cap_gains_over_200_usd: false
    },
    {
        disclosure_year: 2023,
        disclosure_date: "2023-10-12",
        transaction_date: "2023-09-25",
        owner: "spouse",
        ticker: "MSFT",
        asset_description: "Microsoft Corporation",
        type: "sale_full",
        amount: "$50,001 - $100,000",
        representative: "Kevin McCarthy",
        district: "CA-20",
        ptr_link: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2023/20023855.pdf",
        cap_gains_over_200_usd: true
    },
    {
        disclosure_year: 2023,
        disclosure_date: "2023-10-05",
        transaction_date: "2023-09-15",
        owner: "joint",
        ticker: "NVDA",
        asset_description: "NVIDIA Corporation",
        type: "purchase",
        amount: "$1,001 - $15,000",
        representative: "Dan Crenshaw",
        district: "TX-02",
        ptr_link: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2023/20023812.pdf",
        cap_gains_over_200_usd: false
    },
    {
        disclosure_year: 2023,
        disclosure_date: "2023-09-20",
        transaction_date: "2023-08-30",
        owner: "self",
        ticker: "TSLA",
        asset_description: "Tesla, Inc.",
        type: "sale_partial",
        amount: "$15,001 - $50,000",
        representative: "Ro Khanna",
        district: "CA-17",
        ptr_link: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2023/20023750.pdf",
        cap_gains_over_200_usd: false
    },
    {
        disclosure_year: 2023,
        disclosure_date: "2023-09-15",
        transaction_date: "2023-08-25",
        owner: "spouse",
        ticker: "AMZN",
        asset_description: "Amazon.com, Inc.",
        type: "purchase",
        amount: "$100,001 - $250,000",
        representative: "Michael McCaul",
        district: "TX-10",
        ptr_link: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2023/20023710.pdf",
        cap_gains_over_200_usd: false
    }
];

export async function getAllTrades(): Promise<StockTrade[]> {
    // Return mock data immediately
    // In the future, this could be replaced with a call to a paid API like Finnhub
    // or a new community source if one emerges.
    return Promise.resolve(MOCK_TRADES);
}

export async function getRecentTrades(limit = 50): Promise<StockTrade[]> {
    const allTrades = await getAllTrades();
    // Sort by transaction_date descending
    return allTrades
        .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
        .slice(0, limit);
}

export async function getTradesByLegislator(name: string): Promise<StockTrade[]> {
    const allTrades = await getAllTrades();
    return allTrades.filter(t => t.representative.toLowerCase().includes(name.toLowerCase()));
}

export async function getTradesByTicker(ticker: string): Promise<StockTrade[]> {
    const allTrades = await getAllTrades();
    return allTrades.filter(t => t.ticker === ticker.toUpperCase());
}
