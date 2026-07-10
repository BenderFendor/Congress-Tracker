use crate::models::{
    CommitteeAssignment, MemberProfile, MemberTerm, PartyHistory, ProvenanceSource,
    ProvenanceSummary, SocialAccount,
};
use crate::normalize::{normalize_chamber, normalize_party, normalize_state};
use crate::repository::Repository;
use chrono::NaiveDate;
use std::collections::HashMap;

pub struct MemberUpsert<'a> {
    pub bioguide_id: &'a str,
    pub first_name: &'a str,
    pub middle_name: &'a str,
    pub last_name: &'a str,
    pub suffix: &'a str,
    pub official_full_name: &'a str,
    pub birthday: Option<NaiveDate>,
    pub gender: Option<&'a str>,
    pub current_party: &'a str,
    pub current_state: &'a str,
    pub current_district: &'a str,
    pub current_chamber: &'a str,
    pub in_office: bool,
    pub depiction_url: Option<&'a str>,
    pub website_url: Option<&'a str>,
    pub contact_form: Option<&'a str>,
    pub office_address: Option<&'a str>,
    pub phone: Option<&'a str>,
    pub hometown: Option<&'a str>,
    pub birthplace: Option<&'a str>,
    pub education: serde_json::Value,
    pub prior_employment: serde_json::Value,
    pub nominate_dim1: Option<f64>,
    pub nominate_dim2: Option<f64>,
    pub source_run_id: Option<uuid::Uuid>,
}

pub struct MemberTermUpsert<'a> {
    pub bioguide_id: &'a str,
    pub chamber: &'a str,
    pub state: &'a str,
    pub district: Option<&'a str>,
    pub party: &'a str,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub senate_class: Option<i32>,
    pub how: Option<&'a str>,
    pub source: &'a str,
    pub source_run_id: Option<uuid::Uuid>,
}

pub struct CommitteeAssignmentUpsert<'a> {
    pub committee_id: &'a str,
    pub bioguide_id: &'a str,
    pub congress: i32,
    pub chamber: &'a str,
    pub rank: Option<i32>,
    pub title: Option<&'a str>,
    pub party: Option<&'a str>,
    pub source_run_id: Option<uuid::Uuid>,
}

