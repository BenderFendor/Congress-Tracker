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
    /// Case-insensitive search across registrant, client, and issue text.
    pub search: Option<String>,
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
    pub source_url: Option<String>,
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
    let search = query.search.unwrap_or_default();
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
                  COALESCE(array_remove(array_agg(DISTINCT la.issue_code), NULL), ARRAY[]::text[]) AS issue_codes,
                  COALESCE(lf.raw_json->>'filing_document_url', lf.raw_json->>'url') AS source_url
           FROM lobbying_filings lf
           LEFT JOIN lobbying_registrants lr ON lr.id = lf.registrant_id
           LEFT JOIN lobbying_clients lc ON lc.id = lf.client_id
           LEFT JOIN lobbying_activities la ON la.filing_uuid = lf.filing_uuid
           WHERE ($1 = 0 OR lf.filing_year = $1)
             AND ($2 = '' OR lc.name ILIKE '%' || $2 || '%')
             AND ($3 = '' OR lr.name ILIKE '%' || $3 || '%')
             AND ($4 = '' OR la.issue_code = $4 OR la.issue_display ILIKE '%' || $4 || '%')
             AND ($5 = '' OR lc.name ILIKE '%' || $5 || '%'
                         OR lr.name ILIKE '%' || $5 || '%'
                         OR la.issue_code ILIKE '%' || $5 || '%'
                         OR la.issue_display ILIKE '%' || $5 || '%')
           GROUP BY lf.filing_uuid, lr.id, lr.name, lc.id, lc.name
           ORDER BY lf.dt_posted DESC NULLS LAST
           LIMIT $6 OFFSET $7"#,
    )
    .bind(year)
    .bind(&client)
    .bind(&registrant)
    .bind(&issue)
    .bind(&search)
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
             AND ($4 = '' OR la.issue_code = $4 OR la.issue_display ILIKE '%' || $4 || '%')
             AND ($5 = '' OR lc.name ILIKE '%' || $5 || '%'
                         OR lr.name ILIKE '%' || $5 || '%'
                         OR la.issue_code ILIKE '%' || $5 || '%'
                         OR la.issue_display ILIKE '%' || $5 || '%')"#,
    )
    .bind(year)
    .bind(&client)
    .bind(&registrant)
    .bind(&issue)
    .bind(&search)
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
                  COALESCE(array_remove(array_agg(DISTINCT la.issue_code), NULL), ARRAY[]::text[]) AS issue_codes,
                  COALESCE(lf.raw_json->>'filing_document_url', lf.raw_json->>'url') AS source_url
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

// ── Client list / detail ──

#[derive(Debug, Deserialize)]
pub struct ClientQuery {
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LobbyingClientRow {
    pub id: i64,
    pub name: String,
    pub state: Option<String>,
    pub country: Option<String>,
    pub filing_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ClientListResponse {
    pub clients: Vec<LobbyingClientRow>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

pub async fn list_clients(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ClientQuery>,
) -> Result<Json<ClientListResponse>, AppError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 500);
    let offset = query.offset.unwrap_or(0).max(0);
    let search = query.search.unwrap_or_default();
    let pool = state.repo.pool();

    let clients: Vec<LobbyingClientRow> = sqlx::query_as(
        r#"SELECT lc.id, lc.name, lc.state, lc.country,
                  (SELECT COUNT(*) FROM lobbying_filings lf WHERE lf.client_id = lc.id) AS filing_count
           FROM lobbying_clients lc
           WHERE ($1 = '' OR lc.name ILIKE '%' || $1 || '%')
           ORDER BY lc.name
           LIMIT $2 OFFSET $3"#,
    )
    .bind(&search)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    let total: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM lobbying_clients lc
           WHERE ($1 = '' OR lc.name ILIKE '%' || $1 || '%')"#,
    )
    .bind(&search)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(ClientListResponse {
        clients,
        total: total.0,
        limit,
        offset,
    }))
}

