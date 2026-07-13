use crate::models::{LobbyingEntityInfo, LobbyingMatch};
use crate::repository::Repository;
use chrono::{DateTime, Utc};

pub struct LobbyingRegistrantUpsert<'a> {
    pub id: i64,
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub state: Option<&'a str>,
    pub country: Option<&'a str>,
    pub raw_json: serde_json::Value,
    pub source_run_id: Option<uuid::Uuid>,
}

pub struct LobbyingFilingUpsert<'a> {
    pub filing_uuid: &'a str,
    pub filing_type: Option<&'a str>,
    pub filing_year: Option<i32>,
    pub filing_period: Option<&'a str>,
    pub income: Option<f64>,
    pub expenses: Option<f64>,
    pub registrant_id: Option<i64>,
    pub client_id: Option<i64>,
    pub dt_posted: Option<DateTime<Utc>>,
    pub raw_json: serde_json::Value,
    pub source_run_id: Option<uuid::Uuid>,
}

pub struct LobbyingLobbyistUpsert<'a> {
    pub id: i64,
    pub first_name: Option<&'a str>,
    pub middle_name: Option<&'a str>,
    pub last_name: &'a str,
    pub suffix: Option<&'a str>,
    pub raw_json: serde_json::Value,
    pub source_run_id: Option<uuid::Uuid>,
}

pub struct LobbyingActivityUpsert<'a> {
    pub filing_uuid: &'a str,
    pub issue_code: Option<&'a str>,
    pub issue_display: Option<&'a str>,
    pub description: Option<&'a str>,
    pub foreign_entity_issues: Option<&'a str>,
    pub government_entities: serde_json::Value,
    pub lobbyist_identity: serde_json::Value,
    pub source_run_id: Option<uuid::Uuid>,
}