impl Repository {
    /// Insert or update a member row.
    pub async fn upsert_member(&self, input: MemberUpsert<'_>) -> Result<(), sqlx::Error> {
        let norm_party = normalize_party(input.current_party);
        let norm_state = normalize_state(input.current_state);
        let norm_chamber = normalize_chamber(input.current_chamber);
        sqlx::query(
            r#"INSERT INTO members (
                bioguide_id, first_name, middle_name, last_name, suffix,
                official_full_name, birthday, gender,
                current_party, current_state, current_district, current_chamber, in_office,
                depiction_url, website_url, contact_form, office_address, phone,
                hometown, birthplace, education, prior_employment,
                nominate_dim1, nominate_dim2, last_source_run_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                      $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
            ON CONFLICT (bioguide_id) DO UPDATE SET
                first_name         = COALESCE(NULLIF(EXCLUDED.first_name, ''), members.first_name),
                middle_name        = COALESCE(NULLIF(EXCLUDED.middle_name, ''), members.middle_name),
                last_name          = COALESCE(NULLIF(EXCLUDED.last_name, ''), members.last_name),
                suffix             = COALESCE(NULLIF(EXCLUDED.suffix, ''), members.suffix),
                official_full_name = COALESCE(NULLIF(EXCLUDED.official_full_name, ''), members.official_full_name),
                birthday           = COALESCE(EXCLUDED.birthday, members.birthday),
                gender             = COALESCE(EXCLUDED.gender, members.gender),
                current_party      = COALESCE(NULLIF(EXCLUDED.current_party, 'Unknown'), members.current_party),
                current_state      = COALESCE(NULLIF(EXCLUDED.current_state, ''), members.current_state),
                current_district   = COALESCE(NULLIF(EXCLUDED.current_district, ''), members.current_district),
                current_chamber    = COALESCE(NULLIF(EXCLUDED.current_chamber, ''), members.current_chamber),
                in_office          = EXCLUDED.in_office,
                depiction_url      = COALESCE(EXCLUDED.depiction_url, members.depiction_url),
                website_url        = COALESCE(EXCLUDED.website_url, members.website_url),
                contact_form       = COALESCE(EXCLUDED.contact_form, members.contact_form),
                office_address     = COALESCE(EXCLUDED.office_address, members.office_address),
                phone              = COALESCE(EXCLUDED.phone, members.phone),
                hometown           = COALESCE(EXCLUDED.hometown, members.hometown),
                birthplace         = COALESCE(EXCLUDED.birthplace, members.birthplace),
                education          = EXCLUDED.education,
                prior_employment   = EXCLUDED.prior_employment,
                nominate_dim1      = COALESCE(EXCLUDED.nominate_dim1, members.nominate_dim1),
                nominate_dim2      = COALESCE(EXCLUDED.nominate_dim2, members.nominate_dim2),
                updated_at         = now(),
                last_source_run_id      = COALESCE(EXCLUDED.last_source_run_id, members.last_source_run_id)"#,
        )
        .bind(input.bioguide_id)
        .bind(input.first_name)
        .bind(input.middle_name)
        .bind(input.last_name)
        .bind(input.suffix)
        .bind(input.official_full_name)
        .bind(input.birthday)
        .bind(input.gender)
        .bind(&*norm_party)
        .bind(&*norm_state)
        .bind(input.current_district)
        .bind(&*norm_chamber)
        .bind(input.in_office)
        .bind(input.depiction_url)
        .bind(input.website_url)
        .bind(input.contact_form)
        .bind(input.office_address)
        .bind(input.phone)
        .bind(input.hometown)
        .bind(input.birthplace)
        .bind(input.education)
        .bind(input.prior_employment)
        .bind(input.nominate_dim1)
        .bind(input.nominate_dim2)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Fetch a full member profile by Bioguide ID, joining related tables.
    pub async fn get_member(
        &self,
        bioguide_id: &str,
    ) -> Result<Option<MemberProfile>, sqlx::Error> {
        // Load main member row
        let member_row: Option<MemberRow> = sqlx::query_as::<_, MemberRow>(
            "SELECT bioguide_id, first_name, middle_name, last_name, suffix,
                    official_full_name, birthday, gender,
                    current_party, current_state, current_district, current_chamber, in_office,
                    depiction_url, website_url, contact_form, office_address, phone,
                    years_in_office, hometown, birthplace, education, prior_employment,
                    nominate_dim1::double precision AS nominate_dim1,
                    nominate_dim2::double precision AS nominate_dim2
             FROM members
             WHERE bioguide_id = $1",
        )
        .bind(bioguide_id)
        .fetch_optional(self.pool())
        .await?;

        let row = match member_row {
            Some(r) => r,
            None => return Ok(None),
        };

        // Load terms
        let terms: Vec<MemberTerm> = sqlx::query_as::<_, TermRow>(
            "SELECT chamber, state, district, party, start_date, end_date, senate_class, how
             FROM member_terms
             WHERE bioguide_id = $1
             ORDER BY start_date DESC",
        )
        .bind(bioguide_id)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|t| MemberTerm {
            chamber: t.chamber,
            state: t.state,
            district: t.district,
            party: t.party,
            start_date: t.start_date,
            end_date: t.end_date,
            senate_class: t.senate_class,
            how: t.how,
        })
        .collect();

        // Load identifiers
        let ident_rows: Vec<IdentRow> = sqlx::query_as::<_, IdentRow>(
            "SELECT scheme, value
             FROM member_identifiers
             WHERE bioguide_id = $1
             ORDER BY scheme, value",
        )
        .bind(bioguide_id)
        .fetch_all(self.pool())
        .await?;

        let mut identifiers: HashMap<String, Vec<String>> = HashMap::new();
        for ir in &ident_rows {
            identifiers
                .entry(ir.scheme.clone())
                .or_default()
                .push(ir.value.clone());
        }

        // Load social accounts
        let social_accounts: Vec<SocialAccount> = sqlx::query_as::<_, SocialRow>(
            "SELECT platform, handle, official
             FROM social_accounts
             WHERE bioguide_id = $1
             ORDER BY platform",
        )
        .bind(bioguide_id)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|s| SocialAccount {
            platform: s.platform,
            handle: s.handle,
            official: s.official,
        })
        .collect();

