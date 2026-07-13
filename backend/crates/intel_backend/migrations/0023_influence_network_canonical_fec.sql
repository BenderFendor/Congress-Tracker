-- Build influence-network member totals from canonical direct committee
-- receipts and the separate independent-expenditure source. Outside spending
-- remains distinct from money received by a campaign.

DROP MATERIALIZED VIEW IF EXISTS influence_network_member_mv;

CREATE MATERIALIZED VIEW influence_network_member_mv AS
WITH member_candidates AS (
    SELECT DISTINCT bioguide_id, value AS candidate_id
    FROM member_identifiers
    WHERE scheme = 'fec'
    UNION
    SELECT DISTINCT bioguide_id, candidate_id
    FROM fec_candidates
    WHERE bioguide_id IS NOT NULL
), direct_receipts AS (
    SELECT
        network.network_slug,
        member.bioguide_id,
        receipt.election_cycle AS cycle,
        SUM(receipt.amount) AS direct_amount
    FROM influence_network_committees network
    JOIN fec_canonical_committee_receipts receipt
      ON receipt.donor_committee_id = network.committee_id
     AND receipt.relationship_type = 'contribution'
     AND receipt.include_in_totals = true
     AND receipt.is_current = true
    JOIN fec_candidate_committees linkage
      ON linkage.committee_id = receipt.recipient_committee_id
     AND linkage.election_cycle = receipt.election_cycle
    JOIN member_candidates member ON member.candidate_id = linkage.candidate_id
    GROUP BY network.network_slug, member.bioguide_id, receipt.election_cycle
), outside_spending AS (
    SELECT
        network.network_slug,
        member.bioguide_id,
        expenditure.election_cycle AS cycle,
        SUM(expenditure.amount) FILTER (
            WHERE expenditure.support_oppose = 'S'
        ) AS support_ie_amount,
        SUM(expenditure.amount) FILTER (
            WHERE expenditure.support_oppose = 'O'
        ) AS oppose_ie_amount
    FROM influence_network_committees network
    JOIN fec_independent_expenditures expenditure
      ON expenditure.spender_id = network.committee_id
    JOIN member_candidates member ON member.candidate_id = expenditure.candidate_id
    GROUP BY network.network_slug, member.bioguide_id, expenditure.election_cycle
)
SELECT
    COALESCE(direct.network_slug, outside.network_slug) AS network_slug,
    COALESCE(direct.bioguide_id, outside.bioguide_id) AS bioguide_id,
    COALESCE(direct.cycle, outside.cycle) AS cycle,
    COALESCE(direct.direct_amount, 0) AS direct_amount,
    COALESCE(outside.support_ie_amount, 0) AS support_ie_amount,
    COALESCE(outside.oppose_ie_amount, 0) AS oppose_ie_amount
FROM direct_receipts direct
FULL OUTER JOIN outside_spending outside
  ON outside.network_slug = direct.network_slug
 AND outside.bioguide_id = direct.bioguide_id
 AND outside.cycle = direct.cycle;

CREATE UNIQUE INDEX influence_network_member_mv_pk
    ON influence_network_member_mv(network_slug, bioguide_id, cycle);
