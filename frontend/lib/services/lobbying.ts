import { createLogger } from "@/lib/tracing";

import { BACKEND_URL } from "@/lib/constants";
const log = createLogger("LobbyingService");


export interface LobbyingFiling {
  filing_uuid: string;
  filing_year: number | null;
  filing_period: string | null;
  filing_type: string | null;
  income: number | null;
  expenses: number | null;
  dt_posted: string | null;
  registrant_id: number | null;
  registrant_name: string | null;
  client_id: number | null;
  client_name: string | null;
  issue_codes: string[];
}

export interface Registrant {
    id: number
    name: string
    description?: string
    address_1?: string
    address_2?: string
    city?: string
    state?: string
    state_display?: string
    zip?: string
    country?: string
    country_display?: string
    contact_name?: string
    contact_telephone?: string
    url: string
    dt_updated: string
}

export interface Filing {
    filing_uuid: string
    filing_type: string
    filing_type_display: string
    filing_year: number
    filing_period: string
    filing_period_display: string
    dt_posted: string
    registrant: Registrant
    client?: {
        id: number
        name: string
        state?: string
        country?: string
    }
    lobbying_activities?: Array<{
        general_issue_area: string
        general_issue_area_display: string
        description?: string
        house_of_representatives: boolean
        senate: boolean
    }>
    income?: number
    expenses?: number
    url: string
}

export async function getRecentFilings(page = 1, pageSize = 25): Promise<{ count: number, results: LobbyingFiling[] }> {
    const offset = (page - 1) * pageSize;
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
    const response = await fetch(`${BACKEND_URL}/api/lobbying/filings?${params}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch filings: ${response.statusText}`);
    }
    const data = await response.json();
    return { count: data.total, results: data.filings };
}

export async function getRegistrants(page = 1, pageSize = 25): Promise<{ count: number, results: Registrant[] }> {
    void page;
    void pageSize;
    throw new Error("Lobbying registrant list endpoint is not implemented yet. Use /api/lobbying/filings for LDA-backed filings.");
}

export interface LobbyingClient {
  id: number;
  name: string;
  description?: string;
  state?: string;
  country?: string;
  url: string;
}

export async function getLobbyingClients(params: {
  client_name?: string;
  page?: number;
  page_size?: number;
}): Promise<{ count: number; results: LobbyingClient[] } | null> {
  const searchParams = new URLSearchParams();
  if (params.client_name) searchParams.set('client_name', params.client_name);
  searchParams.set('page_size', String(params.page_size ?? 25));
  if (params.page) searchParams.set('page', String(params.page));

  void searchParams;
  throw new Error("Lobbying client search endpoint is not implemented yet. Use /api/lobbying/filings with client filters.");
}

export async function getLobbyingRegistrants(params: {
  registrant_name?: string;
  page?: number;
  page_size?: number;
}): Promise<{ count: number; results: Registrant[] } | null> {
  const searchParams = new URLSearchParams();
  if (params.registrant_name) searchParams.set('registrant_name', params.registrant_name);
  searchParams.set('page_size', String(params.page_size ?? 25));
  if (params.page) searchParams.set('page', String(params.page));

  void searchParams;
  throw new Error("Lobbying registrant search endpoint is not implemented yet. Use /api/lobbying/filings with registrant filters.");
}

export interface Lobbyist {
  id: number;
  name: string;
  position?: string;
  former_government?: boolean;
  url: string;
}

export async function getLobbyingLobbyists(params: {
  name?: string;
  page?: number;
  page_size?: number;
}): Promise<{ count: number; results: Lobbyist[] } | null> {
  const searchParams = new URLSearchParams();
  if (params.name) searchParams.set('registrant_name', params.name);
  searchParams.set('page_size', String(params.page_size ?? 25));
  if (params.page) searchParams.set('page', String(params.page));

  void searchParams;
  throw new Error("Lobbyist endpoint is not implemented yet. LDA filings are available through /api/lobbying/filings.");
}

export async function getFilingDetail(uuid: string): Promise<LobbyingFiling | null> {
  const res = await fetch(`${BACKEND_URL}/api/lobbying/filings/${encodeURIComponent(uuid)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lobbying filing detail request failed (${res.status})`);
  return res.json();
}

export interface Contribution {
  id: number;
  lobbyist_name?: string;
  registrant_name?: string;
  amount?: number;
  year?: number;
  url: string;
}

export async function getLobbyingContributions(params: {
  year?: number;
  page?: number;
  page_size?: number;
}): Promise<{ count: number; results: Contribution[] } | null> {
  void params;
  throw new Error("Lobbying contributions are not exposed by the canonical backend yet.");
}