        // Load committees
        let committees: Vec<CommitteeAssignment> = sqlx::query_as::<_, CommRow>(
            r#"SELECT cm.committee_id, c.name, c.chamber, cm.rank, cm.title, cm.congress
               FROM committee_memberships cm
               JOIN committees c ON c.committee_id = cm.committee_id
               WHERE cm.bioguide_id = $1
               ORDER BY cm.congress DESC, cm.rank NULLS LAST"#,
        )
        .bind(bioguide_id)
        .fetch_all(self.pool())
        .await?
        .into_iter()
        .map(|cr| CommitteeAssignment {
            bioguide_id: None,
            first_name: None,
            last_name: None,
            party: None,
            state: None,
            district: None,
            committee_id: Some(cr.committee_id),
            name: Some(cr.name),
            chamber: Some(cr.chamber),
            rank: cr.rank,
            title: cr.title,
            congress: Some(cr.congress),
        })
        .collect();

        // Compute service_start, current_term_end from terms
        let service_start = terms.iter().map(|t| t.start_date).min();
        let current_term_end: Option<NaiveDate> = None; // computed separately from term data when available

        // Build party_history (unique party entries with bounds)
        let mut party_history: Vec<PartyHistory> = Vec::new();
        let mut seen_parties: Vec<String> = Vec::new();
        for t in &terms {
            if !seen_parties.contains(&t.party) {
                seen_parties.push(t.party.clone());
                party_history.push(PartyHistory {
                    party: t.party.clone(),
                    start: Some(t.start_date),
                    end: t.end_date,
                });
            } else {
                // Update end date for matching party
                if let Some(p) = party_history.iter_mut().find(|p| p.party == t.party) {
                    if let Some(ed) = t.end_date {
                        if p.end.is_none_or(|existing| ed > existing) {
                            p.end = Some(ed);
                        }
                    } else {
                        p.end = None; // Active term
                    }
                }
            }
        }

        // Compute age
        let age = row.birthday.map(|bd| {
            let today = chrono::Utc::now().date_naive();
            (today - bd).num_days() as i32 / 365
        });

        // Build provenance
        let provenance = ProvenanceSummary {
            sources: vec![ProvenanceSource {
                source: "members".to_string(),
                status: "loaded".to_string(),
                fetched_at: None,
                confidence: Some("verified".to_string()),
            }],
            warnings: Vec::new(),
        };

