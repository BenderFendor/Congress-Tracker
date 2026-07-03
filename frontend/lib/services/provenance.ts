export type ProvenanceSummary = {
  sources: Array<{ source: string; status: string; fetched_at?: string | null; confidence?: string | null }>;
  warnings: string[];
};
