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

    // Version the in-memory namespace along with the persistent cache
    // contract so a long-lived process cannot serve pre-provenance rankings.
    let cache_key = format!("funding:v3:{}:{}", bioguide_id, cycle);

    // 1. In-memory cache
    if let Some(cached) = state.cache.get(&cache_key).await {
        let funding: MemberFunding = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(funding));
    }

    // 2. Precomputed rankings (bulk import path — preferred). Check these
    // before the persisted live-totals cache so a completed bulk import takes
    // effect immediately instead of being hidden for up to 24 hours.
    match state
        .repo
        .get_member_funding_from_rankings(&bioguide_id, cycle)
        .await
    {
        Ok(Some(funding)) if funding.has_successful_fec_run => {
            let cache_value = serde_json::to_value(&funding).map_err(|_| {
                crate::models::AppError::Internal("cache serialization failed".into())
            })?;
            state.cache.set(cache_key, cache_value).await;
            return Ok(Json(funding));
        }
        Ok(Some(_)) => {
            tracing::info!(bioguide_id = %bioguide_id, cycle = %cycle, "No rankings found, falling back to MV");
        }
        Ok(None) => {
            tracing::info!(bioguide_id = %bioguide_id, cycle = %cycle, "No FEC candidate found, falling back to MV");
        }
        Err(e) => {
            tracing::warn!(bioguide_id = %bioguide_id, error = %e, "Rankings query failed, falling back to MV");
        }
    }

    // 3. DB cache (24h TTL). This is populated by the private ingestion plane,
    // never by a public request, and remains lower priority than canonical
    // bulk rankings.
    if let Ok(Some(cached)) = state.repo.get_cached_funding(&bioguide_id, cycle, 24).await {
        let cache_value = serde_json::to_value(&cached)
            .map_err(|_| crate::models::AppError::Internal("cache serialization failed".into()))?;
        state.cache.set(cache_key, cache_value).await;
        return Ok(Json(cached));
    }

    // 4. DB materialized view (legacy / totals-only path)
    let funding = state
        .repo
        .get_member_funding(&bioguide_id, cycle)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
        .ok_or_else(|| {
            crate::models::AppError::NotFound(format!("Member {} not found", bioguide_id))
        })?;

    // 5. Cache the read result in memory and return. Missing canonical data is
    // reported through provenance; the worker/CLI ingestion plane owns all
    // network acquisition and persistent writes.
    let cache_value = serde_json::to_value(&funding)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(funding))
}

#[cfg(test)]
mod tests {
    #[test]
    fn public_handler_has_no_ingestion_or_persistent_write_calls() {
        let production_handler = include_str!("funding.rs");
        let live_ingest_call = [".auto_ingest", "_member_funding("].concat();
        let persistent_cache_write = [".save_funding", "_cache("].concat();

        assert!(!production_handler.contains(&live_ingest_call));
        assert!(!production_handler.contains(&persistent_cache_write));
    }
}
