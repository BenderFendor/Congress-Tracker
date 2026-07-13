use crate::models::{InfluenceNetwork, InfluenceNetworkCommittee};
use crate::repository::Repository;

pub struct InfluenceNetworkUpsert<'a> {
    pub network_slug: &'a str,
    pub display_name: &'a str,
    pub aliases: &'a [&'a str],
    pub description: &'a str,
    pub category: &'a str,
    pub confidence: &'a str,
    pub source_citation: &'a str,
    pub source_run_id: Option<uuid::Uuid>,
}

pub struct InfluenceNetworkCommitteeUpsert<'a> {
    pub network_slug: &'a str,
    pub committee_id: &'a str,
    pub committee_name: &'a str,
    pub role: &'a str,
    pub confidence: &'a str,
    pub source_citation: &'a str,
    pub source_run_id: Option<uuid::Uuid>,
}

impl Repository {
    /// Upsert an influence network definition.
    pub async fn upsert_influence_network(
        &self,
        input: InfluenceNetworkUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO influence_networks
               (network_slug, display_name, aliases, description, category, confidence, source_citation, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6::confidence_level, $7, $8)
               ON CONFLICT (network_slug) DO UPDATE SET
                 display_name    = EXCLUDED.display_name,
                 aliases         = EXCLUDED.aliases,
                 description     = EXCLUDED.description,
                 category        = EXCLUDED.category,
                 confidence      = EXCLUDED.confidence,
                 source_citation = EXCLUDED.source_citation"#,
        )
        .bind(input.network_slug)
        .bind(input.display_name)
        .bind(input.aliases)
        .bind(input.description)
        .bind(input.category)
        .bind(input.confidence)
        .bind(input.source_citation)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Upsert a committee-to-influence-network mapping.
    pub async fn upsert_influence_network_committee(
        &self,
        input: InfluenceNetworkCommitteeUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO influence_network_committees
               (network_slug, committee_id, committee_name, role, confidence, source_citation, source_run_id)
               VALUES ($1, $2, $3, $4::influence_committee_role, $5::confidence_level, $6, $7)
               ON CONFLICT (network_slug, committee_id)
               DO UPDATE SET
                 committee_name  = EXCLUDED.committee_name,
                 role            = EXCLUDED.role,
                 confidence      = EXCLUDED.confidence,
                 source_citation = EXCLUDED.source_citation"#,
        )
        .bind(input.network_slug)
        .bind(input.committee_id)
        .bind(input.committee_name)
        .bind(input.role)
        .bind(input.confidence)
        .bind(input.source_citation)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Fetch a complete influence network with its committees.
    pub async fn get_influence_network(
        &self,
        network_slug: &str,
    ) -> Result<Option<InfluenceNetwork>, sqlx::Error> {
        let row: Option<NetRow> = sqlx::query_as::<_, NetRow>(
            r#"SELECT network_slug, display_name, aliases, description, category, confidence::text AS confidence, source_citation
               FROM influence_networks
               WHERE network_slug = $1"#,
        )
        .bind(network_slug)
        .fetch_optional(self.pool())
        .await?;

        let net = match row {
            Some(r) => r,
            None => return Ok(None),
        };

        let committee_rows: Vec<NetCommRow> = sqlx::query_as::<_, NetCommRow>(
            r#"SELECT committee_id, committee_name, role::text AS role, confidence::text AS confidence, source_citation
               FROM influence_network_committees
               WHERE network_slug = $1
               ORDER BY committee_name"#,
        )
        .bind(network_slug)
        .fetch_all(self.pool())
        .await?;

        let committees: Vec<InfluenceNetworkCommittee> = committee_rows
            .into_iter()
            .map(|c| InfluenceNetworkCommittee {
                committee_id: c.committee_id,
                committee_name: c.committee_name,
                role: c.role,
                confidence: c.confidence,
                source_citation: c.source_citation,
            })
            .collect();

        Ok(Some(InfluenceNetwork {
            network_slug: net.network_slug,
            display_name: net.display_name,
            aliases: net.aliases,
            description: net.description,
            category: net.category,
            confidence: net.confidence,
            source_citation: net.source_citation,
            committees,
        }))
    }

