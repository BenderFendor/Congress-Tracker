use crate::models::MemberFunding;
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;
use tracing::Instrument;

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
    let cache_key = format!("funding:v2:{}:{}", bioguide_id, cycle);

    // 1. In-memory cache
    if let Some(cached) = state.cache.get(&cache_key).await {
        let funding: MemberFunding = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(funding));
    }

    // 2. DB cache (24h TTL)
    if let Ok(Some(cached)) = state.repo.get_cached_funding(&bioguide_id, cycle, 24).await {
        let cache_value = serde_json::to_value(&cached)
            .map_err(|_| crate::models::AppError::Internal("cache serialization failed".into()))?;
        state.cache.set(cache_key, cache_value).await;
        return Ok(Json(cached));
    }
    // 3. Precomputed rankings (bulk import path — preferred)
    match state
        .repo
        .get_member_funding_from_rankings(&bioguide_id, cycle)
        .await
    {
        Ok(Some(funding))
            if !funding.top_donors.is_empty() || !funding.top_committees.is_empty() =>
        {
            let cache_value = serde_json::to_value(&funding)
                .map_err(|_| crate::models::AppError::Internal("cache serialization failed".into()))?;
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

    // 4. DB materialized view (legacy / totals-only path)
    let funding = state
        .repo
        .get_member_funding(&bioguide_id, cycle)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
        .ok_or_else(|| {
            crate::models::AppError::NotFound(format!("Member {} not found", bioguide_id))
        })?;

    // 5. If MV has no data, auto_ingest from OpenFEC
    tracing::info!(
        bioguide_id = %bioguide_id,
        top_donors_len = funding.top_donors.len(),
        direct_receipts = funding.direct_receipts,
        "checking if auto_ingest needed"
    );
    let funding = if funding.top_donors.is_empty() && funding.direct_receipts == 0.0 {
        tracing::info!(
            bioguide_id = %bioguide_id,
            "triggering auto_ingest from OpenFEC live"
        );
        let auto_span =
            tracing::info_span!("auto_ingest_funding", bioguide_id = %bioguide_id, cycle = %cycle);
        let funding_result = async {
            state
                .repo
                .auto_ingest_member_funding(&bioguide_id, cycle, &state.openfec_api_key)
                .await
        }
        .instrument(auto_span)
        .await;

        match funding_result {
            Ok(Some(live_funding)) => {
                tracing::info!(
                    bioguide_id = %bioguide_id,
                    live_direct_receipts = live_funding.direct_receipts,
                    "auto_ingest succeeded"
                );
                if let Err(error) = state
                    .repo
                    .save_funding_cache(&bioguide_id, cycle, &live_funding)
                    .await
                {
                    tracing::warn!(bioguide_id = %bioguide_id, %error, "funding cache write failed");
                }
                live_funding
            }
            Ok(None) => {
                tracing::warn!(
                    bioguide_id = %bioguide_id,
                    "auto_ingest returned None (no FEC ID or API returned empty)"
                );
                funding
            }
            Err(e) => {
                tracing::error!(
                    bioguide_id = %bioguide_id,
                    error = %e,
                    "auto_ingest failed"
                );
                funding
            }
        }
    } else {
        funding
    };

    // 6. Cache in memory and return
    let cache_value = serde_json::to_value(&funding)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(funding))
}
