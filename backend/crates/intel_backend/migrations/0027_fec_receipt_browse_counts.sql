CREATE TABLE IF NOT EXISTS fec_receipt_cycle_counts (
    election_cycle       INTEGER PRIMARY KEY,
    individual_count     BIGINT NOT NULL,
    committee_count      BIGINT NOT NULL,
    refreshed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fec_canonical_indiv_cycle_date
    ON fec_canonical_individual_receipts (election_cycle, transaction_date DESC, sub_id DESC);
CREATE INDEX IF NOT EXISTS idx_fec_canonical_comm_cycle_date
    ON fec_canonical_committee_receipts (election_cycle, transaction_date DESC, sub_id DESC);

INSERT INTO fec_receipt_cycle_counts (election_cycle, individual_count, committee_count)
SELECT cycles.election_cycle,
       (SELECT COUNT(*) FROM fec_canonical_individual_receipts i WHERE i.election_cycle = cycles.election_cycle),
       (SELECT COUNT(*) FROM fec_canonical_committee_receipts c WHERE c.election_cycle = cycles.election_cycle)
  FROM (SELECT DISTINCT election_cycle FROM fec_canonical_individual_receipts
        UNION SELECT DISTINCT election_cycle FROM fec_canonical_committee_receipts) cycles
ON CONFLICT (election_cycle) DO UPDATE
SET individual_count = EXCLUDED.individual_count,
    committee_count = EXCLUDED.committee_count,
    refreshed_at = now();
