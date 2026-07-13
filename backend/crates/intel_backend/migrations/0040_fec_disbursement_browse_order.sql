-- Match the public Schedule B browse order exactly. PostgreSQL descending
-- indexes default to NULLS FIRST, which forced a multi-million-row sort for
-- the UI's DESC NULLS LAST order.

CREATE INDEX IF NOT EXISTS idx_fec_disbursements_cycle_date_nulls_last
ON fec_canonical_operating_disbursements (
    election_cycle,
    transaction_date DESC NULLS LAST,
    sub_id DESC
);