        Ok(Some(MemberProfile {
            bioguide_id: row.bioguide_id,
            first_name: row.first_name,
            middle_name: row.middle_name,
            last_name: row.last_name,
            suffix: row.suffix,
            official_full_name: row.official_full_name,
            birthday: row.birthday,
            age,
            gender: row.gender,
            current_party: row.current_party,
            current_state: row.current_state,
            current_district: row.current_district,
            current_chamber: row.current_chamber,
            in_office: row.in_office,
            depiction_url: row.depiction_url,
            website_url: row.website_url,
            contact_form: row.contact_form,
            office_address: row.office_address,
            phone: row.phone,
            years_in_office: row.years_in_office,
            service_start,
            current_term_end,
            next_election: None, // computed separately when needed
            party_history,
            terms,
            identifiers,
            education: row.education,
            prior_employment: row.prior_employment,
            hometown: row.hometown,
            birthplace: row.birthplace,
            nominate_dim1: row.nominate_dim1,
            nominate_dim2: row.nominate_dim2,
            biography_summary: None,
            biography_full: None,
            committees,
            social_accounts,
            provenance,
        }))
    }

    /// Search members by full-text tsvector query, falling back to ILIKE.
    pub async fn search_members(
        &self,
        query: &str,
        limit: i64,
    ) -> Result<Vec<MemberProfile>, sqlx::Error> {
        // Try full-text search first
        let results = self.search_members_tsquery(query, limit).await?;
        if !results.is_empty() {
            return Ok(results);
        }
        // Fallback to ILIKE
        self.search_members_ilike(query, limit).await
    }

    /// Full-text search using PostgreSQL tsvector on members.
    async fn search_members_tsquery(
        &self,
        query: &str,
        limit: i64,
    ) -> Result<Vec<MemberProfile>, sqlx::Error> {
        let pattern = query
            .split_whitespace()
            .map(|w| format!("{}:*", w))
            .collect::<Vec<_>>()
            .join(" & ");

        let rows: Vec<MemberRow> = sqlx::query_as::<_, MemberRow>(
            "SELECT bioguide_id, first_name, middle_name, last_name, suffix,
                    official_full_name, birthday, gender,
                    current_party, current_state, current_district, current_chamber, in_office,
                    depiction_url, website_url, contact_form, office_address, phone,
                    years_in_office, hometown, birthplace, education, prior_employment,
                    nominate_dim1::double precision AS nominate_dim1,
                    nominate_dim2::double precision AS nominate_dim2
             FROM members
             WHERE to_tsvector('english', official_full_name || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
                   @@ to_tsquery('english', $1)
             ORDER BY in_office DESC, last_name ASC
             LIMIT $2",
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(self.pool())
        .await?;

        self.member_rows_to_profiles(rows).await
    }

    /// ILIKE fallback member search.
    async fn search_members_ilike(
        &self,
        query: &str,
        limit: i64,
    ) -> Result<Vec<MemberProfile>, sqlx::Error> {
        let pattern = format!("%{}%", query);
        let rows: Vec<MemberRow> = sqlx::query_as::<_, MemberRow>(
            "SELECT bioguide_id, first_name, middle_name, last_name, suffix,
                    official_full_name, birthday, gender,
                    current_party, current_state, current_district, current_chamber, in_office,
                    depiction_url, website_url, contact_form, office_address, phone,
                    years_in_office, hometown, birthplace, education, prior_employment,
                    nominate_dim1::double precision AS nominate_dim1,
                    nominate_dim2::double precision AS nominate_dim2
             FROM members
             WHERE official_full_name ILIKE $1
                OR first_name ILIKE $1
                OR last_name ILIKE $1
             ORDER BY in_office DESC, last_name ASC
             LIMIT $2",
        )
        .bind(&pattern)
        .bind(limit)
        .fetch_all(self.pool())
        .await?;

        self.member_rows_to_profiles(rows).await
    }

    /// List members with optional chamber/state filters.
    pub async fn list_members(
        &self,
        chamber: Option<&str>,
        state: Option<&str>,
        limit: i64,
    ) -> Result<Vec<MemberProfile>, sqlx::Error> {
        let rows: Vec<MemberRow> = sqlx::query_as::<_, MemberRow>(
            "SELECT bioguide_id, first_name, middle_name, last_name, suffix,
                    official_full_name, birthday, gender,
                    current_party, current_state, current_district, current_chamber, in_office,
                    depiction_url, website_url, contact_form, office_address, phone,
                    years_in_office, hometown, birthplace, education, prior_employment,
                    nominate_dim1::double precision AS nominate_dim1,
                    nominate_dim2::double precision AS nominate_dim2
             FROM members
             WHERE ($1::text IS NULL OR current_chamber = $1)
               AND ($2::text IS NULL OR current_state = $2)
             ORDER BY in_office DESC, last_name ASC, first_name ASC
             LIMIT $3",
        )
        .bind(chamber)
        .bind(state)
        .bind(limit)
        .fetch_all(self.pool())
        .await?;

        self.member_rows_to_profiles(rows).await
    }

    // -- Helper to convert MemberRow rows to MemberProfile --

    async fn member_rows_to_profiles(
        &self,
        rows: Vec<MemberRow>,
    ) -> Result<Vec<MemberProfile>, sqlx::Error> {
        let mut profiles = Vec::with_capacity(rows.len());
        for row in rows {
            // Delegate to get_member for full profile with joins
            if let Some(profile) = self.get_member(&row.bioguide_id).await? {
                profiles.push(profile);
            }
        }
        Ok(profiles)
    }

    // ── Term, identifier, social, committee helpers ────────────────────────

    /// Upsert a member term row.
    pub async fn upsert_member_term(&self, input: MemberTermUpsert<'_>) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO member_terms
               (bioguide_id, chamber, state, district, party, start_date, end_date, senate_class, how, source, source_run_id)
               VALUES ($1, $2, $3, COALESCE($4, ''), $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (bioguide_id, chamber, state, district, start_date)
               DO UPDATE SET
                 party       = EXCLUDED.party,
                 end_date    = EXCLUDED.end_date,
                 senate_class = COALESCE(EXCLUDED.senate_class, member_terms.senate_class),
                 how         = COALESCE(EXCLUDED.how, member_terms.how)"#,
        )
        .bind(input.bioguide_id)
        .bind(input.chamber)
        .bind(input.state)
        .bind(input.district)
        .bind(input.party)
        .bind(input.start_date)
        .bind(input.end_date)
        .bind(input.senate_class)
        .bind(input.how)
        .bind(input.source)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Upsert a member identifier crosswalk entry.
    pub async fn upsert_member_identifier(
        &self,
        bioguide_id: &str,
        scheme: &str,
        value: &str,
        source_run_id: Option<uuid::Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO member_identifiers (bioguide_id, scheme, value, source_run_id)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (bioguide_id, scheme, value) DO NOTHING"#,
        )
        .bind(bioguide_id)
        .bind(scheme)
        .bind(value)
        .bind(source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Upsert a social account row for a member.
    pub async fn upsert_social_account(
        &self,
        bioguide_id: &str,
        platform: &str,
        handle: &str,
        official: bool,
        source_run_id: Option<uuid::Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO social_accounts (bioguide_id, platform, handle, official, source_run_id)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (bioguide_id, platform)
               DO UPDATE SET handle = EXCLUDED.handle, official = EXCLUDED.official"#,
        )
        .bind(bioguide_id)
        .bind(platform)
        .bind(handle)
        .bind(official)
        .bind(source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Upsert a committee assignment (committee_memberships) for a member.
    pub async fn upsert_committee_assignment(
        &self,
        input: CommitteeAssignmentUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO committee_memberships
               (committee_id, bioguide_id, congress, chamber, rank, title, party, source_run_id)
               VALUES ($1, $2, $3, $4, $5, COALESCE($6, ''), $7, $8)
               ON CONFLICT (committee_id, bioguide_id, congress, title)
               DO UPDATE SET
                 rank     = COALESCE(EXCLUDED.rank, committee_memberships.rank),
                 chamber  = EXCLUDED.chamber,
                 party    = COALESCE(EXCLUDED.party, committee_memberships.party)"#,
        )
        .bind(input.committee_id)
        .bind(input.bioguide_id)
        .bind(input.congress)
        .bind(input.chamber)
        .bind(input.rank)
        .bind(input.title)
        .bind(input.party)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Get committee assignments for a member, with committee names.
    pub async fn get_member_committees(
        &self,
        bioguide_id: &str,
    ) -> Result<Vec<CommitteeAssignment>, sqlx::Error> {
        let rows: Vec<CommRow> = sqlx::query_as::<_, CommRow>(
            r#"SELECT cm.committee_id, c.name, c.chamber, cm.rank, cm.title, cm.congress
               FROM committee_memberships cm
               JOIN committees c ON c.committee_id = cm.committee_id
               WHERE cm.bioguide_id = $1
               ORDER BY cm.congress DESC, cm.rank NULLS LAST"#,
        )
        .bind(bioguide_id)
        .fetch_all(self.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| CommitteeAssignment {
                bioguide_id: None,
                first_name: None,
                last_name: None,
                party: None,
                state: None,
                district: None,
                committee_id: Some(r.committee_id),
                name: Some(r.name),
                chamber: Some(r.chamber),
                rank: r.rank,
                title: r.title,
                congress: Some(r.congress),
            })
            .collect())
    }

    /// Find a member's bioguide_id by an identifier scheme/value pair.
    pub async fn find_member_by_identifier(
        &self,
        scheme: &str,
        value: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT bioguide_id FROM member_identifiers WHERE scheme = $1 AND value = $2",
        )
        .bind(scheme)
        .bind(value)
        .fetch_optional(self.pool())
        .await?;

        Ok(row.map(|r| r.0))
    }

    /// Resolve a member's bioguide_id by first and last name.
    /// Uses case-insensitive exact matching.
    pub async fn find_bioguide_by_name(
        &self,
        first_name: &str,
        last_name: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT bioguide_id FROM members WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2) LIMIT 1",
        )
        .bind(first_name)
        .bind(last_name)
        .fetch_optional(self.pool())
        .await?;

        Ok(row.map(|r| r.0))
    }

    /// Get a member's identifier value for a given scheme.
    pub async fn get_member_identifier(
        &self,
        bioguide_id: &str,
        scheme: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT value FROM member_identifiers WHERE bioguide_id = $1 AND scheme = $2 LIMIT 1",
        )
        .bind(bioguide_id)
        .bind(scheme)
        .fetch_optional(self.pool())
        .await?;
        Ok(row.map(|r| r.0))
    }

    /// Fetch a Wikidata entity description (English).
    /// Uses wikidata_id like "Q4733597".
    /// Returns the short description (e.g. "American politician").
    pub async fn fetch_wikidata_bio(
        &self,
        wikidata_id: &str,
    ) -> Result<Option<String>, Box<dyn std::error::Error>> {
        let url = format!(
            "https://www.wikidata.org/wiki/Special:EntityData/{}.json",
            wikidata_id
        );
        let client = reqwest::Client::builder()
            .user_agent("CongressTracker/0.1 (mailto:dev@example.com)")
            .timeout(std::time::Duration::from_secs(10))
            .build()?;
        let resp = client.get(&url).send().await?;
        if !resp.status().is_success() {
            return Ok(None);
        }
        let body: serde_json::Value = resp.json().await?;
        // Navigate: entities -> {id} -> descriptions -> en -> value
        let description = body
            .get("entities")
            .and_then(|e| e.get(wikidata_id))
            .and_then(|e| e.get("descriptions"))
            .and_then(|d| d.get("en"))
            .and_then(|v| v.get("value"))
            .and_then(|v| v.as_str());

        Ok(description.map(|s| s.to_string()))
    }

    /// Fetch the English Wikipedia extract for a member given their Wikidata ID.
    /// Uses the Wikipedia REST API after resolving the page title from Wikidata.
    /// Returns a paragraph-length summary.
    pub async fn fetch_wikipedia_extract(
        &self,
        wikidata_id: &str,
    ) -> Result<Option<String>, Box<dyn std::error::Error>> {
        // First, resolve the English Wikipedia page title from Wikidata
        let wikidata_url = format!(
            "https://www.wikidata.org/wiki/Special:EntityData/{}.json",
            wikidata_id
        );
        let client = reqwest::Client::builder()
            .user_agent("CongressTracker/0.1 (mailto:dev@example.com)")
            .timeout(std::time::Duration::from_secs(15))
            .build()?;
        let wd_resp = client.get(&wikidata_url).send().await?;
        if !wd_resp.status().is_success() {
            return Ok(None);
        }
        let wd_body: serde_json::Value = wd_resp.json().await?;
        let en_title = wd_body
            .get("entities")
            .and_then(|e| e.get(wikidata_id))
            .and_then(|e| e.get("sitelinks"))
            .and_then(|s| s.get("enwiki"))
            .and_then(|s| s.get("title"))
            .and_then(|t| t.as_str());

        let Some(title) = en_title else {
            return Ok(None);
        };

        // Now fetch the Wikipedia summary
        let wiki_url = format!(
            "https://en.wikipedia.org/api/rest_v1/page/summary/{}",
            title.replace(' ', "_")
        );
        let resp = client.get(&wiki_url).send().await?;
        if !resp.status().is_success() {
            return Ok(None);
        }
        let body: serde_json::Value = resp.json().await?;
        let extract = body.get("extract").and_then(|v| v.as_str());

        Ok(extract.map(|s| s.to_string()))
    }
}

