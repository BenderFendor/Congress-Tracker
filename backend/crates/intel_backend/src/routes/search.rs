use crate::models::{SearchResponse, SearchResultItem, SearchResults};
use crate::routes::AppState;
use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[allow(dead_code)]
    pub r#type: Option<String>,
}

/// GET /api/search?q=&type=
///
/// Cross-entity search across members, bills, committees, PACs, lobbying
/// clients, and lobbying registrants.
pub async fn search(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResponse>, crate::models::AppError> {
    let q = query.q.trim();
    if q.is_empty() {
        return Ok(Json(SearchResponse {
            query: String::new(),
            total: 0,
            results: Vec::new(),
        }));
    }

    let cache_key = format!("search:{}:{}", q, query.r#type.as_deref().unwrap_or("all"));

    // Check cache first
    if let Some(cached) = state.cache.get(&cache_key).await {
        let response: SearchResponse = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(response));
    }

    let search_results = state
        .repo
        .cross_entity_search(q, 20)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let response = flatten_search_results(search_results);

    // Cache the result
    let cache_value = serde_json::to_value(&response)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(response))
}

fn flatten_search_results(r: SearchResults) -> SearchResponse {
    let mut results: Vec<SearchResultItem> = Vec::new();

    for m in &r.members {
        results.push(SearchResultItem {
            r#type: "member".into(),
            id: m.bioguide_id.clone(),
            label: m.official_full_name.clone(),
            subtitle: Some(format!(
                "{} — {}, {}",
                m.current_chamber, m.current_state, m.current_party
            )),
            url: Some(format!("/legislators/{}", m.bioguide_id)),
        });
    }

    for b in &r.bills {
        results.push(SearchResultItem {
            r#type: "bill".into(),
            id: b.bill_id.clone(),
            label: b.title.clone(),
            subtitle: Some(format!(
                "{}. {} {} — {}",
                b.congress, b.bill_type, b.bill_number, b.status
            )),
            url: Some(format!("/bills/{}", b.bill_id)),
        });
    }

    for c in &r.committees {
        results.push(SearchResultItem {
            r#type: "committee".into(),
            id: c.committee_id.clone(),
            label: c.name.clone(),
            subtitle: Some(c.chamber.clone()),
            url: Some(format!("/committees/{}", c.committee_id)),
        });
    }

    for p in &r.pacs {
        results.push(SearchResultItem {
            r#type: "pac".into(),
            id: p.committee_id.clone(),
            label: p.name.clone(),
            subtitle: p.party.clone(),
            url: None, // No detail page for PACs yet
        });
    }

    for lc in &r.lobbying_clients {
        results.push(SearchResultItem {
            r#type: "lobbying_client".into(),
            id: lc.id.to_string(),
            label: lc.name.clone(),
            subtitle: lc.state.clone(),
            url: Some(format!("/lobbying/{}", lc.id)),
        });
    }

    for lr in &r.lobbying_registrants {
        results.push(SearchResultItem {
            r#type: "lobbying_registrant".into(),
            id: lr.id.to_string(),
            label: lr.name.clone(),
            subtitle: lr.state.clone(),
            url: Some(format!("/lobbying/{}", lr.id)),
        });
    }

    let total = results.len();
    SearchResponse {
        query: r.query,
        total,
        results,
    }
}
