use crate::models::{
    BillAction, BillAmendment, BillInfo, BillIntel, BillSponsorInfo, BillTextVersion,
    LobbyingMatch, NetworkAmount, ProvenanceSource, ProvenanceSummary, SponsorFundingOverlay,
    VoteInfo,
};
use crate::repository::Repository;
use chrono::NaiveDate;

pub struct BillUpsert<'a> {
    pub congress: i32,
    pub bill_type: &'a str,
    pub bill_number: i32,
    pub bill_id: &'a str,
    pub title: &'a str,
    pub introduced_date: Option<NaiveDate>,
    pub origin_chamber: Option<&'a str>,
    pub policy_area: Option<&'a str>,
    pub latest_action_date: Option<NaiveDate>,
    pub latest_action_text: Option<&'a str>,
    pub status: &'a str,
    pub url: Option<&'a str>,
    pub source_run_id: Option<uuid::Uuid>,
}

pub struct BillAmendmentUpsert<'a> {
    pub bill_id: &'a str,
    pub congress: i32,
    pub bill_type: &'a str,
    pub bill_number: i32,
    pub amendment_number: Option<&'a str>,
    pub description: Option<&'a str>,
    pub amendment_type: Option<&'a str>,
    pub sponsor_name: Option<&'a str>,
    pub sponsor_bioguide_id: Option<&'a str>,
    pub introduced_date: Option<chrono::NaiveDate>,
    pub latest_action_date: Option<chrono::NaiveDate>,
    pub latest_action_text: Option<&'a str>,
    pub chamber: Option<&'a str>,
    pub status: &'a str,
    pub source_run_id: Option<uuid::Uuid>,
}

pub struct BillSponsorUpsert<'a> {
    pub bill_id: &'a str,
    pub bioguide_id: Option<&'a str>,
    pub sponsor_type: &'a str,
    pub sponsorship_date: Option<NaiveDate>,
    pub is_original_cosponsor: bool,
    pub source_run_id: Option<uuid::Uuid>,
}