impl Repository {
    pub async fn upsert_lobbying_lobbyist(
        &self,
        input: LobbyingLobbyistUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO lobbying_lobbyists
               (id, first_name, middle_name, last_name, suffix, raw_json, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO UPDATE SET
                 first_name  = COALESCE(EXCLUDED.first_name, lobbying_lobbyists.first_name),
                 middle_name = COALESCE(EXCLUDED.middle_name, lobbying_lobbyists.middle_name),
                 last_name   = EXCLUDED.last_name,
                 suffix      = COALESCE(EXCLUDED.suffix, lobbying_lobbyists.suffix),
                 raw_json    = EXCLUDED.raw_json"#,
        )
        .bind(input.id)
        .bind(input.first_name)
        .bind(input.middle_name)
        .bind(input.last_name)
        .bind(input.suffix)
        .bind(input.raw_json)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    pub async fn link_lobbyist_to_filing(
        &self,
        filing_uuid: &str,
        lobbyist_id: i64,
        covered_position: Option<&str>,
        is_new: Option<bool>,
        source_run_id: Option<uuid::Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO lobbying_filing_lobbyists
               (filing_uuid, lobbyist_id, covered_position, is_new, source_run_id)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (filing_uuid, lobbyist_id) DO UPDATE SET
                 covered_position = COALESCE(EXCLUDED.covered_position, lobbying_filing_lobbyists.covered_position),
                 is_new = COALESCE(EXCLUDED.is_new, lobbying_filing_lobbyists.is_new)"#,
        )
        .bind(filing_uuid)
        .bind(lobbyist_id)
        .bind(covered_position)
        .bind(is_new)
        .bind(source_run_id)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    /// Insert or update a lobbying registrant row.
    pub async fn upsert_lobbying_registrant(
        &self,
        input: LobbyingRegistrantUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO lobbying_registrants
               (id, name, description, state, country, raw_json, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO UPDATE SET
                 name        = EXCLUDED.name,
                 description = COALESCE(EXCLUDED.description, lobbying_registrants.description),
                 state       = COALESCE(EXCLUDED.state, lobbying_registrants.state),
                 country     = COALESCE(EXCLUDED.country, lobbying_registrants.country),
                 raw_json    = EXCLUDED.raw_json"#,
        )
        .bind(input.id)
        .bind(input.name)
        .bind(input.description)
        .bind(input.state)
        .bind(input.country)
        .bind(input.raw_json)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Insert or update a lobbying client row.
    pub async fn upsert_lobbying_client(
        &self,
        id: i64,
        name: &str,
        state: Option<&str>,
        country: Option<&str>,
        raw_json: serde_json::Value,
        source_run_id: Option<uuid::Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO lobbying_clients
               (id, name, state, country, raw_json, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (id) DO UPDATE SET
                 name     = EXCLUDED.name,
                 state    = COALESCE(EXCLUDED.state, lobbying_clients.state),
                 country  = COALESCE(EXCLUDED.country, lobbying_clients.country),
                 raw_json = EXCLUDED.raw_json"#,
        )
        .bind(id)
        .bind(name)
        .bind(state)
        .bind(country)
        .bind(raw_json)
        .bind(source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Insert or update a lobbying filing row.
    pub async fn upsert_lobbying_filing(
        &self,
        input: LobbyingFilingUpsert<'_>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO lobbying_filings
               (filing_uuid, filing_type, filing_year, filing_period,
                income, expenses, registrant_id, client_id,
                dt_posted, raw_json, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (filing_uuid) DO UPDATE SET
                 filing_type    = COALESCE(EXCLUDED.filing_type, lobbying_filings.filing_type),
                 filing_year    = COALESCE(EXCLUDED.filing_year, lobbying_filings.filing_year),
                 filing_period  = COALESCE(EXCLUDED.filing_period, lobbying_filings.filing_period),
                 income         = COALESCE(EXCLUDED.income, lobbying_filings.income),
                 expenses       = COALESCE(EXCLUDED.expenses, lobbying_filings.expenses),
                 registrant_id  = COALESCE(EXCLUDED.registrant_id, lobbying_filings.registrant_id),
                 client_id      = COALESCE(EXCLUDED.client_id, lobbying_filings.client_id),
                 dt_posted      = COALESCE(EXCLUDED.dt_posted, lobbying_filings.dt_posted),
                 raw_json       = EXCLUDED.raw_json"#,
        )
        .bind(input.filing_uuid)
        .bind(input.filing_type)
        .bind(input.filing_year)
        .bind(input.filing_period)
        .bind(input.income)
        .bind(input.expenses)
        .bind(input.registrant_id)
        .bind(input.client_id)
        .bind(input.dt_posted)
        .bind(input.raw_json)
        .bind(input.source_run_id)
        .execute(self.pool())
        .await?;

        Ok(())
    }

    /// Insert or update a lobbying activity row.
    pub async fn upsert_lobbying_activity(
        &self,
        input: LobbyingActivityUpsert<'_>,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"INSERT INTO lobbying_activities
               (filing_uuid, issue_code, issue_display, description, foreign_entity_issues,
                government_entities, lobbyist_identity, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (
                 md5(
                   length(COALESCE(filing_uuid, ''))::text || ':' || COALESCE(filing_uuid, '') ||
                   length(COALESCE(issue_code, ''))::text || ':' || COALESCE(issue_code, '') ||
                   length(COALESCE(issue_display, ''))::text || ':' || COALESCE(issue_display, '') ||
                   length(COALESCE(description, ''))::text || ':' || COALESCE(description, '') ||
                   length(COALESCE(foreign_entity_issues, ''))::text || ':' ||
                     COALESCE(foreign_entity_issues, '') ||
                   length(government_entities::text)::text || ':' || government_entities::text ||
                   length(lobbyist_identity::text)::text || ':' || lobbyist_identity::text
                 )
               ) DO UPDATE SET source_run_id = EXCLUDED.source_run_id
               RETURNING id"#,
        )
        .bind(input.filing_uuid)
        .bind(input.issue_code)
        .bind(input.issue_display)
        .bind(input.description)
        .bind(input.foreign_entity_issues)
        .bind(input.government_entities)
        .bind(input.lobbyist_identity)
        .bind(input.source_run_id)
        .fetch_one(self.pool())
        .await
    }

    pub async fn link_lobbyist_to_activity(
        &self,
        activity_id: i64,
        lobbyist_id: i64,
        covered_position: Option<&str>,
        is_new: Option<bool>,
        source_run_id: Option<uuid::Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO lobbying_activity_lobbyists
               (activity_id, lobbyist_id, covered_position, is_new, source_run_id)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (
                 activity_id,
                 lobbyist_id,
                 COALESCE(covered_position, ''),
                 COALESCE(is_new::text, '')
               ) DO UPDATE SET
                 source_run_id = EXCLUDED.source_run_id"#,
        )
        .bind(activity_id)
        .bind(lobbyist_id)
        .bind(covered_position)
        .bind(is_new)
        .bind(source_run_id)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    /// Search lobbying clients by name.
    pub async fn search_lobbying_clients(
        &self,
        query: &str,
        limit: i64,
    ) -> Result<Vec<LobbyingEntityInfo>, sqlx::Error> {
        let pattern = format!("%{}%", query);
        let rows: Vec<LobbyEntityRow> = sqlx::query_as::<_, LobbyEntityRow>(
            r#"SELECT id, name, state, country
               FROM lobbying_clients
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
            .map(|r| LobbyingEntityInfo {
                id: r.id,
                name: r.name,
                state: r.state,
                country: r.country,
            })
            .collect())
    }

    /// Search lobbying registrants by name.
    pub async fn search_lobbying_registrants(
        &self,
        query: &str,
        limit: i64,
    ) -> Result<Vec<LobbyingEntityInfo>, sqlx::Error> {
        let pattern = format!("%{}%", query);
        let rows: Vec<LobbyEntityRow> = sqlx::query_as::<_, LobbyEntityRow>(
            r#"SELECT id, name, state, country
               FROM lobbying_registrants
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
            .map(|r| LobbyingEntityInfo {
                id: r.id,
                name: r.name,
                state: r.state,
                country: r.country,
            })
            .collect())
    }

    /// Find lobbying matches by keyword in issue descriptions and names.
    pub async fn find_lobbying_by_subject(
        &self,
        keyword: &str,
        limit: i64,
    ) -> Result<Vec<LobbyingMatch>, sqlx::Error> {
        let pattern = format!("%{}%", keyword);
        let rows: Vec<LobbyMatchRow> = sqlx::query_as::<_, LobbyMatchRow>(
            r#"SELECT la.filing_uuid, lr.name AS registrant_name, lc.name AS client_name,
                      la.issue_code, la.issue_display, $2 AS matched_keyword
               FROM lobbying_activities la
               JOIN lobbying_filings lf ON lf.filing_uuid = la.filing_uuid
               JOIN lobbying_registrants lr ON lr.id = lf.registrant_id
               JOIN lobbying_clients lc ON lc.id = lf.client_id
               WHERE la.issue_display ILIKE $1
                  OR la.description ILIKE $1
                  OR lr.name ILIKE $1
                  OR lc.name ILIKE $1
               LIMIT $3"#,
        )
        .bind(&pattern)
        .bind(keyword)
        .bind(limit)
        .fetch_all(self.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| LobbyingMatch {
                filing_uuid: r.filing_uuid,
                registrant_name: r.registrant_name,
                client_name: r.client_name,
                issue_code: r.issue_code,
                issue_display: r.issue_display,
                matched_keyword: r.matched_keyword,
                confidence: "heuristic".to_string(),
            })
            .collect())
    }

    /// List lobbying filings by year with registrant/client names.
    pub async fn list_lobbying_filings(
        &self,
        year: Option<i32>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<LobbyingFilingRow>, sqlx::Error> {
        let rows: Vec<LobbyingFilingRow> = sqlx::query_as::<_, LobbyingFilingRow>(
            r#"SELECT lf.filing_uuid, lf.filing_type, lf.filing_year, lf.filing_period,
                      lf.income, lf.expenses, lf.dt_posted,
                      lr.id AS registrant_id, lr.name AS registrant_name,
                      lc.id AS client_id, lc.name AS client_name
               FROM lobbying_filings lf
               LEFT JOIN lobbying_registrants lr ON lr.id = lf.registrant_id
               LEFT JOIN lobbying_clients lc ON lc.id = lf.client_id
               WHERE ($1::integer IS NULL OR lf.filing_year = $1)
               ORDER BY lf.dt_posted DESC NULLS LAST
               LIMIT $2 OFFSET $3"#,
        )
        .bind(year)
        .bind(limit)
        .bind(offset)
        .fetch_all(self.pool())
        .await?;

        Ok(rows)
    }

    /// Get a single lobbying filing by UUID with registrant/client names.
    pub async fn get_lobbying_filing(
        &self,
        filing_uuid: &str,
    ) -> Result<Option<LobbyingFilingRow>, sqlx::Error> {
        let row: Option<LobbyingFilingRow> = sqlx::query_as::<_, LobbyingFilingRow>(
            r#"SELECT lf.filing_uuid, lf.filing_type, lf.filing_year, lf.filing_period,
                      lf.income, lf.expenses, lf.dt_posted,
                      lr.id AS registrant_id, lr.name AS registrant_name,
                      lc.id AS client_id, lc.name AS client_name
               FROM lobbying_filings lf
               LEFT JOIN lobbying_registrants lr ON lr.id = lf.registrant_id
               LEFT JOIN lobbying_clients lc ON lc.id = lf.client_id
               WHERE lf.filing_uuid = $1"#,
        )
        .bind(filing_uuid)
        .fetch_optional(self.pool())
        .await?;

        Ok(row)
    }

    /// Count total lobbying filings (optionally filtered by year).
    pub async fn count_lobbying_filings(&self, year: Option<i32>) -> Result<i64, sqlx::Error> {
        let row: (i64,) = sqlx::query_as(
            r#"SELECT COUNT(*) FROM lobbying_filings
               WHERE ($1::integer IS NULL OR filing_year = $1)"#,
        )
        .bind(year)
        .fetch_one(self.pool())
        .await?;

        Ok(row.0)
    }
}

// ── Private row types ───────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct LobbyEntityRow {
    id: i64,
    name: String,
    state: Option<String>,
    country: Option<String>,
}

#[derive(sqlx::FromRow)]
struct LobbyMatchRow {
    filing_uuid: String,
    registrant_name: String,
    client_name: String,
    issue_code: Option<String>,
    issue_display: Option<String>,
    matched_keyword: String,
}

#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct LobbyingFilingRow {
    pub filing_uuid: String,
    pub filing_type: Option<String>,
    pub filing_year: Option<i32>,
    pub filing_period: Option<String>,
    pub income: Option<f64>,
    pub expenses: Option<f64>,
    pub dt_posted: Option<DateTime<Utc>>,
    pub registrant_id: Option<i64>,
    pub registrant_name: Option<String>,
    pub client_id: Option<i64>,
    pub client_name: Option<String>,
}
