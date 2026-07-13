use crate::models::{
    CommitteeFunding, DonorSummary, InfluenceNetworkFunding, LeadershipPacFunding, MemberFunding,
    PacInfo, ProvenanceSource, ProvenanceSummary,
};
use crate::repository::Repository;
use chrono::{DateTime, NaiveDate, Utc};
use std::collections::HashSet;
use tracing::Instrument;

pub struct FecCandidateUpsert<'a> {
    pub candidate_id: &'a str,
    pub bioguide_id: Option<&'a str>,
    pub name: &'a str,
    pub party: Option<&'a str>,
    pub state: Option<&'a str>,
    pub district: Option<&'a str>,
    pub office: Option<&'a str>,
    pub incumbent_challenge: Option<&'a str>,
    pub principal_committee_id: Option<&'a str>,
    pub active_through: Option<i32>,
    pub first_file_date: Option<NaiveDate>,
    pub last_file_date: Option<NaiveDate>,
    pub source_run_id: Option<uuid::Uuid>,
}

pub struct FecCommitteeUpsert<'a> {
    pub committee_id: &'a str,
    pub name: &'a str,
    pub committee_type: Option<&'a str>,
    pub committee_type_full: Option<&'a str>,
    pub designation: Option<&'a str>,
    pub designation_full: Option<&'a str>,
    pub party: Option<&'a str>,
    pub state: Option<&'a str>,
    pub treasurer_name: Option<&'a str>,
    pub affiliated_committee_name: Option<&'a str>,
    pub sponsor_candidate_ids: serde_json::Value,
    pub source_run_id: Option<uuid::Uuid>,
}

pub struct FecTransactionUpsert<'a> {
    pub transaction_id: &'a str,
    pub transaction_type: &'a str,
    pub committee_id: Option<&'a str>,
    pub candidate_id: Option<&'a str>,
    pub bioguide_id: Option<&'a str>,
    pub contributor_name: Option<&'a str>,
    pub contributor_committee_id: Option<&'a str>,
    pub recipient_name: Option<&'a str>,
    pub amount: f64,
    pub transaction_date: Option<NaiveDate>,
    pub cycle: Option<i32>,
    pub support_oppose_indicator: Option<&'a str>,
    pub employer: Option<&'a str>,
    pub occupation: Option<&'a str>,
    pub purpose: Option<&'a str>,
    pub memo_text: Option<&'a str>,
    pub source_url: Option<&'a str>,
    pub raw_json: serde_json::Value,
    pub source_run_id: Option<uuid::Uuid>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct FecBulkImportRecord {
    pub dataset_name: String,
    pub election_cycle: i32,
    pub sha256: String,
    pub status: String,
    pub etag: Option<String>,
    pub source_modified_at: Option<DateTime<Utc>>,
    pub archive_path: Option<String>,
    pub compressed_bytes: Option<i64>,
}

pub struct FecBulkImportUpsert<'a> {
    pub dataset_name: &'a str,
    pub election_cycle: i32,
    pub source_url: &'a str,
    pub sha256: &'a str,
    pub compressed_bytes: i64,
    pub source_modified_at: Option<DateTime<Utc>>,
    pub etag: Option<&'a str>,
    pub archive_path: &'a str,
    pub source_run_id: uuid::Uuid,
}

