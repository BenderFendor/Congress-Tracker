-- Precompute exact all-row campaign-finance totals and small sector rankings.
-- Interactive visualization requests must not scan multi-million-row FEC files.

CREATE TABLE IF NOT EXISTS fec_campaign_finance_cycle_summaries (
    election_cycle                 INTEGER PRIMARY KEY,
    total_receipts                 NUMERIC NOT NULL,
    total_disbursements            NUMERIC NOT NULL,
    independent_supporting         NUMERIC NOT NULL,
    independent_opposing           NUMERIC NOT NULL,
    committee_count                BIGINT NOT NULL,
    receipt_count                  BIGINT NOT NULL,
    disbursement_count             BIGINT NOT NULL,
    independent_expenditure_count  BIGINT NOT NULL,
    refreshed_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fec_campaign_finance_sector_summaries (
    election_cycle   INTEGER NOT NULL,
    sector           TEXT NOT NULL,
    total_receipts   NUMERIC NOT NULL,
    committee_count  BIGINT NOT NULL,
    refreshed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (election_cycle, sector)
);

CREATE OR REPLACE FUNCTION refresh_fec_campaign_finance_summary(p_cycle INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO fec_campaign_finance_cycle_summaries (
        election_cycle, total_receipts, total_disbursements,
        independent_supporting, independent_opposing, committee_count,
        receipt_count, disbursement_count, independent_expenditure_count,
        refreshed_at
    )
    SELECT p_cycle,
        COALESCE((SELECT SUM(amount) FROM fec_canonical_individual_receipts
                  WHERE election_cycle = p_cycle AND is_current AND include_in_totals), 0)
        + COALESCE((SELECT SUM(amount) FROM fec_canonical_committee_receipts
                    WHERE election_cycle = p_cycle AND is_current AND include_in_totals), 0),
        COALESCE((SELECT SUM(amount) FROM fec_canonical_operating_disbursements
                  WHERE election_cycle = p_cycle), 0),
        COALESCE((SELECT SUM(amount) FROM fec_independent_expenditures
                  WHERE election_cycle = p_cycle AND support_oppose = 'S'), 0),
        COALESCE((SELECT SUM(amount) FROM fec_independent_expenditures
                  WHERE election_cycle = p_cycle AND support_oppose = 'O'), 0),
        (SELECT COUNT(DISTINCT committee_id) FROM (
            SELECT committee_id FROM fec_canonical_individual_receipts
            WHERE election_cycle = p_cycle AND is_current AND include_in_totals
            UNION
            SELECT recipient_committee_id FROM fec_canonical_committee_receipts
            WHERE election_cycle = p_cycle AND is_current AND include_in_totals
            UNION
            SELECT committee_id FROM fec_canonical_operating_disbursements
            WHERE election_cycle = p_cycle
        ) direct_committees),
        (SELECT COUNT(*) FROM fec_canonical_individual_receipts
         WHERE election_cycle = p_cycle AND is_current AND include_in_totals)
        + (SELECT COUNT(*) FROM fec_canonical_committee_receipts
           WHERE election_cycle = p_cycle AND is_current AND include_in_totals),
        (SELECT COUNT(*) FROM fec_canonical_operating_disbursements
         WHERE election_cycle = p_cycle),
        (SELECT COUNT(*) FROM fec_independent_expenditures
         WHERE election_cycle = p_cycle),
        now()
    ON CONFLICT (election_cycle) DO UPDATE SET
        total_receipts = EXCLUDED.total_receipts,
        total_disbursements = EXCLUDED.total_disbursements,
        independent_supporting = EXCLUDED.independent_supporting,
        independent_opposing = EXCLUDED.independent_opposing,
        committee_count = EXCLUDED.committee_count,
        receipt_count = EXCLUDED.receipt_count,
        disbursement_count = EXCLUDED.disbursement_count,
        independent_expenditure_count = EXCLUDED.independent_expenditure_count,
        refreshed_at = EXCLUDED.refreshed_at;

    DELETE FROM fec_campaign_finance_sector_summaries
    WHERE election_cycle = p_cycle;

    INSERT INTO fec_campaign_finance_sector_summaries (
        election_cycle, sector, total_receipts, committee_count, refreshed_at
    )
    WITH canonical_receipts AS (
        SELECT committee_id, amount FROM fec_canonical_individual_receipts
        WHERE election_cycle = p_cycle AND is_current AND include_in_totals
        UNION ALL
        SELECT recipient_committee_id, amount FROM fec_canonical_committee_receipts
        WHERE election_cycle = p_cycle AND is_current AND include_in_totals
    )
    SELECT p_cycle, COALESCE(committees.committee_type_full, 'Unclassified'),
           SUM(receipts.amount), COUNT(DISTINCT receipts.committee_id), now()
    FROM canonical_receipts receipts
    LEFT JOIN fec_committees committees
      ON committees.committee_id = receipts.committee_id
    GROUP BY COALESCE(committees.committee_type_full, 'Unclassified');
END;
$$;

-- Backfill all existing cycles in set-based passes. Calling the per-cycle
-- refresh function in a loop would repeat large sequential scans once per
-- cycle during deployment.
WITH individual AS (
    SELECT election_cycle, SUM(amount) AS amount, COUNT(*) AS row_count
    FROM fec_canonical_individual_receipts
    WHERE is_current AND include_in_totals GROUP BY election_cycle
), committee AS (
    SELECT election_cycle, SUM(amount) AS amount, COUNT(*) AS row_count
    FROM fec_canonical_committee_receipts
    WHERE is_current AND include_in_totals GROUP BY election_cycle
), disbursement AS (
    SELECT election_cycle, SUM(amount) AS amount, COUNT(*) AS row_count
    FROM fec_canonical_operating_disbursements GROUP BY election_cycle
), independent AS (
    SELECT election_cycle,
           SUM(amount) FILTER (WHERE support_oppose = 'S') AS supporting,
           SUM(amount) FILTER (WHERE support_oppose = 'O') AS opposing,
           COUNT(*) AS row_count
    FROM fec_independent_expenditures GROUP BY election_cycle
), direct_committees AS (
    SELECT election_cycle, COUNT(DISTINCT committee_id) AS committee_count
    FROM (
        SELECT election_cycle, committee_id FROM fec_canonical_individual_receipts
        WHERE is_current AND include_in_totals
        UNION ALL
        SELECT election_cycle, recipient_committee_id FROM fec_canonical_committee_receipts
        WHERE is_current AND include_in_totals
        UNION ALL
        SELECT election_cycle, committee_id FROM fec_canonical_operating_disbursements
    ) ids GROUP BY election_cycle
), cycles AS (
    SELECT election_cycle FROM individual UNION SELECT election_cycle FROM committee
    UNION SELECT election_cycle FROM disbursement UNION SELECT election_cycle FROM independent
)
INSERT INTO fec_campaign_finance_cycle_summaries (
    election_cycle, total_receipts, total_disbursements,
    independent_supporting, independent_opposing, committee_count,
    receipt_count, disbursement_count, independent_expenditure_count
)
SELECT cycles.election_cycle,
       COALESCE(individual.amount, 0) + COALESCE(committee.amount, 0),
       COALESCE(disbursement.amount, 0), COALESCE(independent.supporting, 0),
       COALESCE(independent.opposing, 0), COALESCE(direct_committees.committee_count, 0),
       COALESCE(individual.row_count, 0) + COALESCE(committee.row_count, 0),
       COALESCE(disbursement.row_count, 0), COALESCE(independent.row_count, 0)
FROM cycles
LEFT JOIN individual USING (election_cycle)
LEFT JOIN committee USING (election_cycle)
LEFT JOIN disbursement USING (election_cycle)
LEFT JOIN independent USING (election_cycle)
LEFT JOIN direct_committees USING (election_cycle);

INSERT INTO fec_campaign_finance_sector_summaries (
    election_cycle, sector, total_receipts, committee_count
)
WITH canonical_receipts AS (
    SELECT election_cycle, committee_id, amount FROM fec_canonical_individual_receipts
    WHERE is_current AND include_in_totals
    UNION ALL
    SELECT election_cycle, recipient_committee_id, amount FROM fec_canonical_committee_receipts
    WHERE is_current AND include_in_totals
)
SELECT receipts.election_cycle,
       COALESCE(committees.committee_type_full, 'Unclassified'),
       SUM(receipts.amount), COUNT(DISTINCT receipts.committee_id)
FROM canonical_receipts receipts
LEFT JOIN fec_committees committees ON committees.committee_id = receipts.committee_id
GROUP BY receipts.election_cycle,
         COALESCE(committees.committee_type_full, 'Unclassified');