pub async fn get_client(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, AppError> {
    let pool = state.repo.pool();
    let client: LobbyingClientRow = sqlx::query_as(
        r#"SELECT lc.id, lc.name, lc.state, lc.country,
                  (SELECT COUNT(*) FROM lobbying_filings lf WHERE lf.client_id = lc.id) AS filing_count
           FROM lobbying_clients lc
           WHERE lc.id = $1"#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?
    .ok_or_else(|| AppError::NotFound(format!("Client {} not found", id)))?;

    let filings: Vec<LobbyingFiling> = entity_filings(pool, Some(id), None, None).await?;
    Ok(Json(serde_json::json!({
        "id": client.id,
        "name": client.name,
        "state": client.state,
        "country": client.country,
        "filing_count": client.filing_count,
        "filings": filings,
    })))
}

// ── Registrant list / detail ──

#[derive(Debug, Deserialize)]
pub struct RegistrantQuery {
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LobbyingRegistrantRow {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub filing_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct RegistrantListResponse {
    pub registrants: Vec<LobbyingRegistrantRow>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

pub async fn list_registrants(
    State(state): State<Arc<AppState>>,
    Query(query): Query<RegistrantQuery>,
) -> Result<Json<RegistrantListResponse>, AppError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 500);
    let offset = query.offset.unwrap_or(0).max(0);
    let search = query.search.unwrap_or_default();
    let pool = state.repo.pool();

    let registrants: Vec<LobbyingRegistrantRow> = sqlx::query_as(
        r#"SELECT lr.id, lr.name, lr.description, lr.state, lr.country,
                  (SELECT COUNT(*) FROM lobbying_filings lf WHERE lf.registrant_id = lr.id) AS filing_count
           FROM lobbying_registrants lr
           WHERE ($1 = '' OR lr.name ILIKE '%' || $1 || '%')
           ORDER BY lr.name
           LIMIT $2 OFFSET $3"#,
    )
    .bind(&search)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    let total: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM lobbying_registrants lr
           WHERE ($1 = '' OR lr.name ILIKE '%' || $1 || '%')"#,
    )
    .bind(&search)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(RegistrantListResponse {
        registrants,
        total: total.0,
        limit,
        offset,
    }))
}

pub async fn get_registrant(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, AppError> {
    let pool = state.repo.pool();
    let registrant: LobbyingRegistrantRow = sqlx::query_as(
        r#"SELECT lr.id, lr.name, lr.description, lr.state, lr.country,
                  (SELECT COUNT(*) FROM lobbying_filings lf WHERE lf.registrant_id = lr.id) AS filing_count
           FROM lobbying_registrants lr
           WHERE lr.id = $1"#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?
    .ok_or_else(|| AppError::NotFound(format!("Registrant {} not found", id)))?;

    let filings: Vec<LobbyingFiling> = entity_filings(pool, None, Some(id), None).await?;
    Ok(Json(serde_json::json!({
        "id": registrant.id,
        "name": registrant.name,
        "description": registrant.description,
        "state": registrant.state,
        "country": registrant.country,
        "filing_count": registrant.filing_count,
        "filings": filings,
    })))
}

#[derive(Debug, Deserialize)]
pub struct LobbyistQuery {
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LobbyingLobbyistRow {
    pub id: i64,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: String,
    pub suffix: Option<String>,
    pub filing_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct LobbyistListResponse {
    pub lobbyists: Vec<LobbyingLobbyistRow>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

pub async fn list_lobbyists(
    State(state): State<Arc<AppState>>,
    Query(query): Query<LobbyistQuery>,
) -> Result<Json<LobbyistListResponse>, AppError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 500);
    let offset = query.offset.unwrap_or(0).max(0);
    let search = query.search.unwrap_or_default();
    let pool = state.repo.pool();
    let lobbyists = sqlx::query_as(
        r#"SELECT ll.id, ll.first_name, ll.middle_name, ll.last_name, ll.suffix,
                  (SELECT COUNT(*) FROM lobbying_filing_lobbyists lfl WHERE lfl.lobbyist_id = ll.id) AS filing_count
           FROM lobbying_lobbyists ll
           WHERE $1 = '' OR concat_ws(' ', ll.first_name, ll.middle_name, ll.last_name, ll.suffix) ILIKE '%' || $1 || '%'
           ORDER BY ll.last_name, ll.first_name
           LIMIT $2 OFFSET $3"#,
    )
    .bind(&search)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;
    let total: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM lobbying_lobbyists ll
           WHERE $1 = '' OR concat_ws(' ', ll.first_name, ll.middle_name, ll.last_name, ll.suffix) ILIKE '%' || $1 || '%'"#,
    )
    .bind(&search)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;
    Ok(Json(LobbyistListResponse {
        lobbyists,
        total: total.0,
        limit,
        offset,
    }))
}

pub async fn get_lobbyist(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<serde_json::Value>, AppError> {
    let pool = state.repo.pool();
    let lobbyist: LobbyingLobbyistRow = sqlx::query_as(
        r#"SELECT ll.id, ll.first_name, ll.middle_name, ll.last_name, ll.suffix,
                  (SELECT COUNT(*) FROM lobbying_filing_lobbyists lfl WHERE lfl.lobbyist_id = ll.id) AS filing_count
           FROM lobbying_lobbyists ll WHERE ll.id = $1"#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?
    .ok_or_else(|| AppError::NotFound(format!("Lobbyist {} not found", id)))?;
    let filings = entity_filings(pool, None, None, Some(id)).await?;
    Ok(Json(serde_json::json!({
        "id": lobbyist.id,
        "first_name": lobbyist.first_name,
        "middle_name": lobbyist.middle_name,
        "last_name": lobbyist.last_name,
        "suffix": lobbyist.suffix,
        "filing_count": lobbyist.filing_count,
        "filings": filings,
    })))
}

async fn entity_filings(
    pool: &sqlx::PgPool,
    client_id: Option<i64>,
    registrant_id: Option<i64>,
    lobbyist_id: Option<i64>,
) -> Result<Vec<LobbyingFiling>, AppError> {
    sqlx::query_as(
        r#"SELECT lf.filing_uuid, lf.filing_type, lf.filing_year, lf.filing_period,
                  lf.income::float8 AS income, lf.expenses::float8 AS expenses, lf.dt_posted,
                  lr.id AS registrant_id, lr.name AS registrant_name,
                  lc.id AS client_id, lc.name AS client_name,
                  COALESCE(array_remove(array_agg(DISTINCT la.issue_code), NULL), ARRAY[]::text[]) AS issue_codes,
                  COALESCE(lf.raw_json->>'filing_document_url', lf.raw_json->>'url') AS source_url
           FROM lobbying_filings lf
           LEFT JOIN lobbying_registrants lr ON lr.id = lf.registrant_id
           LEFT JOIN lobbying_clients lc ON lc.id = lf.client_id
           LEFT JOIN lobbying_activities la ON la.filing_uuid = lf.filing_uuid
           WHERE ($1::bigint IS NULL OR lf.client_id = $1)
             AND ($2::bigint IS NULL OR lf.registrant_id = $2)
             AND ($3::bigint IS NULL OR EXISTS (
                   SELECT 1 FROM lobbying_filing_lobbyists lfl
                   WHERE lfl.filing_uuid = lf.filing_uuid AND lfl.lobbyist_id = $3))
           GROUP BY lf.filing_uuid, lr.id, lr.name, lc.id, lc.name
           ORDER BY lf.dt_posted DESC NULLS LAST
           LIMIT 100"#,
    )
    .bind(client_id)
    .bind(registrant_id)
    .bind(lobbyist_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))
}