impl Repository {
    /// Insert or update an FEC candidate row.
    pub async fn upsert_fec_candidate(
        &self,
        input: FecCandidateUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO fec_candidates
               (candidate_id, bioguide_id, name, party, state, district, office,
                incumbent_challenge, principal_committee_id, active_through,
                first_file_date, last_file_date, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
               ON CONFLICT (candidate_id) DO UPDATE SET
                 bioguide_id        = COALESCE(EXCLUDED.bioguide_id, fec_candidates.bioguide_id),
                 name               = EXCLUDED.name,
                 party              = COALESCE(EXCLUDED.party, fec_candidates.party),
                 state              = COALESCE(EXCLUDED.state, fec_candidates.state),
                 district           = COALESCE(EXCLUDED.district, fec_candidates.district),
                 office             = COALESCE(EXCLUDED.office, fec_candidates.office),
                 incumbent_challenge = COALESCE(EXCLUDED.incumbent_challenge, fec_candidates.incumbent_challenge),
                 principal_committee_id = COALESCE(EXCLUDED.principal_committee_id, fec_candidates.principal_committee_id),
                 active_through     = COALESCE(EXCLUDED.active_through, fec_candidates.active_through),
                 first_file_date    = COALESCE(EXCLUDED.first_file_date, fec_candidates.first_file_date),
                 last_file_date     = COALESCE(EXCLUDED.last_file_date, fec_candidates.last_file_date)"#,
        )
        .bind(input.candidate_id)
        .bind(input.bioguide_id)
        .bind(input.name)
        .bind(input.party)
        .bind(input.state)
        .bind(input.district)
        .bind(input.office)
        .bind(input.incumbent_challenge)
        .bind(input.principal_committee_id)
        .bind(input.active_through)
        .bind(input.first_file_date)
        .bind(input.last_file_date)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Insert or update an FEC committee row.
    pub async fn upsert_fec_committee(
        &self,
        input: FecCommitteeUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO fec_committees
               (committee_id, name, committee_type, committee_type_full,
                designation, designation_full, party, state,
                treasurer_name, affiliated_committee_name, sponsor_candidate_ids, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
               ON CONFLICT (committee_id) DO UPDATE SET
                 name                    = EXCLUDED.name,
                 committee_type          = COALESCE(EXCLUDED.committee_type, fec_committees.committee_type),
                 committee_type_full     = COALESCE(EXCLUDED.committee_type_full, fec_committees.committee_type_full),
                 designation             = COALESCE(EXCLUDED.designation, fec_committees.designation),
                 designation_full        = COALESCE(EXCLUDED.designation_full, fec_committees.designation_full),
                 party                   = COALESCE(EXCLUDED.party, fec_committees.party),
                 state                   = COALESCE(EXCLUDED.state, fec_committees.state),
                 treasurer_name          = COALESCE(EXCLUDED.treasurer_name, fec_committees.treasurer_name),
                 affiliated_committee_name = COALESCE(EXCLUDED.affiliated_committee_name, fec_committees.affiliated_committee_name),
                 sponsor_candidate_ids   = EXCLUDED.sponsor_candidate_ids"#,
        )
        .bind(input.committee_id)
        .bind(input.name)
        .bind(input.committee_type)
        .bind(input.committee_type_full)
        .bind(input.designation)
        .bind(input.designation_full)
        .bind(input.party)
        .bind(input.state)
        .bind(input.treasurer_name)
        .bind(input.affiliated_committee_name)
        .bind(input.sponsor_candidate_ids)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Insert or update an FEC transaction row.
    pub async fn upsert_fec_transaction(
        &self,
        input: FecTransactionUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO fec_transactions
               (transaction_id, transaction_type, committee_id, candidate_id, bioguide_id,
                contributor_name, contributor_committee_id, recipient_name,
                amount, transaction_date, cycle,
                support_oppose_indicator, employer, occupation, purpose, memo_text,
                source_url, raw_json, source_run_id)
               VALUES ($1, $2::fec_transaction_type, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
               ON CONFLICT (transaction_id) DO UPDATE SET
                 amount                    = EXCLUDED.amount,
                 transaction_date          = COALESCE(EXCLUDED.transaction_date, fec_transactions.transaction_date),
                 cycle                     = COALESCE(EXCLUDED.cycle, fec_transactions.cycle),
                 support_oppose_indicator  = COALESCE(EXCLUDED.support_oppose_indicator, fec_transactions.support_oppose_indicator),
                 employer                  = COALESCE(EXCLUDED.employer, fec_transactions.employer),
                 occupation                = COALESCE(EXCLUDED.occupation, fec_transactions.occupation),
                 purpose                   = COALESCE(EXCLUDED.purpose, fec_transactions.purpose),
                 memo_text                 = COALESCE(EXCLUDED.memo_text, fec_transactions.memo_text)"#,
        )
        .bind(input.transaction_id)
        .bind(input.transaction_type)
        .bind(input.committee_id)
        .bind(input.candidate_id)
        .bind(input.bioguide_id)
        .bind(input.contributor_name)
        .bind(input.contributor_committee_id)
        .bind(input.recipient_name)
        .bind(input.amount)
        .bind(input.transaction_date)
        .bind(input.cycle)
        .bind(input.support_oppose_indicator)
        .bind(input.employer)
        .bind(input.occupation)
        .bind(input.purpose)
        .bind(input.memo_text)
        .bind(input.source_url)
        .bind(input.raw_json)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Get member funding for a given cycle, assembling data from materialized views
    /// and top-level transaction summaries.
    pub async fn get_member_funding(
        &self,
        bioguide_id: &str,
        cycle: i32,
    ) -> Result<Option<MemberFunding>, sqlx::Error> {
        // Read from member_funding_cycle_mv
        let mv_row: Option<FundingMvRow> = sqlx::query_as::<_, FundingMvRow>(
            r#"SELECT COALESCE(direct_receipts, 0) AS direct_receipts,
                      COALESCE(pac_receipts, 0) AS pac_receipts,
                      COALESCE(individual_receipts, 0) AS individual_receipts,
                      COALESCE(independent_expenditures_supporting, 0) AS independent_expenditures_supporting,
                      COALESCE(independent_expenditures_opposing, 0) AS independent_expenditures_opposing
               FROM member_funding_cycle_mv
               WHERE bioguide_id = $1 AND cycle = $2"#,
        )
        .bind(bioguide_id)
        .bind(cycle)
        .fetch_optional(self.pool())
        .await?;

        let mv = match mv_row {
            Some(r) => r,
            None => {
                // Check if member exists at all
                let exists: Option<(String,)> =
                    sqlx::query_as("SELECT bioguide_id FROM members WHERE bioguide_id = $1")
                        .bind(bioguide_id)
                        .fetch_optional(self.pool())
                        .await?;
                if exists.is_none() {
                    return Ok(None);
                }
                // Return zero-data funding object
                FundingMvRow {
                    direct_receipts: 0.0,
                    pac_receipts: 0.0,
                    individual_receipts: 0.0,
                    independent_expenditures_supporting: 0.0,
                    independent_expenditures_opposing: 0.0,
                }
            }
        };

        // Top donors by contributor name
        let top_donors: Vec<DonorSummary> = sqlx::query_as::<_, DonorRow>(
            r#"SELECT COALESCE(contributor_name, 'Unknown') AS contributor_name,
                      SUM(amount) AS amount, COUNT(*)::bigint AS cnt
               FROM fec_transactions
               WHERE bioguide_id = $1
                 AND (cycle = $2 OR $2 = 0)
                 AND transaction_type = 'receipt'
               GROUP BY contributor_name
               ORDER BY SUM(amount) DESC
               LIMIT 10"#,
        )
        .bind(bioguide_id)
        .bind(cycle)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|d| DonorSummary {
            contributor_name: d.contributor_name,
            amount: d.amount,
            count: d.cnt,
        })
        .collect();

        // Top committees by committee_id -> fec_committees name
        let top_committees: Vec<CommitteeFunding> = sqlx::query_as::<_, CommFundingRow>(
            r#"SELECT ft.committee_id, COALESCE(fc.name, ft.committee_id) AS committee_name,
                      SUM(ft.amount) AS amount,
                      'contribution'::text AS relationship_type,
                      CASE WHEN fc.committee_id IS NULL THEN 'unresolved'
                           ELSE 'resolved' END AS resolution_status,
                      COUNT(*)::bigint AS transaction_count
               FROM fec_transactions ft
               LEFT JOIN fec_committees fc ON fc.committee_id = ft.committee_id
               WHERE ft.bioguide_id = $1
                 AND (ft.cycle = $2 OR $2 = 0)
                 AND ft.transaction_type = 'receipt'
               GROUP BY ft.committee_id, fc.name
               ORDER BY SUM(ft.amount) DESC
               LIMIT 10"#,
        )
        .bind(bioguide_id)
        .bind(cycle)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|c| CommitteeFunding {
            committee_id: c.committee_id,
            committee_name: c.committee_name,
            amount: c.amount,
            relationship_type: Some(c.relationship_type),
            resolution_status: Some(c.resolution_status),
            transaction_count: Some(c.transaction_count),
        })
        .collect();

        // Influence network funding from influence_network_member_mv
        let network_funding: Vec<InfluenceNetworkFunding> = sqlx::query_as::<_, NetworkFundingRow>(
            r#"SELECT inn.network_slug, inn.display_name,
                          COALESCE(SUM(inm.direct_amount), 0) AS direct_pac,
                          COALESCE(SUM(inm.support_ie_amount), 0) AS independent_supporting,
                          COALESCE(SUM(inm.oppose_ie_amount), 0) AS independent_opposing,
                          'verified' AS confidence
                   FROM influence_network_member_mv inm
                   JOIN influence_networks inn ON inn.network_slug = inm.network_slug
                   WHERE inm.bioguide_id = $1 AND inm.cycle = $2
                   GROUP BY inn.network_slug, inn.display_name
                   ORDER BY 3 DESC"#,
        )
        .bind(bioguide_id)
        .bind(cycle)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|n| InfluenceNetworkFunding {
            network_slug: n.network_slug,
            display_name: n.display_name,
            direct_pac: n.direct_pac,
            independent_supporting: n.independent_supporting,
            independent_opposing: n.independent_opposing,
            confidence: n.confidence,
        })
        .collect();

        let has_run = self.has_successful_fec_run(bioguide_id, cycle).await?;

        let provenance = ProvenanceSummary {
            sources: vec![ProvenanceSource {
                source: "openfec".to_string(),
                status: if has_run { "loaded" } else { "not_seeded" }.to_string(),
                fetched_at: None,
                confidence: Some("verified".to_string()),
            }],
            warnings: if !has_run {
                vec!["No FEC transactions loaded. Run the FEC ingest for this cycle.".to_string()]
            } else {
                Vec::new()
            },
        };

        Ok(Some(MemberFunding {
            bioguide_id: bioguide_id.to_string(),
            cycle,
            direct_receipts: mv.direct_receipts,
            pac_receipts: mv.pac_receipts,
            individual_receipts: mv.individual_receipts,
            independent_expenditures_supporting: mv.independent_expenditures_supporting,
            independent_expenditures_opposing: mv.independent_expenditures_opposing,
            top_donors,
            committee_relationships: top_committees.clone(),
            leadership_pacs: Vec::new(),
            top_committees,
            influence_networks: network_funding,
            has_successful_fec_run: has_run,
            provenance,
        }))
    }

