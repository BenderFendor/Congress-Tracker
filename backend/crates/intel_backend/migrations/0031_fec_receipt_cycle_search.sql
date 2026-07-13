-- Let filtered receipt search constrain cycle and contributor in one index scan.

CREATE EXTENSION IF NOT EXISTS btree_gin;

CREATE INDEX IF NOT EXISTS idx_fec_canonical_indiv_cycle_contributor_trgm
    ON fec_canonical_individual_receipts
    USING GIN (election_cycle, contributor_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_fec_canonical_comm_donor_cycle
    ON fec_canonical_committee_receipts
       (donor_committee_id, election_cycle, transaction_date DESC);
