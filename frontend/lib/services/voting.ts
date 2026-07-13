import { BACKEND_URL } from "@/lib/constants";

export type Vote = {
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
};

type MemberVotePosition = {
  vote_id: string;
  chamber: string;
  roll_number: number;
  vote_date: string | null;
  question: string;
  description: string;
  result: string;
  bill_id: string | null;
  measure: {
    kind: "amendment" | "nomination" | "procedure" | "bill" | "other";
    identifier: string | null;
    label: string;
  };
  position: string;
};

export type MemberVoteSummary = {
  congress: number;
  total_votes: number;
  missed_votes: number;
  missed_vote_pct: number | null;
  party_line_votes: number;
  party_line_eligible_votes: number;
  party_line_pct: number | null;
  first_vote_date: string | null;
  last_vote_date: string | null;
};

export type MemberVotesResult = {
  votes: Vote[];
  summary: MemberVoteSummary | null;
  provenance: { sources: Array<{ source: string; status: string }>; warnings: string[] };
};

type MemberVotesResponse = Omit<MemberVotesResult, "votes"> & { votes: MemberVotePosition[] };

function mapMemberVote(position: MemberVotePosition): Vote {
  return {
    bill: {
      bill_id: position.bill_id ?? position.vote_id,
      number: position.measure.identifier ?? `${position.chamber} ${position.roll_number}`,
      title: position.measure.label,
      latest_action: position.vote_date ?? "",
    },
    question: position.question,
    description: position.description || position.question,
    date: position.vote_date ?? "",
    time: "",
    result: position.result || "Recorded",
    position: position.position,
  };
}

export async function getMemberVotes(bioguideId: string, congress = 119, signal?: AbortSignal): Promise<MemberVotesResult> {
  const params = new URLSearchParams({ congress: String(congress), limit: "100" });
  const response = await fetch(
    `${BACKEND_URL}/api/members/${encodeURIComponent(bioguideId)}/votes?${params}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch member votes: ${response.status}`);
  }

  const data = (await response.json()) as MemberVotesResponse;
  return { ...data, votes: data.votes.map(mapMemberVote) };
}
