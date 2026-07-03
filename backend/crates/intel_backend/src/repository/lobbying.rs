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

impl Repository {
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
        filing_uuid: &str,
        issue_code: Option<&str>,
        issue_display: Option<&str>,
        description: Option<&str>,
        government_entities: serde_json::Value,
        source_run_id: Option<uuid::Uuid>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO lobbying_activities
               (filing_uuid, issue_code, issue_display, description, government_entities, source_run_id)
               VALUES ($1, $2, $3, $4, $5, $6)"#,
        )
        .bind(filing_uuid)
        .bind(issue_code)
        .bind(issue_display)
        .bind(description)
        .bind(government_entities)
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
