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

// Without ProPublica (retired) or LegiScan (commercial/freemium), 
// member roll call votes require building a local database mapped to Congress.gov XML data.
// Returning empty arrays as placeholders for now to maintain application stability without using paid APIs.
export async function getMemberVotes(memberId: string): Promise<Vote[]> {
    return [];
}

export async function getVotesOnTopic(topic: string): Promise<Vote[]> {
    return [];
}