    /// List all influence networks with their committees.
    pub async fn list_influence_networks(&self) -> Result<Vec<InfluenceNetwork>, sqlx::Error> {
        let net_rows: Vec<NetRow> = sqlx::query_as::<_, NetRow>(
            r#"SELECT network_slug, display_name, aliases, description, category, confidence::text AS confidence, source_citation
               FROM influence_networks
               ORDER BY display_name"#,
        )
        .fetch_all(self.pool())
        .await?;

        let mut results = Vec::with_capacity(net_rows.len());
        for nr in net_rows {
            let committee_rows: Vec<NetCommRow> = sqlx::query_as::<_, NetCommRow>(
                r#"SELECT committee_id, committee_name, role::text AS role, confidence::text AS confidence, source_citation
                   FROM influence_network_committees
                   WHERE network_slug = $1
                   ORDER BY committee_name"#,
            )
            .bind(&nr.network_slug)
            .fetch_all(self.pool())
            .await?;

            let committees: Vec<InfluenceNetworkCommittee> = committee_rows
                .into_iter()
                .map(|c| InfluenceNetworkCommittee {
                    committee_id: c.committee_id,
                    committee_name: c.committee_name,
                    role: c.role,
                    confidence: c.confidence,
                    source_citation: c.source_citation,
                })
                .collect();

            results.push(InfluenceNetwork {
                network_slug: nr.network_slug,
                display_name: nr.display_name,
                aliases: nr.aliases,
                description: nr.description,
                category: nr.category,
                confidence: nr.confidence,
                source_citation: nr.source_citation,
                committees,
            });
        }

        Ok(results)
    }

