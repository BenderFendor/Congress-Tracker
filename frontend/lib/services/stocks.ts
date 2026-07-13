import { BACKEND_URL } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommitteeConflict {
  ticker: string;
  sector: string;
  industry: string;
  committee: string;
  severity: "CLEAN" | "ADJACENT" | "DIRECT OVERLAP";
  description: string;
}

export type SourceTier = "primary" | "secondary" | "enrichment";

export function getSourceTier(source: string): SourceTier {
  if ([
    "house_clerk",
    "house_clerk_index",
    "house_disclosures",
    "senate_efd",
    "senate_disclosures",
    "congress_gov",
    "openfec",
    "lda",
  ].includes(source)) return "primary";
  if (source === "capitoltrades") return "secondary";
  return "enrichment";
}

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
  // evidence fields from enrichment
  sector: string;
  industry: string;
  disclosure_lag_days: number | null;
  late_filing: boolean;
  committee_names: string[];
  committee_conflicts: CommitteeConflict[];
  conflict_flag_count: number;
  highest_conflict_severity: string;
}

export interface TradesResponse {
  trades: StockTrade[];
  total: number;
  limit: number;
  offset: number;
  tickers: string[];
  coverage: {
    status: "loaded" | "not_loaded";
    message: string;
    has_more: boolean;
    excluded_date_anomalies: number;
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export async function getIntelTrades(
  limit = 100,
  offset = 0,
  signal?: AbortSignal,
): Promise<TradesResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const response = await fetch(
    `${BACKEND_URL}/api/stocks/transactions?${params}`,
    { next: { revalidate: 3600 }, signal },
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

export async function getTradesByTicker(
  ticker: string,
  limit = 100,
  offset = 0,
): Promise<TradesResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await fetch(
    `${BACKEND_URL}/api/intel/trades/${encodeURIComponent(ticker)}?${params}`,
    { next: { revalidate: 3600 } },
  );

  if (!response.ok) {
    throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getTradesByMemberId(
  memberId: string,
  limit = 100,
  offset = 0,
  signal?: AbortSignal,
): Promise<TradesResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await fetch(
    `${BACKEND_URL}/api/members/${encodeURIComponent(memberId)}/trades?${params}`,
    { next: { revalidate: 3600 }, signal },
  );

  if (!response.ok) {
    throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatAmountRange(
  amountMin: number | null,
  amountMax: number | null,
): string {
  if (amountMin == null && amountMax == null) return "Not disclosed";
  if (amountMin != null && amountMax != null) {
    if (amountMin === amountMax) return formatDollar(amountMin);
    return `${formatDollar(amountMin)} \u2013 ${formatDollar(amountMax)}`;
  }
  if (amountMin != null) return `\u2265 ${formatDollar(amountMin)}`;
  return amountMax == null ? "Not disclosed" : `\u2264 ${formatDollar(amountMax)}`;
}

function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}
