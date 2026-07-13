CREATE INDEX IF NOT EXISTS idx_fec_canonical_indiv_cycle_date_nulls_last
    ON fec_canonical_individual_receipts (election_cycle, transaction_date DESC NULLS LAST, sub_id DESC);
CREATE INDEX IF NOT EXISTS idx_fec_canonical_comm_cycle_date_nulls_last
    ON fec_canonical_committee_receipts (election_cycle, transaction_date DESC NULLS LAST, sub_id DESC);
