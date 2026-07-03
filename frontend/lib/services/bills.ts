import { BACKEND_URL } from "@/lib/constants";
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
    funding_overlay?: {
        total_sponsor_receipts: number;
        top_influence_networks: Array<{
            network_slug: string;
            display_name: string;
            total_amount: number;
        }>;
        data_quality: "complete" | "partial" | "missing_crosswalk";
    };
    lobbying_overlay?: Array<{
        issue_code: string;
        issue_display: string;
        description: string;
        confidence: string;
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

export async function getBillIntel(congress: number, billType: string, billNumber: number): Promise<BillIntel | null> {
    try {
        const response = await fetch(
            `${BACKEND_URL}/api/bills/${congress}/${billType.toLowerCase()}/${billNumber}/intel`
        );
        if (!response.ok) throw new Error(`Failed to fetch bill intel: ${response.status} ${response.statusText}`);
        return response.json();
    } catch (error) {
        throw error;
    }
}
