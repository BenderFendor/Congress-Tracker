use crate::models::MemberProfile;
use crate::provenance::add_warning;
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ListMembersQuery {
    pub chamber: Option<String>,
    pub state: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/members/{bioguide_id}/profile
///
/// Returns a full member profile with terms, identifiers, committees, social
/// accounts, ideology scores, and provenance metadata.
pub async fn get_member_profile(
    State(state): State<Arc<AppState>>,
    Path(bioguide_id): Path<String>,
) -> Result<Json<MemberProfile>, crate::models::AppError> {
    let cache_key = format!("members:profile:{}", bioguide_id);

    // Check cache first
    if let Some(cached) = state.cache.get(&cache_key).await {
        let profile: MemberProfile = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(profile));
    }

    // Fetch from repository
    let mut profile = state
        .repo
        .get_member(&bioguide_id)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
        .ok_or_else(|| {
            crate::models::AppError::NotFound(format!("Member {} not found", bioguide_id))
        })?;

    // Add provenance warnings for missing data
    if profile.birthday.is_none() && profile.age.is_none() {
        add_warning(&mut profile.provenance, "birthday_unavailable_age_missing");
    }
    if profile.terms.is_empty() {
        add_warning(&mut profile.provenance, "no_terms_loaded");
    }
    if profile.next_election.is_none() {
        add_warning(
            &mut profile.provenance,
            "next_election_unavailable_missing_terms",
        );
    }

    // Cache the result
    let cache_value = serde_json::to_value(&profile)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(profile))
}

/// GET /api/members
///
/// List members with optional chamber and state filters.
pub async fn list_members(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListMembersQuery>,
) -> Result<Json<Vec<MemberProfile>>, crate::models::AppError> {
    let chamber = query.chamber.as_deref();
    let state_param = query.state.as_deref();
    let limit = query.limit.unwrap_or(100);

    let cache_key = format!(
        "members:list:{}:{}:{}",
        chamber.unwrap_or(""),
        state_param.unwrap_or(""),
        limit
    );

    // Check cache
    if let Some(cached) = state.cache.get(&cache_key).await {
        let profiles: Vec<MemberProfile> = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(profiles));
    }

    let profiles = state
        .repo
        .list_members(chamber, state_param, limit)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    // Cache the result
    let cache_value = serde_json::to_value(&profiles)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(profiles))
}