    /// Get aggregated financial data for an influence network in a given election cycle.
    pub async fn get_influence_network_financials(
        &self,
        network_slug: &str,
        cycle: i32,
    ) -> Result<Option<crate::models::InfluenceNetworkFinancials>, sqlx::Error> {
        use crate::models::{CommitteeFinancial, InfluenceNetworkFinancials, RecipientMember};
        use std::collections::BTreeMap;

        // Check that the network exists
        let net_exists: Option<(String,)> =
            sqlx::query_as("SELECT network_slug FROM influence_networks WHERE network_slug = $1")
                .bind(network_slug)
                .fetch_optional(self.pool())
                .await?;

        if net_exists.is_none() {
            return Ok(None);
        }

        // The member materialized view intentionally aggregates at network level,
        // so it cannot produce committee-specific totals. Build one canonical
        // committee/member rowset and derive every response aggregate from it.
        #[derive(sqlx::FromRow)]
        struct CommitteeMemberFinancialRow {
            committee_id: String,
            committee_name: String,
            role: String,
            bioguide_id: Option<String>,
            first_name: Option<String>,
            last_name: Option<String>,
            party: Option<String>,
            chamber: Option<String>,
            state: Option<String>,
            direct_amount: f64,
            support_ie_amount: f64,
            oppose_ie_amount: f64,
        }

        let rows: Vec<CommitteeMemberFinancialRow> = sqlx::query_as(
            r#"WITH member_candidates AS (
                   SELECT DISTINCT bioguide_id, value AS candidate_id
                   FROM member_identifiers
                   WHERE scheme = 'fec'
                   UNION
                   SELECT DISTINCT bioguide_id, candidate_id
                   FROM fec_candidates
                   WHERE bioguide_id IS NOT NULL
               ), direct_receipts AS (
                   SELECT network.network_slug,
                          network.committee_id,
                          member.bioguide_id,
                          receipt.election_cycle AS cycle,
                          SUM(receipt.amount)::double precision AS direct_amount
                   FROM influence_network_committees network
                   JOIN fec_canonical_committee_receipts receipt
                     ON receipt.donor_committee_id = network.committee_id
                    AND receipt.relationship_type = 'contribution'
                    AND receipt.include_in_totals = true
                    AND receipt.is_current = true
                   JOIN fec_candidate_committees linkage
                     ON linkage.committee_id = receipt.recipient_committee_id
                    AND linkage.election_cycle = receipt.election_cycle
                   JOIN member_candidates member
                     ON member.candidate_id = linkage.candidate_id
                   WHERE network.network_slug = $1
                     AND receipt.election_cycle = $2
                   GROUP BY network.network_slug, network.committee_id,
                            member.bioguide_id, receipt.election_cycle
               ), outside_spending AS (
                   SELECT network.network_slug,
                          network.committee_id,
                          member.bioguide_id,
                          expenditure.election_cycle AS cycle,
                          COALESCE(SUM(expenditure.amount) FILTER (
                              WHERE expenditure.support_oppose = 'S'
                          ), 0)::double precision AS support_ie_amount,
                          COALESCE(SUM(expenditure.amount) FILTER (
                              WHERE expenditure.support_oppose = 'O'
                          ), 0)::double precision AS oppose_ie_amount
                   FROM influence_network_committees network
                   JOIN fec_independent_expenditures expenditure
                     ON expenditure.spender_id = network.committee_id
                   JOIN member_candidates member
                     ON member.candidate_id = expenditure.candidate_id
                   WHERE network.network_slug = $1
                     AND expenditure.election_cycle = $2
                   GROUP BY network.network_slug, network.committee_id,
                            member.bioguide_id, expenditure.election_cycle
               ), committee_member_amounts AS (
                   SELECT COALESCE(direct.network_slug, outside.network_slug) AS network_slug,
                          COALESCE(direct.committee_id, outside.committee_id) AS committee_id,
                          COALESCE(direct.bioguide_id, outside.bioguide_id) AS bioguide_id,
                          COALESCE(direct.cycle, outside.cycle) AS cycle,
                          COALESCE(direct.direct_amount, 0)::double precision AS direct_amount,
                          COALESCE(outside.support_ie_amount, 0)::double precision AS support_ie_amount,
                          COALESCE(outside.oppose_ie_amount, 0)::double precision AS oppose_ie_amount
                   FROM direct_receipts direct
                   FULL OUTER JOIN outside_spending outside
                     ON outside.network_slug = direct.network_slug
                    AND outside.committee_id = direct.committee_id
                    AND outside.bioguide_id = direct.bioguide_id
                    AND outside.cycle = direct.cycle
               )
               SELECT network.committee_id,
                      network.committee_name,
                      network.role::text AS role,
                      amounts.bioguide_id,
                      member.first_name,
                      member.last_name,
                      member.current_party AS party,
                      member.current_chamber AS chamber,
                      member.current_state AS state,
                      COALESCE(amounts.direct_amount, 0)::double precision AS direct_amount,
                      COALESCE(amounts.support_ie_amount, 0)::double precision AS support_ie_amount,
                      COALESCE(amounts.oppose_ie_amount, 0)::double precision AS oppose_ie_amount
               FROM influence_network_committees network
               LEFT JOIN committee_member_amounts amounts
                 ON amounts.network_slug = network.network_slug
                AND amounts.committee_id = network.committee_id
                AND amounts.cycle = $2
               LEFT JOIN members member ON member.bioguide_id = amounts.bioguide_id
               WHERE network.network_slug = $1
               ORDER BY network.committee_id, amounts.bioguide_id"#,
        )
        .bind(network_slug)
        .bind(cycle)
        .fetch_all(self.pool())
        .await?;

        struct RecipientAccumulator {
            first_name: String,
            last_name: String,
            party: String,
            chamber: String,
            state: String,
            direct_contributions: f64,
            independent_supporting: f64,
            independent_opposing: f64,
        }

