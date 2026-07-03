import { BACKEND_URL } from "@/lib/constants";

// Matches StockTradeRow from the Rust backend
export interface StockTrade {
  trade_id: string;
  bioguide_id: string | null;
  politician_id: string | null;
  ticker: string | null;
  asset_name: string | null;
  tx_type: string;
  amount_min: number | null;
  amount_max: number | null;
  estimated_value: number | null;
  transaction_date: string | null;
  disclosure_date: string | null;
  filing_url: string | null;
  source: string;
  member_name: string;
  chamber: string;
  state: string;
  party: string;
  district: string | null;
}

export interface TradesResponse {
  trades: StockTrade[];
  total: number;
  limit: number;
  offset: number;
  tickers: string[];
}

export async function getIntelTrades(
  limit = 100,
  offset = 0,
): Promise<TradesResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const response = await fetch(
    `${BACKEND_URL}/api/stocks/transactions?${params}`,
    { next: { revalidate: 3600 } },
  );

  if (!response.ok) {
    throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getRecentTrades(
  limit = 80,
): Promise<StockTrade[]> {
  const data = await getIntelTrades(limit, 0);
  return data.trades;
}

export async function getTradesByTicker(ticker: string): Promise<StockTrade[]> {
  const response = await fetch(
    `${BACKEND_URL}/api/intel/trades/${encodeURIComponent(ticker)}`,
    { next: { revalidate: 3600 } },
  );

  if (!response.ok) {
    throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getTradesByPoliticianId(politicianId: string): Promise<StockTrade[]> {
  const data = await getIntelTrades(200, 0);
  return data.trades.filter(t => t.politician_id === politicianId);
}

export function formatAmountRange(
  amountMin: number | null,
  amountMax: number | null,
): string {
  if (amountMin == null && amountMax == null) return "Not disclosed";
  if (amountMin != null && amountMax != null) {
    if (amountMin === amountMax) return formatDollar(amountMin);
    return `${formatDollar(amountMin)} – ${formatDollar(amountMax)}`;
  }
  if (amountMin != null) return `≥ ${formatDollar(amountMin)}`;
  return `≤ ${formatDollar(amountMax!)}`;
}

function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}
