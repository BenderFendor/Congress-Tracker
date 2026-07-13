-- Preserve the candidate-master principal committee and allow deterministic
-- current-member identity repair from official candidate records.

ALTER TABLE fec_candidates
    ADD COLUMN IF NOT EXISTS principal_committee_id TEXT;

CREATE INDEX IF NOT EXISTS idx_fec_candidates_principal_committee
    ON fec_candidates(principal_committee_id, active_through);

ALTER TABLE fec_linkage_issues
    DROP CONSTRAINT IF EXISTS fec_linkage_issues_issue_type_check;
ALTER TABLE fec_linkage_issues
    ADD CONSTRAINT fec_linkage_issues_issue_type_check
    CHECK (issue_type IN (
        'candidate_missing',
        'committee_missing',
        'principal_committee_missing'
    ));