export async function getLobbyingFilings(params: {
  client_name?: string;
  registrant_name?: string;
  year?: number;
  period?: string;
  issue?: string;
}): Promise<{ count: number; results: LobbyingFiling[] } | null> {
  const searchParams = new URLSearchParams();
  if (params.client_name) searchParams.set('client_name', params.client_name);
  if (params.registrant_name) searchParams.set('registrant_name', params.registrant_name);
  if (params.year) searchParams.set('year', String(params.year));
  if (params.period) searchParams.set('period', params.period);
  if (params.issue) searchParams.set('issue', params.issue);
  searchParams.set('page_size', '25');

  try {
    const res = await fetch(`${BACKEND_URL}/api/lobbying/filings?${searchParams}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    log.error('Failed to fetch lobbying filings', { error: String(error) });
    return null;
  }
}

// ── Lobbying analytics types ──

export type OverviewResponse = {
  year: number;
  totalReportedLobbying: number;
  periodLabel: string;
  breakdown: BreakdownItem[];
  sourceNote: string;
};

export type BreakdownItem = {
  label: string;
  amount: number;
  percent: number;
  derived?: boolean;
  source?: string;
};

export type FilingCardItem = {
  filingUuid: string;
  registrantId?: number;
  registrantName: string;
  clientName?: string;
  filedAt?: string;
  jurisdiction: string;
  entityRole: string;
  filingCount: number;
  clientCount: number;
  reportedAmount: number | null;
  reportedAmountLabel: string;
  topIssueAreas: string[];
  avatarText: string;
};

export type FilingsListResponse = {
  items: FilingCardItem[];
  hasMore: boolean;
};

export type FlowNode = {
  id: string;
  label: string;
  side: string;
};

export type FlowLink = {
  source: string;
  target: string;
  value: number;
};

export type InfluenceFlowResponse = {
  nodes: FlowNode[];
  links: FlowLink[];
};

export type SectorSpendItem = {
  sector: string;
  amount: number;
  filingCount: number;
  entityCount: number;
};

export type TopSectorsResponse = {
  year: number;
  allocationMethod: string;
  items: SectorSpendItem[];
  sourceNote: string;
};

export async function fetchLobbyingOverview(year?: number): Promise<OverviewResponse | null> {
  void year;
  throw new Error("Lobbying overview is not exposed by the canonical backend yet.");
}

export async function fetchLobbyingFilings(
  year?: number,
  q?: string,
  limit?: number,
  offset?: number
): Promise<FilingsListResponse> {
  const params = new URLSearchParams();
  if (year) params.set('year', String(year));
  if (q) params.set('registrant', q);
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  const res = await fetch(`${BACKEND_URL}/api/lobbying/filings?${params}`);
  if (!res.ok) throw new Error(`Lobbying filing request failed (${res.status})`);
  const data = await res.json() as {
    filings?: LobbyingFiling[];
    total?: number;
    limit?: number;
    offset?: number;
  };
  const filings = Array.isArray(data.filings) ? data.filings : [];
  const items: FilingCardItem[] = filings.map((filing) => {
      const name = filing.registrant_name || filing.client_name || "Unnamed filer";
      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
      return {
        filingUuid: filing.filing_uuid,
        registrantId: filing.registrant_id ?? undefined,
        registrantName: name,
        clientName: filing.client_name ?? undefined,
        filedAt: filing.dt_posted ?? undefined,
        jurisdiction: "Public filing",
        entityRole: "Registrant",
        filingCount: 1,
        clientCount: filing.client_name ? 1 : 0,
        reportedAmount: filing.income ?? filing.expenses,
        reportedAmountLabel: filing.income != null ? "Reported income" : filing.expenses != null ? "Reported expenses" : "Amount not published",
        topIssueAreas: filing.issue_codes ?? [],
        avatarText: initials || "LD",
      };
  });
  const pageLimit = data.limit ?? limit ?? items.length;
  const pageOffset = data.offset ?? offset ?? 0;
  const total = data.total ?? items.length;
  return { items, hasMore: pageOffset + pageLimit < total };
}

export async function fetchInfluenceFlow(year?: number): Promise<InfluenceFlowResponse | null> {
  void year;
  throw new Error("Lobbying influence flow is not exposed by the canonical backend yet.");
}

export async function fetchTopSectors(year?: number): Promise<TopSectorsResponse | null> {
  void year;
  throw new Error("Lobbying sector totals are not exposed by the canonical backend yet.");
}
