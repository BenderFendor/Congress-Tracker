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
  position: string;
};

type MemberVotesResponse = { votes: MemberVotePosition[] };

function mapMemberVote(position: MemberVotePosition): Vote {
  return {
    bill: {
      bill_id: position.vote_id,
      number: `${position.chamber} ${position.roll_number}`,
      title: position.question,
      latest_action: position.vote_date ?? "",
    },
    question: position.question,
    description: position.question,
    date: position.vote_date ?? "",
    time: "",
    result: "Recorded",
    position: position.position,
  };
}

export async function getMemberVotes(bioguideId: string, congress = 119): Promise<Vote[]> {
  const params = new URLSearchParams({ congress: String(congress), limit: "100" });
  const response = await fetch(
    `${BACKEND_URL}/api/members/${encodeURIComponent(bioguideId)}/votes?${params}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch member votes: ${response.status}`);
  }

  const data = (await response.json()) as MemberVotesResponse;
  return data.votes.map(mapMemberVote);
}
