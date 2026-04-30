// lib/services/enrichment.ts
// Backend enrichment endpoints: sector lookup, committee conflicts, anomaly scores.
// Based on poli-ticker by ibotzhub (committee conflict detection),
// CongressWatch by OpenSourcePatents (anomaly scoring),
// and congress-trading-monitor by Adrian Krebs (trade metrics).

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:4020';

export interface EnrichedTrade {
  ticker: string;
  asset_description: string;
  trade_type: 'BUY' | 'SELL' | 'EXCHANGE' | 'UNKNOWN';
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
  sector_source: 'StaticMap' | 'YahooApi' | 'Unknown';
  committees: string[];
  committee_conflicts: CommitteeConflict[];
  highest_conflict_severity: 'DIRECT OVERLAP' | 'ADJACENT' | 'CLEAN';
  conflict_flag_count: number;
}

export interface CommitteeConflict {
  ticker: string;
  sector: string;
  industry: string;
  committee: string;
  severity: 'DIRECT OVERLAP' | 'ADJACENT' | 'CLEAN';
  description: string;
}

export interface FilerMetrics {
  politician_name: string;
  party: string;
  state: string;
  chamber: string;
  total_trades: number;
  total_buys: number;
  total_sells: number;
  buy_sell_ratio: number;
  estimated_total_volume: number;
  top_tickers: [string, number][];
  top_sectors: [string, number][];
  committees: string[];
  conflict_count: number;
  direct_conflict_count: number;
  adjacent_conflict_count: number;
  late_filing_count: number;
  late_filing_rate: number;
  last_trade_date: string | null;
}

export interface AnomalySignals {
  stock_timing: number;
  wealth_gap: number;
  donor_vote_alignment: number;
  bill_authorship: number;
  foreign_travel: number;
  attendance: number;
}

export interface AnomalyScore {
  member_identifier: string;
  member_name: string;
  signals: AnomalySignals;
  overall_score: number;
  percentile: number | null;
}

export interface SectorInfo {
  sector: string;
  industries: string[];
}

export interface CommitteeKeyword {
  keyword: string;
  sectors: string[];
}

export async function getEnrichedTrades(options?: {
  politician_id?: string
  limit?: number
}): Promise<EnrichedTrade[]> {
  const params = new URLSearchParams();
  if (options?.politician_id) params.set('politician_id', options.politician_id);
  params.set('limit', String(options?.limit ?? 100));

  try {
    const res = await fetch(`${API_BASE}/api/enrichment/trades?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch enriched trades:', error);
    return [];
  }
}

export async function getEnrichedMember(id: string): Promise<{
  legislator: Record<string, unknown>;
  metrics: FilerMetrics;
  trades: EnrichedTrade[];
} | null> {
  try {
    const res = await fetch(`${API_BASE}/api/enrichment/member/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch enriched member:', error);
    return null;
  }
}

export async function getAnomalyScores(memberId?: string): Promise<AnomalyScore[]> {
  const params = new URLSearchParams();
  if (memberId) params.set('member_id', memberId);

  try {
    const res = await fetch(`${API_BASE}/api/enrichment/anomaly?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch anomaly scores:', error);
    return [];
  }
}

export async function getAllSectors(): Promise<SectorInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/api/enrichment/sectors`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.sectors;
  } catch (error) {
    console.error('Failed to fetch sectors:', error);
    return [];
  }
}

export async function getCommitteeKeywords(): Promise<CommitteeKeyword[]> {
  try {
    const res = await fetch(`${API_BASE}/api/enrichment/committee-keywords`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.keywords;
  } catch (error) {
    console.error('Failed to fetch committee keywords:', error);
    return [];
  }
}
