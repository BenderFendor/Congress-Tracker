use crate::models::AppError;
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct LobbyingFilingsQuery {
    pub year: Option<i32>,
    pub client: Option<String>,
    pub registrant: Option<String>,
    pub issue: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LobbyingFiling {
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
    pub issue_codes: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct LobbyingFilingsResponse {
    pub filings: Vec<LobbyingFiling>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

pub async fn list_filings(
    State(state): State<Arc<AppState>>,
    Query(query): Query<LobbyingFilingsQuery>,
) -> Result<Json<LobbyingFilingsResponse>, AppError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 500);
    let offset = query.offset.unwrap_or(0).max(0);
    let client = query.client.unwrap_or_default();
    let registrant = query.registrant.unwrap_or_default();
    let issue = query.issue.unwrap_or_default();
    let year = query.year.unwrap_or(0);
    let pool = state.repo.pool();

    let filings: Vec<LobbyingFiling> = sqlx::query_as(
        r#"SELECT lf.filing_uuid,
                  lf.filing_type,
                  lf.filing_year,
                  lf.filing_period,
                  lf.income::float8 AS income,
                  lf.expenses::float8 AS expenses,
                  lf.dt_posted,
                  lr.id AS registrant_id,
                  lr.name AS registrant_name,
                  lc.id AS client_id,
                  lc.name AS client_name,
                  COALESCE(array_remove(array_agg(DISTINCT la.issue_code), NULL), ARRAY[]::text[]) AS issue_codes
           FROM lobbying_filings lf
           LEFT JOIN lobbying_registrants lr ON lr.id = lf.registrant_id
           LEFT JOIN lobbying_clients lc ON lc.id = lf.client_id
           LEFT JOIN lobbying_activities la ON la.filing_uuid = lf.filing_uuid
           WHERE ($1 = 0 OR lf.filing_year = $1)
             AND ($2 = '' OR lc.name ILIKE '%' || $2 || '%')
             AND ($3 = '' OR lr.name ILIKE '%' || $3 || '%')
             AND ($4 = '' OR la.issue_code = $4 OR la.issue_display ILIKE '%' || $4 || '%')
           GROUP BY lf.filing_uuid, lr.id, lr.name, lc.id, lc.name
           ORDER BY lf.dt_posted DESC NULLS LAST
           LIMIT $5 OFFSET $6"#,
    )
    .bind(year)
    .bind(&client)
    .bind(&registrant)
    .bind(&issue)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    let total: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(DISTINCT lf.filing_uuid)
           FROM lobbying_filings lf
           LEFT JOIN lobbying_registrants lr ON lr.id = lf.registrant_id
           LEFT JOIN lobbying_clients lc ON lc.id = lf.client_id
           LEFT JOIN lobbying_activities la ON la.filing_uuid = lf.filing_uuid
           WHERE ($1 = 0 OR lf.filing_year = $1)
             AND ($2 = '' OR lc.name ILIKE '%' || $2 || '%')
             AND ($3 = '' OR lr.name ILIKE '%' || $3 || '%')
             AND ($4 = '' OR la.issue_code = $4 OR la.issue_display ILIKE '%' || $4 || '%')"#,
    )
    .bind(year)
    .bind(&client)
    .bind(&registrant)
    .bind(&issue)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(LobbyingFilingsResponse {
        filings,
        total: total.0,
        limit,
        offset,
    }))
}

pub async fn get_filing(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<LobbyingFiling>, AppError> {
    let filing = sqlx::query_as(
        r#"SELECT lf.filing_uuid,
                  lf.filing_type,
                  lf.filing_year,
                  lf.filing_period,
                  lf.income::float8 AS income,
                  lf.expenses::float8 AS expenses,
                  lf.dt_posted,
                  lr.id AS registrant_id,
                  lr.name AS registrant_name,
                  lc.id AS client_id,
                  lc.name AS client_name,
                  COALESCE(array_remove(array_agg(DISTINCT la.issue_code), NULL), ARRAY[]::text[]) AS issue_codes
           FROM lobbying_filings lf
           LEFT JOIN lobbying_registrants lr ON lr.id = lf.registrant_id
           LEFT JOIN lobbying_clients lc ON lc.id = lf.client_id
           LEFT JOIN lobbying_activities la ON la.filing_uuid = lf.filing_uuid
           WHERE lf.filing_uuid = $1
           GROUP BY lf.filing_uuid, lr.id, lr.name, lc.id, lc.name"#,
    )
    .bind(&id)
    .fetch_optional(state.repo.pool())
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?
    .ok_or_else(|| AppError::NotFound(format!("Lobbying filing {} not found", id)))?;

    Ok(Json(filing))
}
