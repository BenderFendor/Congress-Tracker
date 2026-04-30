import { fetchCandidates, fetchReceipts, Candidate, Receipt } from '@/lib/api';

export interface FECandidate {
    candidate_id: string;
    name: string;
    party?: string;
    state?: string;
    district?: string;
    office_sought?: string;
    incumbent?: boolean;
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

export async function getAllCandidates(name?: string, state?: string): Promise<FECandidate[]> {
    try {
        const response = await fetchCandidates(name, state);
        return response.data.map((c: Candidate) => ({
            candidate_id: c.candidate_id,
            name: c.name,
            party: c.party,
            state: c.state,
            district: c.district,
            office_sought: c.office_sought,
            incumbent: c.incumbent,
            committee_id: c.committee_id,
            committee_name: c.committee_name
        }));
    } catch (error) {
        console.error("Error fetching candidates:", error);
        return [];
    }
}

export async function getAllReceipts(committeeId?: string): Promise<FECReceipt[]> {
    try {
        const response = await fetchReceipts(committeeId);
        return response.data.map((r: Receipt) => ({
            committee_id: r.committee_id,
            committee_name: r.committee_name,
            contributor_name: r.contributor_name,
            contribution_date: r.contribution_date,
            amount: r.amount,
            employer: r.employer,
            occupation: r.occupation
        }));
    } catch (error) {
        console.error("Error fetching receipts:", error);
        return [];
    }
}

export async function getRecentCandidates(limit = 50, name?: string, state?: string): Promise<FECandidate[]> {
    const allCandidates = await getAllCandidates(name, state);
    return allCandidates.slice(0, limit);
}

export async function getCandidatesByState(state: string): Promise<FECandidate[]> {
    return getAllCandidates(undefined, state);
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

import { BACKEND_URL } from "@/lib/constants";

export async function getCommittees(): Promise<FECCommittee[]> {
    try {
        const res = await fetch(`${BACKEND_URL}/api/fec/committees`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.committees || [];
    } catch (error) {
        console.error('Failed to fetch FEC committees:', error);
        return [];
    }
}