    /// Get the bioguide_id associated with an FEC candidate_id via fec_candidates.
    pub async fn get_candidate_by_fec_id(
        &self,
        candidate_id: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let row: Option<(Option<String>,)> =
            sqlx::query_as("SELECT bioguide_id FROM fec_candidates WHERE candidate_id = $1")
                .bind(candidate_id)
                .fetch_optional(self.pool())
                .await?;

        Ok(row.and_then(|(b,)| b))
    }

    /// Check whether a successful openfec source run exists.
    pub async fn has_successful_fec_run(
        &self,
        bioguide_id: &str,
        cycle: i32,
    ) -> Result<bool, sqlx::Error> {
        let row: (bool,) = sqlx::query_as(
            "SELECT EXISTS(
               SELECT 1 FROM fec_transactions
               WHERE bioguide_id = $1 AND cycle = $2
             )",
        )
        .bind(bioguide_id)
        .bind(cycle)
        .fetch_optional(self.pool())
        .await?
        .unwrap_or((false,));

        Ok(row.0)
    }

    /// Search FEC committees (PACs) by name query.
    pub async fn search_pacs(&self, query: &str, limit: i64) -> Result<Vec<PacInfo>, sqlx::Error> {
        let pattern = format!("%{}%", query);
        let rows: Vec<PacRow> = sqlx::query_as::<_, PacRow>(
            r#"SELECT committee_id, name, committee_type, party, state
               FROM fec_committees
               WHERE name ILIKE $1
               ORDER BY name ASC
               LIMIT $2"#,
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(self.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| PacInfo {
                committee_id: r.committee_id,
                name: r.name,
                committee_type: r.committee_type,
                party: r.party,
                state: r.state,
            })
            .collect())
    }

    /// Fetch member funding from OpenFEC API live when database has no data.
    /// Returns None if the member has no FEC candidate_id or the API call fails.
    pub async fn auto_ingest_member_funding(
        &self,
        bioguide_id: &str,
        cycle: i32,
        api_key: &str,
    ) -> Result<Option<MemberFunding>, Box<dyn std::error::Error + Send + Sync>> {
        let span = tracing::info_span!("auto_ingest_member_funding", bioguide_id = %bioguide_id, cycle = %cycle);
        async {
            // 1. Look up FEC candidate_id
            let fec_id = match self.get_member_identifier(bioguide_id, "fec").await? {
                Some(id) => {
                    tracing::info!(bioguide_id=%bioguide_id, fec_id=%id, "found FEC candidate_id");
                    id
                }
                None => {
                    tracing::warn!(bioguide_id=%bioguide_id, "no FEC candidate_id found");
                    return Ok(None);
                }
            };

            if api_key.is_empty() {
                return Err("OpenFEC API key is required. Set OPENFEC_API_KEY. Get a key at https://api.data.gov/signup/".into());
            }
            let client = openfec_api::Client::new(api_key.to_string());

            // 3. Fetch candidate totals
            let totals_query = openfec_api::query::CandidateTotalQuery::default()
                .with_candidate_id(fec_id.clone())
                .with_cycle(cycle as u32);
            tracing::info!(fec_id=%fec_id, cycle=cycle, "fetching candidate totals from OpenFEC");
            let totals_resp = client.get_candidate_totals(&totals_query).await?;
            tracing::info!(fec_id=%fec_id, totals_count=totals_resp.data.len(), "received candidate totals");

            let Some(totals) = totals_resp.data.first() else {
                tracing::warn!(fec_id=%fec_id, cycle, "OpenFEC returned no candidate totals");
                return Ok(None);
            };
            let direct_receipts = totals.receipts.unwrap_or(0.0);
            let pac_receipts = totals
                .other_political_committee_contributions
                .unwrap_or(0.0);
            let individual_receipts = totals.individual_itemized_contributions.unwrap_or(0.0)
                + totals.individual_unitemized_contributions.unwrap_or(0.0);

            let mut warnings = vec![
                "Contributor and committee rankings require the canonical paginated FEC transaction ingest; candidate totals alone do not support a complete ranking.".to_string(),
                "Independent expenditure totals are unavailable in the candidate totals response and are not inferred as factual zeroes.".to_string(),
            ];
            if totals.receipts.is_none() {
                warnings.push("OpenFEC did not publish total receipts for this candidate and cycle.".to_string());
            }

            let provenance = ProvenanceSummary {
                sources: vec![ProvenanceSource {
                    source: "openfec".to_string(),
                    status: "live_totals".to_string(),
                    fetched_at: Some(chrono::Utc::now().to_rfc3339()),
                    confidence: Some("verified".to_string()),
                }],
                warnings,
            };

            Ok(Some(MemberFunding {
                bioguide_id: bioguide_id.to_string(),
                cycle,
                direct_receipts,
                pac_receipts,
                individual_receipts,
                independent_expenditures_supporting: 0.0,
                independent_expenditures_opposing: 0.0,
                top_donors: Vec::new(),
                top_committees: Vec::new(),
                committee_relationships: Vec::new(),
                leadership_pacs: Vec::new(),
                influence_networks: Vec::new(),
                has_successful_fec_run: true,
                provenance,
            }))
        }.instrument(span).await
    }

    /// Get cached funding data if still fresh (within max_age_hours).
    pub async fn get_cached_funding(
        &self,
        bioguide_id: &str,
        cycle: i32,
        max_age_hours: i32,
    ) -> Result<Option<MemberFunding>, sqlx::Error> {
        let row: Option<(serde_json::Value,)> = sqlx::query_as(
            "SELECT data FROM funding_cache
             WHERE bioguide_id = $1
               AND cycle = $2
               AND fetched_at > now() - ($3 || ' hours')::interval
               AND data #>> '{provenance,sources,0,status}' = 'live_totals'",
        )
        .bind(bioguide_id)
        .bind(cycle)
        .bind(max_age_hours.to_string())
        .fetch_optional(self.pool())
        .await?;
        match row {
            Some((v,)) => Ok(serde_json::from_value(v).ok()),
            None => Ok(None),
        }
    }

    /// Upsert funding data into the persistent cache.
    pub async fn save_funding_cache(
        &self,
        bioguide_id: &str,
        cycle: i32,
        funding: &MemberFunding,
    ) -> Result<(), sqlx::Error> {
        let data = serde_json::to_value(funding)
            .map_err(|e| sqlx::Error::Protocol(format!("json encode: {e}")))?;
        sqlx::query(
            "INSERT INTO funding_cache (bioguide_id, cycle, data, fetched_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (bioguide_id, cycle) DO UPDATE SET data = $3, fetched_at = now()",
        )
        .bind(bioguide_id)
        .bind(cycle)
        .bind(&data)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    // ── Bulk import tracking ────────────────────────────────────────────

    /// Return the most recently checked immutable archive for a dataset.
    pub async fn latest_bulk_import(
        &self,
        dataset_name: &str,
    ) -> Result<Option<FecBulkImportRecord>, sqlx::Error> {
        sqlx::query_as(
            r#"SELECT dataset_name, election_cycle, sha256, status, etag,
                      source_modified_at, archive_path, compressed_bytes
               FROM fec_bulk_imports
               WHERE dataset_name = $1
               ORDER BY checked_at DESC, downloaded_at DESC
               LIMIT 1"#,
        )
        .bind(dataset_name)
        .fetch_optional(self.pool())
        .await
    }

    /// Record or refresh metadata for a content-addressed bulk archive.
    pub async fn upsert_bulk_import(
        &self,
        input: FecBulkImportUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO fec_bulk_imports
               (dataset_name, election_cycle, source_url, sha256, compressed_bytes,
                source_modified_at, etag, archive_path, source_run_id, status, checked_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'downloaded', now())
               ON CONFLICT (dataset_name, sha256) DO UPDATE SET
                 source_url         = EXCLUDED.source_url,
                 compressed_bytes   = EXCLUDED.compressed_bytes,
                 source_modified_at = EXCLUDED.source_modified_at,
                 etag               = EXCLUDED.etag,
                 archive_path       = EXCLUDED.archive_path,
                 source_run_id      = EXCLUDED.source_run_id,
                 checked_at         = now()"#,
        )
        .bind(input.dataset_name)
        .bind(input.election_cycle)
        .bind(input.source_url)
        .bind(input.sha256)
        .bind(input.compressed_bytes)
        .bind(input.source_modified_at)
        .bind(input.etag)
        .bind(input.archive_path)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    /// Record a no-download remote metadata check for an unchanged archive.
    pub async fn touch_bulk_import(
        &self,
        dataset_name: &str,
        sha256: &str,
        source_run_id: uuid::Uuid,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE fec_bulk_imports
             SET checked_at = now(), source_run_id = $1
             WHERE dataset_name = $2 AND sha256 = $3",
        )
        .bind(source_run_id)
        .bind(dataset_name)
        .bind(sha256)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    /// Update a bulk import's status and row count.
    pub async fn update_bulk_import_status(
        &self,
        dataset_name: &str,
        sha256: &str,
        status: &str,
        extracted_rows: i64,
        error_message: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        let result = sqlx::query(
            r#"UPDATE fec_bulk_imports
               SET status = $1,
                   extracted_rows = GREATEST(COALESCE(extracted_rows, 0), $2),
                   error_message = $3,
                   checked_at = now(),
                   canonicalized_at = CASE WHEN $1 = 'canonicalized' THEN now() ELSE canonicalized_at END
               WHERE dataset_name = $4 AND sha256 = $5"#,
        )
        .bind(status)
        .bind(extracted_rows)
        .bind(error_message)
        .bind(dataset_name)
        .bind(sha256)
        .execute(self.pool())
        .await?;
        if result.rows_affected() == 0 {
            return Err(sqlx::Error::RowNotFound);
        }
        Ok(())
    }

    /// Check if a given dataset+sha256 was already downloaded (idempotency).
    pub async fn bulk_import_exists(
        &self,
        dataset_name: &str,
        sha256: &str,
    ) -> Result<bool, sqlx::Error> {
        let row: Option<(bool,)> = sqlx::query_as(
            "SELECT true FROM fec_bulk_imports WHERE dataset_name = $1 AND sha256 = $2",
        )
        .bind(dataset_name)
        .bind(sha256)
        .fetch_optional(self.pool())
        .await?;
        Ok(row.is_some())
    }

    /// Authorized House and Senate candidate committees for a two-year cycle.
    pub async fn congressional_committee_ids(
        &self,
        election_cycle: i32,
    ) -> Result<HashSet<String>, sqlx::Error> {
        let ids: Vec<String> = sqlx::query_scalar(
            r#"SELECT DISTINCT cc.committee_id
               FROM fec_candidate_committees cc
               JOIN fec_candidates candidate ON candidate.candidate_id = cc.candidate_id
               WHERE cc.election_cycle = $1
                 AND candidate.office IN ('H', 'S')"#,
        )
        .bind(election_cycle)
        .fetch_all(self.pool())
        .await?;
        Ok(ids.into_iter().collect())
    }

    /// Preserve an official cross-file linkage that cannot yet satisfy FKs.
    pub async fn record_fec_linkage_issue(
        &self,
        election_cycle: i32,
        candidate_id: &str,
        committee_id: &str,
        issue_type: &str,
        source_run_id: uuid::Uuid,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO fec_linkage_issues
               (election_cycle, candidate_id, committee_id, issue_type, source_run_id)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (election_cycle, candidate_id, committee_id, issue_type)
               DO UPDATE SET
                 source_run_id = EXCLUDED.source_run_id,
                 last_seen_at = now(),
                 resolved = false,
                 resolved_at = NULL"#,
        )
        .bind(election_cycle)
        .bind(candidate_id)
        .bind(committee_id)
        .bind(issue_type)
        .bind(source_run_id)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    pub async fn resolve_fec_linkage_issues(
        &self,
        election_cycle: i32,
        candidate_id: &str,
        committee_id: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"UPDATE fec_linkage_issues
               SET resolved = true, resolved_at = now()
               WHERE election_cycle = $1
                 AND candidate_id = $2
                 AND committee_id = $3
                 AND resolved = false"#,
        )
        .bind(election_cycle)
        .bind(candidate_id)
        .bind(committee_id)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    // ── Staging inserts (batched) ────────────────────────────────────────

    /// Insert a batch of raw individual receipt rows into the staging table.
    pub async fn insert_staging_individuals_batch(
        &self,
        rows: &[crate::fec_bulk::parse::RawIndividualReceipt],
        import_batch: uuid::Uuid,
        file_year: i32,
    ) -> Result<i64, sqlx::Error> {
        use sqlx::QueryBuilder;
        let mut builder = QueryBuilder::new(
            "INSERT INTO fec_staging_individuals (
                sub_id, committee_id, amendment_ind, report_type, transaction_pgi,
                image_num, transaction_type, entity_type, contributor_name,
                contributor_city, contributor_state, contributor_zip,
                contributor_employer, contributor_occupation, transaction_date,
                transaction_amount, other_id, tran_id, filing_num, memo_code,
                memo_text, file_year, import_batch, record_kind, include_in_totals
            ) ",
        );
        builder.push_values(rows, |mut b, row| {
            let classification = crate::fec_bulk::classify::classify_individual(
                row.transaction_type.as_deref(),
                row.memo_code.as_deref(),
                row.transaction_amount,
            );
            b.push_bind(row.sub_id)
                .push_bind(&row.committee_id)
                .push_bind(row.amendment_ind.as_deref())
                .push_bind(row.report_type.as_deref())
                .push_bind(row.transaction_pgi.as_deref())
                .push_bind(row.image_num.as_deref())
                .push_bind(row.transaction_type.as_deref())
                .push_bind(row.entity_type.as_deref())
                .push_bind(row.contributor_name.as_deref())
                .push_bind(row.contributor_city.as_deref())
                .push_bind(row.contributor_state.as_deref())
                .push_bind(row.contributor_zip.as_deref())
                .push_bind(row.contributor_employer.as_deref())
                .push_bind(row.contributor_occupation.as_deref())
                .push_bind(row.transaction_date)
                .push_bind(row.transaction_amount)
                .push_bind(row.other_id.as_deref())
                .push_bind(row.tran_id.as_deref())
                .push_bind(row.filing_num)
                .push_bind(row.memo_code.as_deref())
                .push_bind(row.memo_text.as_deref())
                .push_bind(file_year)
                .push_bind(import_batch)
                .push_bind(classification.kind)
                .push_bind(classification.include_in_totals);
        });
        builder.push(" ON CONFLICT (sub_id, import_batch) DO NOTHING");
        let result = builder.build().execute(self.pool()).await?;
        Ok(result.rows_affected() as i64)
    }

    /// Insert a batch of raw committee transaction rows into the staging table.
    pub async fn insert_staging_committee_txns_batch(
        &self,
        rows: &[crate::fec_bulk::parse::RawCommitteeTxn],
        import_batch: uuid::Uuid,
        file_year: i32,
    ) -> Result<i64, sqlx::Error> {
        use sqlx::QueryBuilder;
        let mut builder = QueryBuilder::new(
            "INSERT INTO fec_staging_committee_txns (
                sub_id, committee_id, amendment_ind, report_type, transaction_pgi,
                image_num, transaction_type, entity_type, contributor_name,
                contributor_city, contributor_state, contributor_zip,
                contributor_employer, contributor_occupation, transaction_date,
                transaction_amount, other_id, tran_id, filing_num, memo_code,
                memo_text, file_year, import_batch, relationship_type, include_in_totals
            ) ",
        );
        builder.push_values(rows, |mut b, row| {
            let classification = crate::fec_bulk::classify::classify_committee(
                row.transaction_type.as_deref(),
                row.memo_code.as_deref(),
                row.transaction_amount,
            );
            b.push_bind(row.sub_id)
                .push_bind(&row.committee_id)
                .push_bind(row.amendment_ind.as_deref())
                .push_bind(row.report_type.as_deref())
                .push_bind(row.transaction_pgi.as_deref())
                .push_bind(row.image_num.as_deref())
                .push_bind(row.transaction_type.as_deref())
                .push_bind(row.entity_type.as_deref())
                .push_bind(row.contributor_name.as_deref())
                .push_bind(row.contributor_city.as_deref())
                .push_bind(row.contributor_state.as_deref())
                .push_bind(row.contributor_zip.as_deref())
                .push_bind(row.contributor_employer.as_deref())
                .push_bind(row.contributor_occupation.as_deref())
                .push_bind(row.transaction_date)
                .push_bind(row.transaction_amount)
                .push_bind(row.other_id.as_deref())
                .push_bind(row.tran_id.as_deref())
                .push_bind(row.filing_num)
                .push_bind(row.memo_code.as_deref())
                .push_bind(row.memo_text.as_deref())
                .push_bind(file_year)
                .push_bind(import_batch)
                .push_bind(classification.kind)
                .push_bind(classification.include_in_totals);
        });
        builder.push(" ON CONFLICT (sub_id, import_batch) DO NOTHING");
        let result = builder.build().execute(self.pool()).await?;
        Ok(result.rows_affected() as i64)
    }

    // ── Committee master and candidate-committee links ───────────────────

    /// Upsert a committee from the `cm` bulk file.
    pub async fn upsert_committee_master(
        &self,
        row: &crate::fec_bulk::parse::CommitteeMasterRow,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO fec_committees
               (committee_id, name, committee_type, party, state,
                treasurer_name, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (committee_id) DO UPDATE SET
                 name            = COALESCE(EXCLUDED.name, fec_committees.name),
                 committee_type  = COALESCE(EXCLUDED.committee_type, fec_committees.committee_type),
                 party           = COALESCE(EXCLUDED.party, fec_committees.party),
                 state           = COALESCE(EXCLUDED.state, fec_committees.state),
                 treasurer_name  = COALESCE(EXCLUDED.treasurer_name, fec_committees.treasurer_name)"#,
        )
        .bind(&row.committee_id)
        .bind(row.name.as_deref())
        .bind(row.committee_type.as_deref())
        .bind(row.party.as_deref())
        .bind(row.state.as_deref())
        .bind(row.treasurer_name.as_deref())
        .bind(None::<uuid::Uuid>)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    /// Insert a candidate-committee linkage row.
    pub async fn upsert_candidate_committee(
        &self,
        row: &crate::fec_bulk::parse::CclRow,
    ) -> Result<(), sqlx::Error> {
        let election_cycle = row.election_cycle().ok_or_else(|| {
            sqlx::Error::Protocol(format!(
                "candidate-committee linkage {} / {} has no FEC cycle",
                row.candidate_id, row.committee_id
            ))
        })?;
        sqlx::query(
            r#"INSERT INTO fec_candidate_committees
               (candidate_id, committee_id, election_cycle, committee_type, committee_designation, linkage_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (candidate_id, committee_id, election_cycle) DO UPDATE SET
                 committee_type        = COALESCE(EXCLUDED.committee_type, fec_candidate_committees.committee_type),
                 committee_designation = COALESCE(EXCLUDED.committee_designation, fec_candidate_committees.committee_designation)"#,
        )
        .bind(&row.candidate_id)
        .bind(&row.committee_id)
        .bind(election_cycle)
        .bind(row.committee_type.as_deref())
        .bind(row.committee_designation.as_deref())
        .bind(row.linkage_id)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    // ── Run canonicalization and rankings (delegates to fec_bulk modules) ─

    /// Run the full post-parse pipeline: canonicalize staging → canonical tables,
    /// build rankings, refresh materialized views, clear staging.
    pub async fn run_bulk_canonicalize_and_rank(
        &self,
        election_cycle: i32,
        import_batch: uuid::Uuid,
        source_run_id: uuid::Uuid,
    ) -> Result<(), sqlx::Error> {
        let mut transaction = self.pool().begin().await?;
        crate::fec_bulk::canonicalize::canonicalize_individuals(
            &mut transaction,
            election_cycle,
            import_batch,
            source_run_id,
        )
        .await?;
        crate::fec_bulk::canonicalize::canonicalize_committee_txns(
            &mut transaction,
            election_cycle,
            import_batch,
            source_run_id,
        )
        .await?;
        crate::fec_bulk::rankings::build_donor_rankings(&mut transaction, election_cycle).await?;
        crate::fec_bulk::rankings::build_committee_rankings(&mut transaction, election_cycle)
            .await?;
        crate::fec_bulk::rankings::refresh_funding_mv(&mut transaction).await?;
        crate::fec_bulk::canonicalize::clear_staging_batch(&mut transaction, import_batch).await?;
        transaction.commit().await?;
        Ok(())
    }

    // ── Read funding from precomputed rankings ───────────────────────────

    /// Get member funding from the precomputed rankings tables.
    /// Returns the full MemberFunding struct if rankings exist for this cycle.
    pub async fn get_member_funding_from_rankings(
        &self,
        bioguide_id: &str,
        cycle: i32,
    ) -> Result<Option<MemberFunding>, sqlx::Error> {
        // A member can have multiple FEC candidate IDs after changing chamber
        // or district. Aggregate every official ID for the selected cycle.
        let candidate_ids: Vec<String> = sqlx::query_scalar(
            "SELECT DISTINCT value FROM member_identifiers
             WHERE bioguide_id = $1 AND scheme = 'fec'",
        )
        .bind(bioguide_id)
        .fetch_all(self.pool())
        .await?;
        if candidate_ids.is_empty() {
            return Ok(None);
        }

        // Compute totals from canonical tables via candidate-committee crosswalk.
        // This is the correct source when bulk data has been ingested.
        let totals: Option<(f64, f64, f64, f64)> = sqlx::query_as(
            r#"
            WITH my_committees AS (
                SELECT committee_id FROM fec_candidate_committees
                WHERE candidate_id = ANY($1::text[]) AND election_cycle = $2
            )
            SELECT
                COALESCE((SELECT SUM(amount)::double precision FROM fec_canonical_individual_receipts
                          WHERE committee_id IN (SELECT committee_id FROM my_committees)
                            AND election_cycle = $2
                            AND is_current = true
                            AND include_in_totals = true), 0),
                COALESCE((SELECT SUM(amount)::double precision FROM fec_canonical_committee_receipts
                          WHERE recipient_committee_id IN (SELECT committee_id FROM my_committees)
                            AND election_cycle = $2
                            AND is_current = true
                            AND include_in_totals = true), 0),
                COALESCE((SELECT SUM(amount)::double precision FROM fec_independent_expenditures
                          WHERE candidate_id = ANY($1::text[])
                            AND election_cycle = $2
                            AND support_oppose = 'S'), 0),
                COALESCE((SELECT SUM(amount)::double precision FROM fec_independent_expenditures
                          WHERE candidate_id = ANY($1::text[])
                            AND election_cycle = $2
                            AND support_oppose = 'O'), 0)
            "#,
        )
        .bind(&candidate_ids)
        .bind(cycle)
        .fetch_optional(self.pool())
        .await?;

        // Get top donors from rankings
        let top_donors: Vec<DonorSummary> = sqlx::query_as::<_, DonorRow>(
            r#"SELECT MAX(display_name) AS contributor_name,
                      SUM(total_amount)::double precision AS amount,
                      SUM(contribution_count)::bigint AS cnt
               FROM fec_candidate_donor_rankings
               WHERE candidate_id = ANY($1::text[]) AND election_cycle = $2
               GROUP BY donor_key
               ORDER BY SUM(total_amount) DESC, SUM(contribution_count) DESC
               LIMIT 20"#,
        )
        .bind(&candidate_ids)
        .bind(cycle)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|d: DonorRow| DonorSummary {
            contributor_name: d.contributor_name,
            amount: d.amount,
            count: d.cnt,
        })
        .collect();

        // Keep direct contributions, authorized-committee transfers, and later
        // leadership/outside-spending relationships distinct.
        let committee_relationships: Vec<CommitteeFunding> = sqlx::query_as::<_, CommFundingRow>(
            r#"SELECT r.committee_id,
                      MAX(COALESCE(fc.name, r.committee_name)) AS committee_name,
                      SUM(r.total_amount)::double precision AS amount,
                      r.ranking_type AS relationship_type,
                      CASE WHEN bool_or(r.committee_resolution_status = 'unresolved')
                           THEN 'unresolved' ELSE 'resolved' END AS resolution_status,
                      SUM(r.transaction_count)::bigint AS transaction_count
               FROM fec_candidate_committee_rankings r
               LEFT JOIN fec_committees fc ON fc.committee_id = r.committee_id
               WHERE r.candidate_id = ANY($1::text[]) AND r.election_cycle = $2
               GROUP BY r.committee_id, r.ranking_type
               ORDER BY r.ranking_type, SUM(r.total_amount) DESC
               LIMIT 80"#,
        )
        .bind(&candidate_ids)
        .bind(cycle)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|c: CommFundingRow| CommitteeFunding {
            committee_id: c.committee_id,
            committee_name: c.committee_name,
            amount: c.amount,
            relationship_type: Some(c.relationship_type),
            resolution_status: Some(c.resolution_status),
            transaction_count: Some(c.transaction_count),
        })
        .collect();
        let top_committees: Vec<CommitteeFunding> = committee_relationships
            .iter()
            .filter(|committee| committee.relationship_type.as_deref() == Some("contribution"))
            .cloned()
            .collect();

        let network_funding: Vec<InfluenceNetworkFunding> = sqlx::query_as::<_, NetworkFundingRow>(
            r#"SELECT network.network_slug, network.display_name,
                          member.direct_amount::double precision AS direct_pac,
                          member.support_ie_amount::double precision AS independent_supporting,
                          member.oppose_ie_amount::double precision AS independent_opposing,
                          'verified'::text AS confidence
                   FROM influence_network_member_mv member
                   JOIN influence_networks network
                     ON network.network_slug = member.network_slug
                   WHERE member.bioguide_id = $1 AND member.cycle = $2
                   ORDER BY member.direct_amount + member.support_ie_amount
                            + member.oppose_ie_amount DESC"#,
        )
        .bind(bioguide_id)
        .bind(cycle)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|network| InfluenceNetworkFunding {
            network_slug: network.network_slug,
            display_name: network.display_name,
            direct_pac: network.direct_pac,
            independent_supporting: network.independent_supporting,
            independent_opposing: network.independent_opposing,
            confidence: network.confidence,
        })
        .collect();
        let leadership_pacs: Vec<LeadershipPacFunding> = sqlx::query_as(
            r#"SELECT committee_id, committee_name,
                      NULLIF(sponsor_name, '') AS sponsor_name,
                      cash_on_hand::double precision AS cash_on_hand,
                      total_disbursements::double precision AS total_disbursements,
                      total_receipts::double precision AS total_receipts,
                      coverage_end_date,
                      NULLIF(filing_url, '') AS source_url,
                      sponsor_resolution_status AS resolution_status
               FROM fec_leadership_pacs
               WHERE sponsor_bioguide_id = $1 AND election_cycle = $2
               ORDER BY total_receipts DESC NULLS LAST, committee_name"#,
        )
        .bind(bioguide_id)
        .bind(cycle)
        .fetch_all(self.pool())
        .await?;
        let has_bulk_source: bool = sqlx::query_scalar(
            r#"SELECT COUNT(DISTINCT dataset_name) = 2
               FROM fec_bulk_imports
               WHERE election_cycle = $1
                 AND status = 'canonicalized'
                 AND dataset_name IN ($2, $3)"#,
        )
        .bind(cycle)
        .bind(format!("indiv{}", cycle % 100))
        .bind(format!("oth{}", cycle % 100))
        .fetch_one(self.pool())
        .await?;
        let has_ie_source: bool = sqlx::query_scalar(
            "SELECT EXISTS(
               SELECT 1 FROM fec_bulk_imports
               WHERE election_cycle = $1
                 AND dataset_name = $2
                 AND status = 'canonicalized'
             )",
        )
        .bind(cycle)
        .bind(format!("independent_expenditure_{cycle}"))
        .fetch_one(self.pool())
        .await?;
        let has_rankings =
            !top_donors.is_empty() || !top_committees.is_empty() || !network_funding.is_empty();
        let (indiv, pac, ie_supporting, ie_opposing) = totals.unwrap_or_default();
        let direct = indiv + pac;

        let unresolved_committees = committee_relationships
            .iter()
            .filter(|committee| committee.resolution_status.as_deref() == Some("unresolved"))
            .count();
        let mut warnings = vec![
            "Named donor rankings cover itemized receipts reported with entity type IND; unitemized contributions have no public donor identity."
                .to_string(),
            "Committee contributions and authorized-committee transfers are reported as separate relationship types."
                .to_string(),
            "Independent expenditures are outside spending and were not received or controlled by the candidate's campaign."
                .to_string(),
        ];
        if !has_ie_source {
            warnings.push(
                "Independent expenditures are unavailable until the separate FEC outside-spending file is canonicalized."
                    .to_string(),
            );
        }
        if !has_rankings {
            warnings.push(
                "No canonical FEC rankings are loaded for this member and cycle.".to_string(),
            );
        }
        if unresolved_committees > 0 {
            warnings.push(format!(
                "{unresolved_committees} ranked committee IDs are absent from the cycle committee-master snapshot and remain unresolved."
            ));
        }
        let provenance = ProvenanceSummary {
            sources: vec![ProvenanceSource {
                source: "fec_bulk".to_string(),
                status: if has_bulk_source {
                    "loaded"
                } else {
                    "not_seeded"
                }
                .to_string(),
                fetched_at: None,
                confidence: Some("verified".to_string()),
            }],
            warnings,
        };

        Ok(Some(MemberFunding {
            bioguide_id: bioguide_id.to_string(),
            cycle,
            direct_receipts: direct,
            pac_receipts: pac,
            individual_receipts: indiv,
            independent_expenditures_supporting: ie_supporting,
            independent_expenditures_opposing: ie_opposing,
            top_donors,
            top_committees,
            committee_relationships,
            leadership_pacs,
            influence_networks: network_funding,
            has_successful_fec_run: has_bulk_source && has_ie_source,
            provenance,
        }))
    }
}
// ── Private row types ───────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct FundingMvRow {
    direct_receipts: f64,
    pac_receipts: f64,
    individual_receipts: f64,
    independent_expenditures_supporting: f64,
    independent_expenditures_opposing: f64,
}