        let mut committee_totals = BTreeMap::<String, CommitteeFinancial>::new();
        let mut recipient_totals = BTreeMap::<String, RecipientAccumulator>::new();
        for row in rows {
            let committee = committee_totals
                .entry(row.committee_id.clone())
                .or_insert_with(|| CommitteeFinancial {
                    committee_id: row.committee_id,
                    committee_name: row.committee_name,
                    role: row.role,
                    direct_contributions: 0.0,
                    independent_supporting: 0.0,
                    independent_opposing: 0.0,
                    total: 0.0,
                });
            committee.direct_contributions += row.direct_amount;
            committee.independent_supporting += row.support_ie_amount;
            committee.independent_opposing += row.oppose_ie_amount;
            committee.total = committee.direct_contributions
                + committee.independent_supporting
                + committee.independent_opposing;

            let Some(bioguide_id) = row.bioguide_id else {
                continue;
            };
            let metadata = (
                row.first_name,
                row.last_name,
                row.party,
                row.chamber,
                row.state,
            );
            let (Some(first_name), Some(last_name), Some(party), Some(chamber), Some(state)) =
                metadata
            else {
                return Err(sqlx::Error::Protocol(format!(
                    "influence financial row references missing member {bioguide_id}"
                )));
            };
            let recipient =
                recipient_totals
                    .entry(bioguide_id)
                    .or_insert_with(|| RecipientAccumulator {
                        first_name,
                        last_name,
                        party,
                        chamber,
                        state,
                        direct_contributions: 0.0,
                        independent_supporting: 0.0,
                        independent_opposing: 0.0,
                    });
            recipient.direct_contributions += row.direct_amount;
            recipient.independent_supporting += row.support_ie_amount;
            recipient.independent_opposing += row.oppose_ie_amount;
        }

        let mut committees: Vec<CommitteeFinancial> = committee_totals.into_values().collect();
        committees.sort_by(|left, right| {
            right
                .total
                .total_cmp(&left.total)
                .then_with(|| left.committee_name.cmp(&right.committee_name))
                .then_with(|| left.committee_id.cmp(&right.committee_id))
        });
        let total_direct = committees
            .iter()
            .map(|committee| committee.direct_contributions)
            .sum();
        let total_support = committees
            .iter()
            .map(|committee| committee.independent_supporting)
            .sum();
        let total_oppose = committees
            .iter()
            .map(|committee| committee.independent_opposing)
            .sum();

        let mut top_recipients: Vec<RecipientMember> = recipient_totals
            .into_iter()
            .map(|(bioguide_id, recipient)| {
                let total_activity = recipient.direct_contributions
                    + recipient.independent_supporting
                    + recipient.independent_opposing;
                RecipientMember {
                    bioguide_id,
                    first_name: recipient.first_name,
                    last_name: recipient.last_name,
                    party: recipient.party,
                    chamber: recipient.chamber,
                    state: recipient.state,
                    // Independent expenditures are never received by a campaign.
                    total_received: recipient.direct_contributions,
                    direct_contributions: recipient.direct_contributions,
                    independent_supporting: recipient.independent_supporting,
                    independent_opposing: recipient.independent_opposing,
                    total_activity,
                }
            })
            .collect();
        top_recipients.sort_by(|left, right| {
            right
                .total_received
                .total_cmp(&left.total_received)
                .then_with(|| right.total_activity.total_cmp(&left.total_activity))
                .then_with(|| left.bioguide_id.cmp(&right.bioguide_id))
        });
        top_recipients.truncate(20);

        Ok(Some(InfluenceNetworkFinancials {
            network_slug: network_slug.to_string(),
            cycle,
            total_direct_contributions: total_direct,
            total_independent_supporting: total_support,
            total_independent_opposing: total_oppose,
            total_all: total_direct + total_support + total_oppose,
            committees,
            top_recipients,
        }))
    }
}

// ── Private row types ───────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct NetRow {
    network_slug: String,
    display_name: String,
    aliases: Vec<String>,
    description: String,
    category: String,
    confidence: String,
    source_citation: String,
}

#[derive(sqlx::FromRow)]
struct NetCommRow {
    committee_id: String,
    committee_name: String,
    role: String,
    confidence: String,
    source_citation: String,
}