// ── Private row types for SQLx decoding ─────────────────────────────────

#[derive(sqlx::FromRow)]
struct MemberRow {
    bioguide_id: String,
    first_name: String,
    middle_name: String,
    last_name: String,
    suffix: String,
    official_full_name: String,
    birthday: Option<NaiveDate>,
    gender: Option<String>,
    current_party: String,
    current_state: String,
    current_district: String,
    current_chamber: String,
    in_office: bool,
    depiction_url: Option<String>,
    website_url: Option<String>,
    contact_form: Option<String>,
    office_address: Option<String>,
    phone: Option<String>,
    years_in_office: Option<f64>,
    hometown: Option<String>,
    birthplace: Option<String>,
    education: serde_json::Value,
    prior_employment: serde_json::Value,
    nominate_dim1: Option<f64>,
    nominate_dim2: Option<f64>,
}

#[derive(sqlx::FromRow)]
struct TermRow {
    chamber: String,
    state: String,
    district: Option<String>,
    party: String,
    start_date: NaiveDate,
    end_date: Option<NaiveDate>,
    senate_class: Option<i32>,
    how: Option<String>,
}

#[derive(sqlx::FromRow)]
struct IdentRow {
    scheme: String,
    value: String,
}

#[derive(sqlx::FromRow)]
struct SocialRow {
    platform: String,
    handle: String,
    official: bool,
}

