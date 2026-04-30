
// lib/services/lobbying.ts
// Senate Lobbying Disclosure Act (LDA) data.
// Based on lobbyR by Chris Cioffi (LGPLv3).

export interface LobbyingFiling {
  filing_uuid: string;
  filing_year: number;
  filing_period: string;
  filing_type: string;
  income: string | null;
  expenses: string | null;
  dt_posted: string;
  registrant: { name: string; description: string } | null;
  client: { name: string; description: string } | null;
  lobbyists: Array<{ name: string }> | null;
  issues: string[];
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

const BASE_URL = 'https://lda.senate.gov/api/v1';

export async function getRecentFilings(page = 1, pageSize = 25): Promise<{ count: number, results: Filing[] }> {
    const currentYear = new Date().getFullYear();
    const url = `${BASE_URL}/filings/?filing_year=${currentYear}&page=${page}&page_size=${pageSize}&ordering=-dt_posted`;

    // Use the proxy if running in browser, or direct if server-side (though this app seems to use client-side fetching mostly)
    // For now, we'll assume the proxy is needed for CORS if client-side, or we can try direct.
    // The existing code used a proxy. Let's keep using the proxy pattern if we are in the browser.

    const fetchUrl = typeof window !== 'undefined'
        ? `/api/congress-proxy?url=${encodeURIComponent(url)}`
        : url;

    const response = await fetch(fetchUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch filings: ${response.statusText}`);
    }
    return response.json();
}

export async function getRegistrants(page = 1, pageSize = 25): Promise<{ count: number, results: Registrant[] }> {
    const url = `${BASE_URL}/registrants/?page=${page}&page_size=${pageSize}`;
    const fetchUrl = typeof window !== 'undefined'
        ? `/api/congress-proxy?url=${encodeURIComponent(url)}`
        : url;

    const response = await fetch(fetchUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch registrants: ${response.statusText}`);
    }
    return response.json();
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:4020';

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

  try {
    const res = await fetch(`${API_BASE}/api/lobbying/clients?${searchParams}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch lobbying clients:', error);
    return null;
  }
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

  try {
    const res = await fetch(`${API_BASE}/api/lobbying/registrants?${searchParams}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch lobbying registrants:', error);
    return null;
  }
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

  try {
    const res = await fetch(`${API_BASE}/api/lobbying/lobbyists?${searchParams}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch lobbyists:', error);
    return null;
  }
}

export async function getFilingDetail(uuid: string): Promise<LobbyingFiling | null> {
  try {
    const res = await fetch(`${API_BASE}/api/lobbying/filings/${uuid}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch filing detail:', error);
    return null;
  }
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
  const searchParams = new URLSearchParams();
  if (params.year) searchParams.set('year', String(params.year));
  searchParams.set('page_size', String(params.page_size ?? 25));
  if (params.page) searchParams.set('page', String(params.page));

  try {
    const res = await fetch(`${API_BASE}/api/lobbying/contributions?${searchParams}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch lobbying contributions:', error);
    return null;
  }
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
    const res = await fetch(`${API_BASE}/api/lobbying/filings?${searchParams}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch lobbying filings:', error);
    return null;
  }
}

