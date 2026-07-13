import { BACKEND_URL } from "@/lib/constants";
import { DetailRequestError, classifyDetailResponse } from "@/lib/detail-request-state.mjs";
import type { ProvenanceSummary } from "./provenance";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface Bill {
    id: string;
    title: string;
    status: string;
    date: string;
    url: string;
}

export type BillIntel = {
    bill: {
        congress: number;
        bill_type: string;
        bill_number: number;
        bill_id: string;
        title: string;
        introduced_date?: string;
        origin_chamber?: string;
        policy_area?: string;
        latest_action_date?: string;
        latest_action_text?: string;
        status: string;
        url?: string;
    };
    actions: Array<{
        action_date: string;
        action_text: string;
        action_type?: string;
        chamber?: string;
    }>;
    sponsors: Array<{
        bioguide_id: string;
        first_name: string;
        last_name: string;
        party?: string;
        state?: string;
        sponsor_type: string;
        sponsorship_date?: string;
    }>;
    cosponsors: Array<{
        bioguide_id: string;
        first_name: string;
        last_name: string;
        party?: string;
        state?: string;
        sponsorship_date?: string;
    }>;
    subjects?: string[];
    committees?: Array<{
        committee_id: string;
        name: string;
        chamber: string;
    }>;
    amendments: Array<{
        amendment_number?: string;
        amendment_type?: string;
        description?: string;
        sponsor_name?: string;
        introduced_date?: string;
        latest_action_date?: string;
        latest_action_text?: string;
        chamber?: string;
        status: string;
    }>;
    funding_overlay?: Array<{
        bioguide_id: string;
        name: string;
        total_receipts: number;
        top_networks: Array<{
            network_slug: string;
            amount: number;
            confidence: string;
        }>;
        data_quality: "complete" | "missing_crosswalk";
    }>;
    lobbying_overlay?: Array<{
        issue_code: string;
        issue_display: string;
        description: string;
        confidence: string;
    }>;
    lobbying_bill_links: Array<{
        filing_uuid: string;
        registrant_name: string;
        client_name: string;
        matched_bill_text?: string;
        confidence: "direct";
    }>;
    provenance?: ProvenanceSummary;
};

// ---------------------------------------------------------------------------
// Bill type constants
// ---------------------------------------------------------------------------

export const BILL_TYPES = ["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"] as const;
export type BillType = (typeof BILL_TYPES)[number];

export const BILL_TYPE_LABELS: Record<BillType, string> = {
    hr: "House Bill (HR)",
    s: "Senate Bill (S)",
    hjres: "House Joint Resolution (HJRes)",
    sjres: "Senate Joint Resolution (SJRes)",
    hconres: "House Concurrent Resolution (HConRes)",
    sconres: "Senate Concurrent Resolution (SConRes)",
    hres: "House Simple Resolution (HRes)",
    sres: "Senate Simple Resolution (SRes)",
};

// ---------------------------------------------------------------------------
// Query filters
// ---------------------------------------------------------------------------

export interface BillFilters {
    congress?: number;
    billType?: BillType;
    search?: string;
    limit?: number;
    offset?: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getRecentBills(limit = 10): Promise<Bill[]> {
    const response = await fetch(`${BACKEND_URL}/api/bills?limit=${limit}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch recent bills: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return (data.bills ?? []).map((bill: Record<string, unknown>) => ({
        id: String(bill.bill_id || ""),
        title: String(bill.title || ""),
        status: String(bill.status || bill.latest_action_text || "N/A"),
        date: String(bill.latest_action_date || bill.introduced_date || ""),
        url: String(bill.url || ""),
    }));
}

export async function getBillIntel(congress: number, billType: string, billNumber: number, signal?: AbortSignal): Promise<BillIntel | null> {
    let response: Response;
    try {
        response = await fetch(
            `${BACKEND_URL}/api/bills/${congress}/${billType.toLowerCase()}/${billNumber}/intel`,
            { signal }
        );
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new DetailRequestError("Bill detail", null, "");
    }

    const responseState = classifyDetailResponse(response.status);
    if (responseState === "not_found") return null;
    if (responseState === "error") {
        throw new DetailRequestError("Bill detail", response.status, response.statusText);
    }
    return response.json();
}
