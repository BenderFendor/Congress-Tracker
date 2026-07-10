import { BACKEND_URL } from "@/lib/constants";

export interface FECandidate {
    candidate_id: string;
    name: string;
    party?: string;
    state?: string;
    district?: string;
    office_sought?: string;
    incumbent?: boolean;
    status?: "incumbent" | "challenger" | "open" | "primary" | "unknown";
    committee_id?: string;
    committee_name?: string;
}

export interface FECReceipt {
    committee_id: string;
    committee_name: string;
    contributor_name: string;
    contribution_date: string;
    amount: number;
    employer?: string;
    occupation?: string;
}

export async function getAllCandidates(name?: string, state?: string, cycle?: number): Promise<FECandidate[]> {
    const params = new URLSearchParams();
    if (name) params.set("name", name);
    if (state) params.set("state", state);
    if (cycle) params.set("cycle", String(cycle));
    const response = await fetch(`${BACKEND_URL}/api/elections/candidates?${params}`);
    if (!response.ok) throw new Error(`Failed to fetch candidates: ${response.status} ${response.statusText}`);
    const candidates = await response.json();
    return candidates.map((c: Record<string, unknown>) => {
        const challenge = String(c.incumbent_challenge ?? "").toUpperCase();
        const status = challenge === "I" || challenge === "INCUMBENT"
            ? "incumbent"
            : challenge === "C" || challenge === "CHALLENGER"
                ? "challenger"
                : challenge === "O" || challenge === "OPEN"
                    ? "open"
                    : challenge === "P" || challenge === "PRIMARY"
                        ? "primary"
                        : "unknown";
        return {
        candidate_id: String(c.candidate_id),
        name: formatFecName(String(c.name)),
        party: c.party ? String(c.party) : undefined,
        state: c.state ? String(c.state) : undefined,
        district: c.district ? String(c.district) : undefined,
        office_sought: c.office ? String(c.office) : undefined,
        incumbent: status === "incumbent",
        status,
        };
    });
}

function formatFecName(value: string): string {
    const [left, ...right] = value.split(",").map((part) => part.trim()).filter(Boolean);
    const source = right.length > 0 && /\d/.test(left) ? right.join(" ") : right.length > 0 ? `${right.join(" ")} ${left}` : value;
    return source
        .toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase())
        .replace(/\bJr\b/g, "Jr.")
        .replace(/\bSr\b/g, "Sr.")
        .trim();
}

export async function getAllReceipts(committeeId?: string): Promise<FECReceipt[]> {
    void committeeId;
    throw new Error("FEC receipts endpoint is not implemented in the canonical backend yet.");
}

export async function getRecentCandidates(limit = 50, name?: string, state?: string, cycle?: number): Promise<FECandidate[]> {
    const allCandidates = await getAllCandidates(name, state, cycle);
    return allCandidates.slice(0, limit);
}

export async function getCandidatesByState(state: string, cycle?: number): Promise<FECandidate[]> {
    return getAllCandidates(undefined, state, cycle);
}

export async function getCandidatesByName(name: string): Promise<FECandidate[]> {
    return getAllCandidates(name);
}

export interface FECCommittee {
    committee_id: string;
    committee_name: string;
    committee_type?: string;
    party?: string;
    state?: string;
    designation?: string;
    organization_type?: string;
    candidate_id?: string;
}

export async function getCommittees(): Promise<FECCommittee[]> {
    const res = await fetch(`${BACKEND_URL}/api/intel/fec/committees`);
    if (!res.ok) throw new Error(`Failed to fetch FEC committees: ${res.status} ${res.statusText}`);
    return res.json();
}
