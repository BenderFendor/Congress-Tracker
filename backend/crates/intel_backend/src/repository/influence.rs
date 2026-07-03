use crate::models::{InfluenceNetwork, InfluenceNetworkCommittee};
use crate::repository::Repository;

pub struct InfluenceNetworkUpsert<'a> {
    pub network_slug: &'a str,
    pub display_name: &'a str,
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
               (network_slug, display_name, description, category, confidence, source_citation, source_run_id)
               VALUES ($1, $2, $3, $4, $5::confidence_level, $6, $7)
               ON CONFLICT (network_slug) DO UPDATE SET
                 display_name    = EXCLUDED.display_name,
                 description     = EXCLUDED.description,
                 category        = EXCLUDED.category,
                 confidence      = EXCLUDED.confidence,
                 source_citation = EXCLUDED.source_citation"#,
        )
        .bind(input.network_slug)
        .bind(input.display_name)
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
            r#"SELECT network_slug, display_name, description, category, confidence::text AS confidence, source_citation
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
            r#"SELECT network_slug, display_name, description, category, confidence::text AS confidence, source_citation
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

        // Check that the network exists
        let net_exists: Option<(String,)> =
            sqlx::query_as("SELECT network_slug FROM influence_networks WHERE network_slug = $1")
                .bind(network_slug)
                .fetch_optional(self.pool())
                .await?;

        if net_exists.is_none() {
            return Ok(None);
        }

        // Aggregated totals from the materialized view
        let total_row: Option<(f64, f64, f64)> = sqlx::query_as(
            r#"SELECT
                COALESCE(SUM(direct_amount), 0),
                COALESCE(SUM(support_ie_amount), 0),
                COALESCE(SUM(oppose_ie_amount), 0)
            FROM influence_network_member_mv
            WHERE network_slug = $1 AND cycle = $2"#,
        )
        .bind(network_slug)
        .bind(cycle)
        .fetch_optional(self.pool())
        .await?;

        let (total_direct, total_support, total_oppose) = total_row.unwrap_or((0.0, 0.0, 0.0));

        // Per-committee breakdown from MV
        #[derive(sqlx::FromRow)]
        struct CommFinRow {
            committee_id: String,
            committee_name: String,
            role: String,
            direct_amount: f64,
            support_ie_amount: f64,
            oppose_ie_amount: f64,
        }

        let comm_rows: Vec<CommFinRow> = sqlx::query_as(
            r#"SELECT
                inc.committee_id,
                inc.committee_name,
                inc.role::text AS role,
                COALESCE(SUM(inm.direct_amount), 0) AS direct_amount,
                COALESCE(SUM(inm.support_ie_amount), 0) AS support_ie_amount,
                COALESCE(SUM(inm.oppose_ie_amount), 0) AS oppose_ie_amount
            FROM influence_network_committees inc
            LEFT JOIN influence_network_member_mv inm
                ON inc.network_slug = inm.network_slug
                AND inc.committee_id = (SELECT ft.committee_id FROM fec_transactions ft WHERE ft.committee_id = inc.committee_id AND ft.cycle = $2 LIMIT 1)
            WHERE inc.network_slug = $1
            GROUP BY inc.committee_id, inc.committee_name, inc.role
            ORDER BY COALESCE(SUM(inm.direct_amount), 0) + COALESCE(SUM(inm.support_ie_amount), 0) + COALESCE(SUM(inm.oppose_ie_amount), 0) DESC"#,
        )
        .bind(network_slug)
        .bind(cycle)
        .fetch_all(self.pool())
        .await?;

        let committees: Vec<CommitteeFinancial> = comm_rows
            .into_iter()
            .map(|r| CommitteeFinancial {
                committee_id: r.committee_id,
                committee_name: r.committee_name,
                role: r.role,
                direct_contributions: r.direct_amount,
                independent_supporting: r.support_ie_amount,
                independent_opposing: r.oppose_ie_amount,
                total: r.direct_amount + r.support_ie_amount + r.oppose_ie_amount,
            })
            .collect();

        // Top recipient members from MV (join to members for name/party/chamber)
        #[derive(sqlx::FromRow)]
        struct RecipRow {
            bioguide_id: String,
            first_name: String,
            last_name: String,
            party: String,
            chamber: String,
            state: String,
            total_received: f64,
        }

        let recip_rows: Vec<RecipRow> = sqlx::query_as(
            r#"SELECT
                inm.bioguide_id,
                m.first_name,
                m.last_name,
                m.current_party AS party,
                m.current_chamber AS chamber,
                m.current_state AS state,
                COALESCE(SUM(inm.direct_amount + inm.support_ie_amount + inm.oppose_ie_amount), 0) AS total_received
            FROM influence_network_member_mv inm
            JOIN members m ON inm.bioguide_id = m.bioguide_id
            WHERE inm.network_slug = $1 AND inm.cycle = $2
            GROUP BY inm.bioguide_id, m.first_name, m.last_name, m.current_party, m.current_chamber, m.current_state
            ORDER BY total_received DESC
            LIMIT 20"#,
        )
        .bind(network_slug)
        .bind(cycle)
        .fetch_all(self.pool())
        .await?;

        let top_recipients: Vec<RecipientMember> = recip_rows
            .into_iter()
            .map(|r| RecipientMember {
                bioguide_id: r.bioguide_id,
                first_name: r.first_name,
                last_name: r.last_name,
                party: r.party,
                chamber: r.chamber,
                state: r.state,
                total_received: r.total_received,
            })
            .collect();

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
