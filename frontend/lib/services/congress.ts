import { fetchCongressMembers, CongressMember, PaginatedResponse } from '@/lib/api';

export interface Member {
    id: string;
    name: string;
    first_name: string;
    last_name: string;
    party: string;
    state: string;
    district: string;
    chamber: string;
    bio: string;
    url: string;
    in_office: boolean;
    next_election: string;
}

export async function getAllMembers(state?: string, district?: string): Promise<Member[]> {
    try {
        const response = await fetchCongressMembers(state, district);
        return response.data.map((m: CongressMember) => ({
            id: m.id,
            name: m.name,
            first_name: m.first_name,
            last_name: m.last_name,
            party: m.party,
            state: m.state,
            district: m.district,
            chamber: m.chamber,
            bio: m.bio,
            url: m.url,
            in_office: m.in_office,
            next_election: m.next_election
        }));
    } catch (error) {
        console.error("Error fetching Congress members:", error);
        return [];
    }
}

export async function getRecentMembers(limit = 50): Promise<Member[]> {
    const allMembers = await getAllMembers();
    return allMembers.slice(0, limit);
}

export async function getMembersByState(state: string): Promise<Member[]> {
    return getAllMembers(state);
}

export async function getMembersByDistrict(state: string, district: string): Promise<Member[]> {
    return getAllMembers(state, district);
}
