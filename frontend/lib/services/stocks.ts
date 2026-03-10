export interface StockTrade {
    disclosure_year: number;
    disclosure_date: string;
    transaction_date: string;
    owner: string;
    ticker: string;
    asset_description: string;
    type: string;
    amount: string;
    representative: string;
    district: string;
    ptr_link: string;
    cap_gains_over_200_usd: boolean;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:4020';

export async function getAllTrades(): Promise<StockTrade[]> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/trades`, { next: { revalidate: 3600 } });
        if (!response.ok) throw new Error(`Backend API error: ${response.statusText}`);
        
        const data = await response.json();
        const trades = data.data || [];

        return trades.map((trade: any) => ({
            disclosure_year: trade.filingDate ? new Date(trade.filingDate).getFullYear() : (trade.pubDate ? new Date(trade.pubDate).getFullYear() : 0),
            disclosure_date: trade.filingDate || trade.pubDate || "",
            transaction_date: trade.txDate || "",
            owner: trade.owner || "unknown", 
            ticker: trade.asset?.assetTicker || trade.issuer?.issuerTicker || "",
            asset_description: trade.issuer?.issuerName || trade.asset?.instrument || "",
            type: trade.txType || "", 
            amount: trade.value ? `Size Range: ${trade.value}` : "",
            representative: trade.politician ? `${trade.politician.firstName || ''} ${trade.politician.lastName || ''}`.trim() : "",
            district: trade.politician?._stateId || trade.politician?.state || "",
            ptr_link: trade.filingURL || "",
            cap_gains_over_200_usd: trade.hasCapitalGains || false
        }));
    } catch (error) {
        console.error("Error fetching trades:", error);
        return [];
    }
}

export async function getRecentTrades(limit = 50): Promise<StockTrade[]> {
    const allTrades = await getAllTrades();
    return allTrades
        .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
        .slice(0, limit);
}

export async function getTradesByLegislator(name: string): Promise<StockTrade[]> {
    const allTrades = await getAllTrades();
    return allTrades.filter(t => t.representative && t.representative.toLowerCase().includes(name.toLowerCase()));
}

export async function getTradesByTicker(ticker: string): Promise<StockTrade[]> {
    const allTrades = await getAllTrades();
    return allTrades.filter(t => t.ticker && t.ticker.toUpperCase() === ticker.toUpperCase());
}

export async function getTradesByPoliticianId(id: string): Promise<StockTrade[]> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/trades?politician=${id}`, { next: { revalidate: 3600 } });
        if (!response.ok) throw new Error(`Backend API error: ${response.statusText}`);
        
        const data = await response.json();
        const trades = data.data || [];

        return trades.map((trade: any) => ({
            disclosure_year: trade.filingDate ? new Date(trade.filingDate).getFullYear() : (trade.pubDate ? new Date(trade.pubDate).getFullYear() : 0),
            disclosure_date: trade.filingDate || trade.pubDate || "",
            transaction_date: trade.txDate || "",
            owner: trade.owner || "unknown", 
            ticker: trade.asset?.assetTicker || trade.issuer?.issuerTicker || "",
            asset_description: trade.issuer?.issuerName || trade.asset?.instrument || "",
            type: trade.txType || "", 
            amount: trade.value ? `$${trade.value.toLocaleString()}` : "N/A",
            representative: trade.politician ? `${trade.politician.firstName || ''} ${trade.politician.lastName || ''}`.trim() : "",
            district: trade.politician?._stateId || trade.politician?.state || "",
            ptr_link: trade.filingURL || "",
            cap_gains_over_200_usd: trade.hasCapitalGains || false
        }));
    } catch (error) {
        console.error("Error fetching trades for politician:", error);
        return [];
    }
}