use crate::models::AppError;
use crate::routes::AppState;
use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CandidateQuery {
    pub name: Option<String>,
    pub state: Option<String>,
    pub party: Option<String>,
    pub cycle: Option<i32>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct IntelCandidate {
    pub candidate_id: String,
    pub name: String,
    pub party: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub office: Option<String>,
    pub incumbent_challenge: Option<String>,
    pub active_through: Option<i32>,
    pub first_file_date: Option<String>,
    pub last_file_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CommitteeQuery {
    pub name: Option<String>,
    pub state: Option<String>,
    pub party: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct IntelCommittee {
    pub committee_id: String,
    pub name: String,
    pub committee_type: Option<String>,
    pub committee_type_full: Option<String>,
    pub designation: Option<String>,
    pub designation_full: Option<String>,
    pub party: Option<String>,
    pub state: Option<String>,
}

/// GET /api/fec/candidates
///
/// Returns FEC candidate records from the database with optional filters.
pub async fn list_candidates(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CandidateQuery>,
) -> Result<Json<Vec<IntelCandidate>>, AppError> {
    let limit_val = query.limit.unwrap_or(200);
    let pool = state.repo.pool();

    let name_filter = query.name.unwrap_or_default();
    let state_filter = query.state.unwrap_or_default();
    let party_filter = query.party.unwrap_or_default();
    let cycle_val = query.cycle.unwrap_or(0);

    let candidates: Vec<IntelCandidate> = sqlx::query_as(
        r#"SELECT candidate_id, name, party, state, district, office,
                  incumbent_challenge, active_through,
                  first_file_date::text AS first_file_date,
                  last_file_date::text AS last_file_date
           FROM fec_candidates
           WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')
             AND ($2 = '' OR state = $2)
             AND ($3 = '' OR party = $3)
             AND ($4 = 0 OR active_through >= $4)
           ORDER BY name ASC
           LIMIT $5"#,
    )
    .bind(&name_filter)
    .bind(&state_filter)
    .bind(&party_filter)
    .bind(cycle_val)
    .bind(limit_val)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(candidates))
}

/// GET /api/fec/committees
///
/// Returns FEC committee records from the database with optional filters.
pub async fn list_committees(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CommitteeQuery>,
) -> Result<Json<Vec<IntelCommittee>>, AppError> {
    let limit_val = query.limit.unwrap_or(200);
    let pool = state.repo.pool();

    let name_filter = query.name.unwrap_or_default();
    let state_filter = query.state.unwrap_or_default();
    let party_filter = query.party.unwrap_or_default();

    let committees: Vec<IntelCommittee> = sqlx::query_as(
        r#"SELECT committee_id, name, committee_type, committee_type_full,
                  designation, designation_full, party, state
           FROM fec_committees
           WHERE ($1 = '' OR name ILIKE '%' || $1 || '%')
             AND ($2 = '' OR state = $2)
             AND ($3 = '' OR party = $3)
           ORDER BY name ASC
           LIMIT $4"#,
    )
    .bind(&name_filter)
    .bind(&state_filter)
    .bind(&party_filter)
    .bind(limit_val)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(committees))
}