#[derive(sqlx::FromRow)]
struct DonorRow {
    contributor_name: String,
    amount: f64,
    cnt: i64,
}

#[derive(sqlx::FromRow)]
struct CommFundingRow {
    committee_id: String,
    committee_name: String,
    amount: f64,
    relationship_type: String,
    resolution_status: String,
    transaction_count: i64,
}

#[derive(sqlx::FromRow)]
struct NetworkFundingRow {
    network_slug: String,
    display_name: String,
    direct_pac: f64,
    independent_supporting: f64,
    independent_opposing: f64,
    confidence: String,
}

#[derive(sqlx::FromRow)]
struct PacRow {
    committee_id: String,
    name: String,
    committee_type: Option<String>,
    party: Option<String>,
    state: Option<String>,
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    #[ignore = "requires DATABASE_URL, OPENFEC_API_KEY, and live OpenFEC access"]
    async fn live_auto_ingest_returns_official_totals_without_partial_rankings() {
        // This test requires DATABASE_URL and network access
        let db_url = std::env::var("DATABASE_URL").unwrap_or_default();
        if db_url.is_empty() {
            eprintln!("Skipping: DATABASE_URL not set");
            return;
        }
        let db = crate::db::Db::connect(&db_url).await.expect("db connect");
        let cache = std::sync::Arc::new(crate::cache::CacheLayer::new(60));
        let repo = crate::repository::Repository::new(db, cache);

        let api_key = std::env::var("OPENFEC_API_KEY").unwrap_or_default();
        if api_key.is_empty() {
            eprintln!("SKIP: OPENFEC_API_KEY not set. Get a key at https://api.data.gov/signup/");
            return;
        }
        let result = repo
            .auto_ingest_member_funding("A000370", 2026, &api_key)
            .await;
        match result {
            Ok(Some(funding)) => {
                assert!(funding.direct_receipts > 0.0, "Should have receipts");
                assert!(funding.pac_receipts > 0.0, "Should have PAC receipts");
                assert!(
                    funding.individual_receipts > 0.0,
                    "Should have individual receipts"
                );
                assert!(funding.top_donors.is_empty());
                assert!(funding.top_committees.is_empty());
                assert!(funding.provenance.warnings.iter().any(|warning| {
                    warning.contains("canonical paginated FEC transaction ingest")
                }));
            }
            Ok(None) => panic!("auto_ingest returned None"),
            Err(e) => panic!("auto_ingest failed: {}", e),
        }
    }
}
