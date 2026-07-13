-- FEC transaction files can reference committee IDs that are absent from the
-- current cycle committee-master snapshot. The transaction ID remains valid
-- provenance and must not make the complete cycle rebuild fail.

ALTER TABLE fec_candidate_committee_rankings
    DROP CONSTRAINT IF EXISTS fec_candidate_committee_rankings_committee_id_fkey;

ALTER TABLE fec_candidate_committee_rankings
    ADD COLUMN IF NOT EXISTS committee_resolution_status TEXT NOT NULL DEFAULT 'unresolved';

UPDATE fec_candidate_committee_rankings ranking
SET committee_resolution_status = CASE
    WHEN EXISTS (
        SELECT 1
        FROM fec_committees committee
        WHERE committee.committee_id = ranking.committee_id
    ) THEN 'resolved'
    ELSE 'unresolved'
END;

ALTER TABLE fec_candidate_committee_rankings
    DROP CONSTRAINT IF EXISTS fec_candidate_committee_rankings_resolution_status_check;

ALTER TABLE fec_candidate_committee_rankings
    ADD CONSTRAINT fec_candidate_committee_rankings_resolution_status_check
    CHECK (committee_resolution_status IN ('resolved', 'unresolved'));

CREATE INDEX IF NOT EXISTS idx_fec_comm_rankings_resolution
    ON fec_candidate_committee_rankings(election_cycle, committee_resolution_status);
