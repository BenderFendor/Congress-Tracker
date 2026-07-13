-- Migration 0018: preserve cross-file FEC identity gaps without fake entities.

CREATE TABLE IF NOT EXISTS fec_linkage_issues (
    election_cycle INTEGER NOT NULL,
    candidate_id TEXT NOT NULL,
    committee_id TEXT NOT NULL,
    issue_type TEXT NOT NULL CHECK (issue_type IN ('candidate_missing', 'committee_missing')),
    source_run_id UUID REFERENCES source_runs(id),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    PRIMARY KEY (election_cycle, candidate_id, committee_id, issue_type)
);

CREATE INDEX IF NOT EXISTS idx_fec_linkage_issues_unresolved
    ON fec_linkage_issues(election_cycle, issue_type)
    WHERE resolved = false;
