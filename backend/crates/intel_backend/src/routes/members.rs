use crate::models::{MemberProfile, ProvenanceSource};
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
    // Bump the cache namespace when enrichment/provenance semantics change so
    // older cached profiles cannot hide newly added source metadata.
    let cache_key = format!("members:profile:v2:{}", bioguide_id);

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

    // Enrich with Wikidata biography if bio fields are empty
    if profile.biography_summary.is_none() && profile.biography_full.is_none() {
        let wikidata_id = profile
            .identifiers
            .get("wikidata")
            .and_then(|ids| ids.first())
            .cloned();

        if let Some(wid) = wikidata_id {
            // Fetch Wikidata description (short bio)
            match state.repo.fetch_wikidata_bio(&wid).await {
                Ok(Some(bio)) => {
                    tracing::info!(
                        bioguide_id = %bioguide_id,
                        wikidata_id = %wid,
                        "enriched profile with Wikidata biography"
                    );
                    profile.biography_summary = Some(bio);
                    profile.provenance.sources.push(ProvenanceSource {
                        source: "wikidata".to_string(),
                        status: "live_fetch".to_string(),
                        fetched_at: Some(chrono::Utc::now().to_rfc3339()),
                        confidence: Some("medium".to_string()),
                    });
                }
                Ok(None) => {
                    tracing::warn!(
                        bioguide_id = %bioguide_id,
                        wikidata_id = %wid,
                        "Wikidata returned no description"
                    );
                    add_warning(&mut profile.provenance, "wikidata_description_unavailable");
                }
                Err(e) => {
                    tracing::error!(
                        bioguide_id = %bioguide_id,
                        wikidata_id = %wid,
                        error = %e,
                        "Wikidata bio fetch failed"
                    );
                    add_warning(&mut profile.provenance, "wikidata_fetch_failed");
                }
            }

            // Fetch Wikipedia extract (full paragraph bio)
            match state.repo.fetch_wikipedia_extract(&wid).await {
                Ok(Some(extract)) => {
                    tracing::info!(
                        bioguide_id = %bioguide_id,
                        wikidata_id = %wid,
                        "enriched profile with Wikipedia extract"
                    );
                    profile.biography_full = Some(extract);
                    profile.provenance.sources.push(ProvenanceSource {
                        source: "wikipedia".to_string(),
                        status: "live_fetch".to_string(),
                        fetched_at: Some(chrono::Utc::now().to_rfc3339()),
                        confidence: Some("medium".to_string()),
                    });
                }
                Ok(None) => {
                    tracing::warn!(
                        bioguide_id = %bioguide_id,
                        wikidata_id = %wid,
                        "Wikipedia returned no extract"
                    );
                    add_warning(&mut profile.provenance, "wikipedia_extract_unavailable");
                }
                Err(e) => {
                    tracing::error!(
                        bioguide_id = %bioguide_id,
                        wikidata_id = %wid,
                        error = %e,
                        "Wikipedia extract fetch failed"
                    );
                    add_warning(&mut profile.provenance, "wikipedia_fetch_failed");
                }
            }
        } else {
            tracing::warn!(
                bioguide_id = %bioguide_id,
                "no Wikidata ID found in identifiers"
            );
            add_warning(
                &mut profile.provenance,
                "wikidata_id_unavailable_biography_not_enriched",
            );
        }
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
