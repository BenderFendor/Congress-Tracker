// lib/services/voting.ts
// Congressional voting records via Congress.gov API.
// Based on voting schemas from unitedstates/congress community project (CC0).

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:4020';

export interface VoteRecord {
  vote_id: string;
  chamber: string;
  congress: number;
  session: number;
  roll_call: number;
  question: string;
  description: string;
  vote_type: string;
  result: string;
  date: string;
  source_url: string;
  democratic: { yes: number; no: number; present: number; not_voting: number };
  republican: { yes: number; no: number; present: number; not_voting: number };
  total: { yes: number; no: number; present: number; not_voting: number };
  positions: Array<{
    member_name: string;
    bioguide_id: string;
    vote: string;
  }>;
}

export interface Vote {
  bill: {
    bill_id: string;
    number: string;
    title: string;
    latest_action: string;
  };
  question: string;
  description: string;
  date: string;
  time: string;
  result: string;
  position: string;
}

function mapVoteRecordToVote(record: VoteRecord, memberVote: string): Vote {
  return {
    bill: {
      bill_id: record.vote_id,
      number: record.vote_id,
      title: record.description,
      latest_action: record.date,
    },
    question: record.question,
    description: record.description,
    date: record.date,
    time: "",
    result: record.result,
    position: memberVote,
  };
}

export async function getRecentVotes(chamber?: 'house' | 'senate'): Promise<VoteRecord[]> {
  const params = new URLSearchParams();
  if (chamber) params.set('chamber', chamber);
  params.set('limit', '20');

  try {
    const res = await fetch(`${API_BASE}/api/congress/votes?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.votes || [];
  } catch (error) {
    console.error('Failed to fetch votes:', error);
    return [];
  }
}

export async function getMemberVotes(bioguideId: string): Promise<Vote[]> {
  try {
    const allVotes = await getRecentVotes();
    const memberVotes: Vote[] = [];

    for (const record of allVotes) {
      const position = record.positions?.find(p => p.bioguide_id === bioguideId);
      if (position) {
        memberVotes.push(mapVoteRecordToVote(record, position.vote));
      }
    }

    return memberVotes;
  } catch (error) {
    console.error('Failed to fetch member votes:', error);
    return [];
  }
}

export async function getVotesOnTopic(topic: string): Promise<Vote[]> {
  try {
    const allVotes = await getRecentVotes();
    const topicLower = topic.toLowerCase();
    const filtered = allVotes.filter(v =>
      v.question?.toLowerCase().includes(topicLower) ||
      v.description?.toLowerCase().includes(topicLower)
    );

    return filtered.map(v => mapVoteRecordToVote(v, ""));
  } catch (error) {
    console.error('Failed to fetch votes on topic:', error);
    return [];
  }
}
