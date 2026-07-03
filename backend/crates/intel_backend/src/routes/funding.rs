use crate::models::MemberFunding;
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct FundingQuery {
    pub cycle: Option<i32>,
}

/// GET /api/members/{bioguide_id}/funding?cycle=2026
///
/// Returns member funding data for the given cycle, including PAC vs
/// individual breakdown, top donors, top committees, influence network
/// contributions, and provenance metadata.
///
/// If no FEC data has been loaded for the cycle, the response carries
/// `has_successful_fec_run: false` and a provenance warning — no $0
/// totals are returned as factual.
pub async fn get_member_funding(
    State(state): State<Arc<AppState>>,
    Path(bioguide_id): Path<String>,
    Query(query): Query<FundingQuery>,
) -> Result<Json<MemberFunding>, crate::models::AppError> {
    let cycle = query.cycle.unwrap_or(2026);

    let cache_key = format!("funding:{}:{}", bioguide_id, cycle);

    // Check cache first
    if let Some(cached) = state.cache.get(&cache_key).await {
        let funding: MemberFunding = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(funding));
    }

    let funding = state
        .repo
        .get_member_funding(&bioguide_id, cycle)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
        .ok_or_else(|| {
            crate::models::AppError::NotFound(format!("Member {} not found", bioguide_id))
        })?;

    // Cache the result
    let cache_value = serde_json::to_value(&funding)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(funding))
}