#[derive(sqlx::FromRow)]
struct CommRow {
    committee_id: String,
    name: String,
    chamber: String,
    rank: Option<i32>,
    title: Option<String>,
    congress: i32,
}

#[cfg(test)]
mod tests {
    /// Test that the Wikidata API returns a description for a known legislator.
    /// Alma Adams (A000370) has wikidata_id Q4733597.
    /// This is a contract test against the live Wikidata API.
    #[tokio::test]
    #[ignore = "requires live Wikidata access"]
    async fn test_wikidata_biography_fetch() {
        // Given: A000370 has wikidata Q4733597 in member_identifiers
        let wikidata_id = "Q4733597";
        let url = format!(
            "https://www.wikidata.org/wiki/Special:EntityData/{}.json",
            wikidata_id
        );

        // When: fetching the Wikidata entity data
        let client = reqwest::Client::builder()
            .user_agent("CongressTracker/0.1 (mailto:dev@example.com)")
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("failed to build reqwest client");
        let resp = client
            .get(&url)
            .send()
            .await
            .expect("failed to reach Wikidata API");
        assert!(
            resp.status().is_success(),
            "Wikidata API returned {}",
            resp.status()
        );

        let body: serde_json::Value = resp.json().await.expect("failed to parse Wikidata JSON");

        // Navigate: entities -> Q4733597 -> descriptions -> en -> value
        let description = body
            .get("entities")
            .and_then(|e| e.get(wikidata_id))
            .and_then(|e| e.get("descriptions"))
            .and_then(|d| d.get("en"))
            .and_then(|v| v.get("value"))
            .and_then(|v| v.as_str());

        // Then: returns a non-empty biography string
        let bio = description.expect("description should exist for Q4733597");
        assert!(!bio.is_empty(), "description should not be empty");

        // Assert: bio contains "politician" or "representative" or "congress"
        let lower = bio.to_lowercase();
        assert!(
            lower.contains("politician")
                || lower.contains("representative")
                || lower.contains("congress"),
            "expected bio to contain 'politician', 'representative', or 'congress', got: {}",
            bio
        );
    }
}
