import { getIntelTrades } from "./stocks";

export interface EnrichedTrade {
  ticker: string;
  asset_description: string;
  trade_type: "BUY" | "SELL" | "EXCHANGE" | "UNKNOWN";
  amount: string;
  estimated_value: number;
  trade_date: string | null;
  disclosure_date: string | null;
  disclosure_lag_days: number | null;
  late_filing: boolean;
  chamber: string;
  politician_name: string;
  party: string;
  state: string;
  district: string | null;
  owner: string | null;
  sector: string;
  industry: string;
  sector_source: "StaticMap" | "YahooApi" | "Unknown";
  committees: string[];
  committee_conflicts: never[];
  highest_conflict_severity: "DIRECT OVERLAP" | "ADJACENT" | "CLEAN";
  conflict_flag_count: number;
}

function mapTrade(trade: Awaited<ReturnType<typeof getIntelTrades>>["trades"][number]): EnrichedTrade {
  const type = trade.tx_type.toUpperCase();
  const tradeType: EnrichedTrade["trade_type"] =
    type === "BUY" || type === "SELL" || type === "EXCHANGE" ? type : "UNKNOWN";
  const estimatedValue = trade.estimated_value ?? trade.amount_max ?? trade.amount_min ?? 0;
  return {
    ticker: trade.ticker ?? "N/A",
    asset_description: trade.asset_name ?? "Asset description unavailable",
    trade_type: tradeType,
    amount: trade.amount_min != null || trade.amount_max != null
      ? `${trade.amount_min ?? "?"}-${trade.amount_max ?? "?"}`
      : "Range unavailable",
    estimated_value: estimatedValue,
    trade_date: trade.transaction_date,
    disclosure_date: trade.disclosure_date,
    disclosure_lag_days: null,
    late_filing: false,
    chamber: trade.chamber,
    politician_name: trade.member_name,
    party: trade.party,
    state: trade.state,
    district: trade.district,
    owner: null,
    sector: "Unknown",
    industry: "Unknown",
    sector_source: "Unknown",
    committees: [],
    committee_conflicts: [],
    highest_conflict_severity: "CLEAN",
    conflict_flag_count: 0,
  };
}

/** Compatibility adapter over the canonical stock-trades endpoint. */
export async function getEnrichedTrades(options?: { politician_id?: string; limit?: number }): Promise<EnrichedTrade[]> {
  const data = await getIntelTrades(options?.limit ?? 100, 0);
  const trades = data.trades.map(mapTrade);
  return options?.politician_id
    ? trades.filter((trade) => trade.politician_name === options.politician_id)
    : trades;
}

export async function getEnrichedMember(id: string): Promise<{ legislator: Record<string, unknown>; metrics: Record<string, never>; trades: EnrichedTrade[] }> {
  return { legislator: {}, metrics: {}, trades: await getEnrichedTrades({ politician_id: id }) };
}

export async function getAnomalyScores(): Promise<never[]> {
  throw new Error("Anomaly scores are unavailable until canonical evidence signals are ingested.");
}

export async function getAllSectors(): Promise<never[]> {
  throw new Error("Sector enrichment is unavailable until canonical issuer metadata is ingested.");
}

export async function getCommitteeKeywords(): Promise<never[]> {
  throw new Error("Committee conflict metadata is unavailable until canonical issuer metadata is ingested.");
}
