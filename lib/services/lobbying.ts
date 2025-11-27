
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