impl Repository {
    /// Insert or update a bill row.
    pub async fn upsert_bill(&self, input: BillUpsert<'_>) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO bills
               (congress, bill_type, bill_number, bill_id, title,
                introduced_date, origin_chamber, policy_area,
                latest_action_date, latest_action_text, status, url, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
               ON CONFLICT (congress, bill_type, bill_number) DO UPDATE SET
                 bill_id            = EXCLUDED.bill_id,
                 title              = EXCLUDED.title,
                 introduced_date    = COALESCE(EXCLUDED.introduced_date, bills.introduced_date),
                 origin_chamber     = COALESCE(EXCLUDED.origin_chamber, bills.origin_chamber),
                 policy_area        = COALESCE(EXCLUDED.policy_area, bills.policy_area),
                 latest_action_date = EXCLUDED.latest_action_date,
                 latest_action_text = EXCLUDED.latest_action_text,
                 status             = EXCLUDED.status,
                 url                = COALESCE(EXCLUDED.url, bills.url),
                 source_run_id      = COALESCE(EXCLUDED.source_run_id, bills.source_run_id)"#,
        )
        .bind(input.congress)
        .bind(input.bill_type)
        .bind(input.bill_number)
        .bind(input.bill_id)
        .bind(input.title)
        .bind(input.introduced_date)
        .bind(input.origin_chamber)
        .bind(input.policy_area)
        .bind(input.latest_action_date)
        .bind(input.latest_action_text)
        .bind(input.status)
        .bind(input.url)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Upsert a bill sponsor or cosponsor row.
    pub async fn upsert_bill_sponsor(
        &self,
        input: BillSponsorUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO bill_sponsors
               (bill_id, bioguide_id, sponsor_type, sponsorship_date, is_original_cosponsor, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (bill_id, bioguide_id, sponsor_type)
               DO UPDATE SET
                 sponsorship_date     = COALESCE(EXCLUDED.sponsorship_date, bill_sponsors.sponsorship_date),
                 is_original_cosponsor = EXCLUDED.is_original_cosponsor"#,
        )
        .bind(input.bill_id)
        .bind(input.bioguide_id)
        .bind(input.sponsor_type)
        .bind(input.sponsorship_date)
        .bind(input.is_original_cosponsor)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Upsert a bill action row.
    pub async fn upsert_bill_action(
        &self,
        bill_id: &str,
        action_date: Option<NaiveDate>,
        action_text: &str,
        action_type: Option<&str>,
        chamber: Option<&str>,
        source_run_id: Option<uuid::Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO bill_actions
               (bill_id, action_date, action_text, action_type, chamber, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (bill_id, action_date, action_text)
               DO UPDATE SET
                 action_type = COALESCE(EXCLUDED.action_type, bill_actions.action_type),
                 chamber     = COALESCE(EXCLUDED.chamber, bill_actions.chamber)"#,
        )
        .bind(bill_id)
        .bind(action_date)
        .bind(action_text)
        .bind(action_type)
        .bind(chamber)
        .bind(source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Upsert a bill amendment row.
    pub async fn upsert_bill_amendment(
        &self,
        input: BillAmendmentUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO bill_amendments
               (bill_id, congress, bill_type, bill_number, amendment_number,
                description, amendment_type, sponsor_name, sponsor_bioguide_id,
                introduced_date, latest_action_date, latest_action_text,
                chamber, status, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
               ON CONFLICT (bill_id, amendment_number) DO UPDATE SET
                 description        = COALESCE(EXCLUDED.description, bill_amendments.description),
                 amendment_type     = COALESCE(EXCLUDED.amendment_type, bill_amendments.amendment_type),
                 sponsor_name       = COALESCE(EXCLUDED.sponsor_name, bill_amendments.sponsor_name),
                 sponsor_bioguide_id = COALESCE(EXCLUDED.sponsor_bioguide_id, bill_amendments.sponsor_bioguide_id),
                 introduced_date    = COALESCE(EXCLUDED.introduced_date, bill_amendments.introduced_date),
                 latest_action_date = EXCLUDED.latest_action_date,
                 latest_action_text = EXCLUDED.latest_action_text,
                 chamber            = COALESCE(EXCLUDED.chamber, bill_amendments.chamber),
                 status             = EXCLUDED.status,
                 source_run_id      = COALESCE(EXCLUDED.source_run_id, bill_amendments.source_run_id)"#,
        )
        .bind(input.bill_id)
        .bind(input.congress)
        .bind(input.bill_type)
        .bind(input.bill_number)
        .bind(input.amendment_number)
        .bind(input.description)
        .bind(input.amendment_type)
        .bind(input.sponsor_name)
        .bind(input.sponsor_bioguide_id)
        .bind(input.introduced_date)
        .bind(input.latest_action_date)
        .bind(input.latest_action_text)
        .bind(input.chamber)
        .bind(input.status)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Upsert a bill subject tag.
    pub async fn upsert_bill_subject(
        &self,
        bill_id: &str,
        subject: &str,
        source_run_id: Option<uuid::Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO bill_subjects (bill_id, subject, source_run_id)
               VALUES ($1, $2, $3)
               ON CONFLICT (bill_id, subject) DO NOTHING"#,
        )
        .bind(bill_id)
        .bind(subject)
        .bind(source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Upsert a bill text version.
    pub async fn upsert_bill_text_version(
        &self,
        bill_id: &str,
        version_code: Option<&str>,
        version_name: Option<&str>,
        format: Option<&str>,
        url: &str,
        source_run_id: Option<uuid::Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO bill_text_versions
               (bill_id, version_code, version_name, format, url, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (bill_id, version_code, format, url)
               DO UPDATE SET
                 version_name = COALESCE(EXCLUDED.version_name, bill_text_versions.version_name)"#,
        )
        .bind(bill_id)
        .bind(version_code)
        .bind(version_name)
        .bind(format)
        .bind(url)
        .bind(source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Fetch a complete bill intelligence profile by bill_id.
    pub async fn get_bill(&self, bill_id: &str) -> Result<Option<BillIntel>, sqlx::Error> {
        // Load bill info
        let bill_row: Option<BillRow> = sqlx::query_as::<_, BillRow>(
            r#"SELECT congress, bill_type, bill_number, bill_id, title,
                      introduced_date, origin_chamber, policy_area,
                      latest_action_date, latest_action_text, status, url
               FROM bills
               WHERE bill_id = $1"#,
        )
        .bind(bill_id)
        .fetch_optional(self.pool())
        .await?;

        let row = match bill_row {
            Some(r) => r,
            None => return Ok(None),
        };

        let bill_info = BillInfo {
            congress: row.congress,
            bill_type: row.bill_type,
            bill_number: row.bill_number,
            bill_id: row.bill_id.clone(),
            title: row.title,
            introduced_date: row.introduced_date,
            origin_chamber: row.origin_chamber,
            policy_area: row.policy_area.clone(),
            latest_action_date: row.latest_action_date,
            latest_action_text: row.latest_action_text,
            status: row.status,
            url: row.url,
        };

        // Actions
        let actions: Vec<BillAction> = sqlx::query_as::<_, ActionRow>(
            "SELECT action_date, action_text, action_type, chamber
             FROM bill_actions
             WHERE bill_id = $1
             ORDER BY action_date NULLS LAST, action_text ASC",
        )
        .bind(bill_id)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|a| BillAction {
            action_date: a.action_date,
            action_text: a.action_text,
            action_type: a.action_type,
            chamber: a.chamber,
        })
        .collect();

        // Sponsors
        let sponsor_rows: Vec<SponsorRow> = sqlx::query_as::<_, SponsorRow>(
            "SELECT bioguide_id, sponsor_type, sponsorship_date, is_original_cosponsor
             FROM bill_sponsors
             WHERE bill_id = $1
             ORDER BY sponsor_type ASC, sponsorship_date ASC",
        )
        .bind(bill_id)
        .fetch_all(self.pool())
        .await?;

        let mut sponsors = Vec::new();
        let mut cosponsors = Vec::new();
        for s in sponsor_rows {
            let name = if let Some(ref bid) = s.bioguide_id {
                // Try to get the member name
                let name_row: Option<(String, String)> = sqlx::query_as(
                    "SELECT first_name, last_name FROM members WHERE bioguide_id = $1",
                )
                .bind(bid)
                .fetch_optional(self.pool())
                .await?;
                name_row
                    .map(|(f, l)| format!("{} {}", f, l))
                    .unwrap_or_else(|| bid.clone())
            } else {
                "Unknown".to_string()
            };

            let info = BillSponsorInfo {
                bioguide_id: s.bioguide_id.clone(),
                name,
                sponsor_type: s.sponsor_type.clone(),
                is_original_cosponsor: s.is_original_cosponsor,
            };
            if s.sponsor_type == "sponsor" {
                sponsors.push(info);
            } else {
                cosponsors.push(info);
            }
        }

        // Subjects
        let subject_rows: Vec<(String,)> =
            sqlx::query_as("SELECT subject FROM bill_subjects WHERE bill_id = $1 ORDER BY subject")
                .bind(bill_id)
                .fetch_all(self.pool())
                .await?;
        let subjects: Vec<String> = subject_rows.into_iter().map(|s| s.0).collect();

        // Text versions
        let text_versions: Vec<BillTextVersion> = sqlx::query_as::<_, TextVersionRow>(
            "SELECT version_code, version_name, format, url
             FROM bill_text_versions
             WHERE bill_id = $1
             ORDER BY version_code NULLS LAST",
        )
        .bind(bill_id)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|t| BillTextVersion {
            version_code: t.version_code,
            version_name: t.version_name,
            format: t.format,
            url: t.url,
        })
        .collect();

        // Related votes
        let related_votes: Vec<VoteInfo> = sqlx::query_as::<_, VoteInfoRow>(
            "SELECT vote_id, congress, chamber, roll_number, vote_date, question, result
             FROM roll_call_votes
             WHERE bill_id = $1
             ORDER BY vote_date DESC NULLS LAST",
        )
        .bind(bill_id)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|v| VoteInfo {
            vote_id: v.vote_id,
            congress: v.congress,
            chamber: v.chamber,
            roll_number: v.roll_number,
            vote_date: v.vote_date,
            question: v.question,
            result: v.result,
        })
        .collect();

        // Normalized Congress.gov amendments are part of the canonical bill
        // intelligence contract, not a second page-specific data source.
        let amendments = self.get_bill_amendments(bill_id).await?;

        // Funding overlay from sponsors/cosponsors
        let funding_overlay = self.build_funding_overlay(&sponsors, &cosponsors).await?;

        // Lobbying overlay (heuristic keyword match)
        let lobbying_overlay = self
            .find_lobbying_by_subject_for_bill(&row.policy_area, &subjects, bill_id)
            .await?;

        // LDA-to-bill links from relationship_evidence
        let lobbying_bill_links = self.get_bill_lobbying_links(bill_id).await?;

        let provenance = ProvenanceSummary {
            sources: vec![ProvenanceSource {
                source: "congress_gov".to_string(),
                status: "loaded".to_string(),
                fetched_at: None,
                confidence: Some("verified".to_string()),
            }],
            warnings: Vec::new(),
        };

        Ok(Some(BillIntel {
            bill: bill_info,
            actions,
            sponsors,
            cosponsors,
            subjects,
            text_versions,
            related_votes,
            amendments,
            funding_overlay,
            lobbying_overlay,
            lobbying_bill_links,
            provenance,
        }))
    }

    /// Search bills by full-text query.
    pub async fn search_bills(
        &self,
        query: &str,
        limit: i64,
    ) -> Result<Vec<BillInfo>, sqlx::Error> {
        let pattern = format!("%{}%", query);
        let rows: Vec<BillRow> = sqlx::query_as::<_, BillRow>(
            r#"SELECT congress, bill_type, bill_number, bill_id, title,
                      introduced_date, origin_chamber, policy_area,
                      latest_action_date, latest_action_text, status, url
               FROM bills
               WHERE title ILIKE $1
                  OR bill_id ILIKE $1
               ORDER BY latest_action_date DESC NULLS LAST
               LIMIT $2"#,
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(self.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| BillInfo {
                congress: r.congress,
                bill_type: r.bill_type,
                bill_number: r.bill_number,
                bill_id: r.bill_id,
                title: r.title,
                introduced_date: r.introduced_date,
                origin_chamber: r.origin_chamber,
                policy_area: r.policy_area,
                latest_action_date: r.latest_action_date,
                latest_action_text: r.latest_action_text,
                status: r.status,
                url: r.url,
            })
            .collect())
    }

    /// Find bills sponsored or cosponsored by a given member.
    pub async fn find_bills_by_sponsor(
        &self,
        bioguide_id: &str,
        limit: i64,
    ) -> Result<Vec<BillInfo>, sqlx::Error> {
        let rows: Vec<BillRow> = sqlx::query_as::<_, BillRow>(
            r#"SELECT b.congress, b.bill_type, b.bill_number, b.bill_id, b.title,
                      b.introduced_date, b.origin_chamber, b.policy_area,
                      b.latest_action_date, b.latest_action_text, b.status, b.url
               FROM bills b
               JOIN bill_sponsors bs ON bs.bill_id = b.bill_id
               WHERE bs.bioguide_id = $1
               ORDER BY b.latest_action_date DESC NULLS LAST
               LIMIT $2"#,
        )
        .bind(bioguide_id)
        .bind(limit)
        .fetch_all(self.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| BillInfo {
                congress: r.congress,
                bill_type: r.bill_type,
                bill_number: r.bill_number,
                bill_id: r.bill_id,
                title: r.title,
                introduced_date: r.introduced_date,
                origin_chamber: r.origin_chamber,
                policy_area: r.policy_area,
                latest_action_date: r.latest_action_date,
                latest_action_text: r.latest_action_text,
                status: r.status,
                url: r.url,
            })
            .collect())
    }

    // ── Private helpers ──────────────────────────────────────────────────

    /// Build funding overlay for all sponsors/cosponsors of a bill.
    async fn build_funding_overlay(
        &self,
        sponsors: &[BillSponsorInfo],
        cosponsors: &[BillSponsorInfo],
    ) -> Result<Vec<SponsorFundingOverlay>, sqlx::Error> {
        let mut overlay = Vec::new();

        for s in sponsors.iter().chain(cosponsors.iter()) {
            let bioguide_id = match &s.bioguide_id {
                Some(id) => id.as_str(),
                None => continue,
            };

            // Read total receipts from the materialized view
            let funding: Option<(f64,)> = sqlx::query_as(
                "SELECT COALESCE(SUM(direct_receipts), 0)::float8 FROM member_funding_cycle_mv WHERE bioguide_id = $1",
            )
            .bind(bioguide_id)
            .fetch_optional(self.pool())
            .await?;
            let total_receipts = funding.map(|(v,)| v).unwrap_or(0.0);

            // Top networks
            let net_rows: Vec<(String, f64, String)> = sqlx::query_as(
                "SELECT network_slug,
                        COALESCE(SUM(direct_amount + support_ie_amount + oppose_ie_amount), 0)::float8,
                        'source_backed'::text
                 FROM influence_network_member_mv
                 WHERE bioguide_id = $1
                 GROUP BY network_slug
                 ORDER BY 2 DESC
                 LIMIT 5",
            )
            .bind(bioguide_id)
            .fetch_all(self.pool())
            .await?;

            let top_networks: Vec<NetworkAmount> = net_rows
                .into_iter()
                .map(|(slug, amount, conf)| NetworkAmount {
                    network_slug: slug,
                    amount,
                    confidence: conf,
                })
                .collect();

            // Get member name for reference
            let name = s.name.clone();

            // Get nominate_dim1
            let nom: Option<(Option<f64>,)> =
                sqlx::query_as("SELECT nominate_dim1 FROM members WHERE bioguide_id = $1")
                    .bind(bioguide_id)
                    .fetch_optional(self.pool())
                    .await?;

            let data_quality = if top_networks.is_empty() && total_receipts == 0.0 {
                "missing_crosswalk".to_string()
            } else {
                "complete".to_string()
            };

            overlay.push(SponsorFundingOverlay {
                bioguide_id: bioguide_id.to_string(),
                name,
                total_receipts,
                top_networks,
                nominate_dim1: nom.and_then(|(v,)| v),
                data_quality,
            });
        }

        Ok(overlay)
    }

    /// Heuristic lobbying match: match bill policy_area and subjects against lobbying
    /// activities by keyword.
    async fn find_lobbying_by_subject_for_bill(
        &self,
        policy_area: &Option<String>,
        subjects: &[String],
        _bill_id: &str,
    ) -> Result<Vec<LobbyingMatch>, sqlx::Error> {
        let mut keywords: Vec<String> = Vec::new();
        if let Some(pa) = policy_area {
            keywords.push(pa.to_lowercase());
        }
        for s in subjects {
            for word in s.split_whitespace() {
                let clean = word.trim_matches(|c: char| !c.is_alphanumeric());
                if clean.len() > 3 && !keywords.contains(&clean.to_lowercase()) {
                    keywords.push(clean.to_lowercase());
                }
            }
        }
        if keywords.is_empty() {
            return Ok(Vec::new());
        }

        let mut matches = Vec::new();
        for kw in &keywords {
            let rows: Vec<LobbyingMatchRow> = sqlx::query_as::<_, LobbyingMatchRow>(
                r#"SELECT la.filing_uuid, lr.name AS registrant_name, lc.name AS client_name,
                          la.issue_code, la.issue_display
                   FROM lobbying_activities la
                   JOIN lobbying_filings lf ON lf.filing_uuid = la.filing_uuid
                   JOIN lobbying_registrants lr ON lr.id = lf.registrant_id
                   JOIN lobbying_clients lc ON lc.id = lf.client_id
                   WHERE la.issue_display ILIKE $1
                      OR la.description ILIKE $1
                   LIMIT 3"#,
            )
            .bind(format!("%{}%", kw))
            .fetch_all(self.pool())
            .await?;

            for r in rows {
                matches.push(LobbyingMatch {
                    filing_uuid: r.filing_uuid,
                    registrant_name: r.registrant_name,
                    client_name: r.client_name,
                    issue_code: r.issue_code,
                    issue_display: r.issue_display,
                    matched_keyword: kw.clone(),
                    confidence: "heuristic".to_string(),
                });
            }
        }
        Ok(matches)
    }

    /// Query amendments for a given bill from the bill_amendments table.
    pub async fn get_bill_amendments(
        &self,
        bill_id: &str,
    ) -> Result<Vec<BillAmendment>, sqlx::Error> {
        sqlx::query_as::<_, BillAmendment>(
            r#"SELECT bill_id, congress, bill_type, bill_number,
                      amendment_number, description, amendment_type,
                      sponsor_name, sponsor_bioguide_id,
                      introduced_date, latest_action_date, latest_action_text,
                      chamber, status
               FROM bill_amendments
               WHERE bill_id = $1
               ORDER BY latest_action_date DESC NULLS LAST, amendment_number ASC"#,
        )
        .bind(bill_id)
        .fetch_all(self.pool())
        .await
    }
}

// ── Private row types ───────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct BillRow {
    congress: i32,
    bill_type: String,
    bill_number: i32,
    bill_id: String,
    title: String,
    introduced_date: Option<NaiveDate>,
    origin_chamber: Option<String>,
    policy_area: Option<String>,
    latest_action_date: Option<NaiveDate>,
    latest_action_text: Option<String>,
    status: String,
    url: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ActionRow {
    action_date: Option<NaiveDate>,
    action_text: String,
    action_type: Option<String>,
    chamber: Option<String>,
}

#[derive(sqlx::FromRow)]
struct SponsorRow {
    bioguide_id: Option<String>,
    sponsor_type: String,
    is_original_cosponsor: bool,
}

#[derive(sqlx::FromRow)]
struct TextVersionRow {
    version_code: Option<String>,
    version_name: Option<String>,
    format: Option<String>,
    url: String,
}

#[derive(sqlx::FromRow)]
struct VoteInfoRow {
    vote_id: String,
    congress: i32,
    chamber: String,
    roll_number: i32,
    vote_date: Option<NaiveDate>,
    question: String,
    result: String,
}

#[derive(sqlx::FromRow)]
struct LobbyingMatchRow {
    filing_uuid: String,
    registrant_name: String,
    client_name: String,
    issue_code: Option<String>,
    issue_display: Option<String>,
}

// ── Public row types ────────────────────────────────────────────────────
