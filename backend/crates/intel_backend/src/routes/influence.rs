use crate::models::InfluenceNetwork;
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;

/// GET /api/influence/networks
///
/// List all influence networks with their associated committees.
pub async fn list_networks(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<InfluenceNetwork>>, crate::models::AppError> {
    let cache_key = "influence:networks".to_string();

    // Check cache first
    if let Some(cached) = state.cache.get(&cache_key).await {
        let networks: Vec<InfluenceNetwork> = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(networks));
    }

    let networks = state
        .repo
        .list_influence_networks()
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    // Cache the result
    let cache_value = serde_json::to_value(&networks)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(networks))
}

/// GET /api/influence/networks/{network_slug}
///
/// Return a single influence network with its committee members.
pub async fn get_network(
    State(state): State<Arc<AppState>>,
    Path(network_slug): Path<String>,
) -> Result<Json<InfluenceNetwork>, crate::models::AppError> {
    let cache_key = format!("influence:network:{}", network_slug);

    // Check cache first
    if let Some(cached) = state.cache.get(&cache_key).await {
        let network: InfluenceNetwork = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(network));
    }

    let network = state
        .repo
        .get_influence_network(&network_slug)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
        .ok_or_else(|| {
            crate::models::AppError::NotFound(format!(
                "Influence network '{}' not found",
                network_slug
            ))
        })?;

    // Cache the result
    let cache_value = serde_json::to_value(&network)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(network))
}

#[derive(Debug, Deserialize)]
pub struct FinancialsQuery {
    pub cycle: Option<i32>,
}

/// GET /api/influence/networks/{network_slug}/financials?cycle=2026
///
/// Return aggregated financial data for an influence network in a given cycle.
pub async fn get_network_financials(
    State(state): State<Arc<AppState>>,
    Path(network_slug): Path<String>,
    Query(query): Query<FinancialsQuery>,
) -> Result<Json<crate::models::InfluenceNetworkFinancials>, crate::models::AppError> {
    let cycle = query.cycle.unwrap_or(2026);

    let cache_key = format!("influence:financials:{}:{}", network_slug, cycle);

    // Check cache first
    if let Some(cached) = state.cache.get(&cache_key).await {
        let financials: crate::models::InfluenceNetworkFinancials = serde_json::from_value(cached)
            .map_err(|_| {
                crate::models::AppError::Internal("cache deserialization failed".into())
            })?;
        return Ok(Json(financials));
    }

    let financials = state
        .repo
        .get_influence_network_financials(&network_slug, cycle)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
        .ok_or_else(|| {
            crate::models::AppError::NotFound(format!(
                "Influence network '{}' not found",
                network_slug
            ))
        })?;

    // Cache the result
    let cache_value = serde_json::to_value(&financials)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(financials))
}
