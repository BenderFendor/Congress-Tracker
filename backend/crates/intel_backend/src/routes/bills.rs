use crate::models::BillIntel;
use crate::routes::AppState;
use crate::schema;
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ListBillsQuery {
    pub congress: Option<i32>,
    pub chamber: Option<String>,
    pub bill_type: Option<String>,
    pub status: Option<String>,
    pub q: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BillListItem {
    pub congress: i32,
    pub bill_type: String,
    pub bill_number: i32,
    pub bill_id: String,
    pub title: String,
    pub introduced_date: Option<chrono::NaiveDate>,
    pub origin_chamber: Option<String>,
    pub policy_area: Option<String>,
    pub latest_action_date: Option<chrono::NaiveDate>,
    pub latest_action_text: Option<String>,
    pub status: String,
    pub url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BillsResponse {
    pub bills: Vec<BillListItem>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

pub async fn list_bills(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListBillsQuery>,
) -> Result<Json<BillsResponse>, crate::models::AppError> {
    let limit = query.limit.unwrap_or(50).clamp(1, 500);
    let offset = query.offset.unwrap_or(0).max(0);
    let congress = query.congress.unwrap_or(0);
    let chamber = query.chamber.unwrap_or_default();
    let bill_type = query.bill_type.unwrap_or_default().to_lowercase();
    let status = query.status.unwrap_or_default();
    let q = query.q.unwrap_or_default();
    let pool = state.repo.pool();

    let bills: Vec<BillListItem> = sqlx::query_as(
        r#"SELECT congress, bill_type, bill_number, bill_id, title, introduced_date,
                  origin_chamber, policy_area, latest_action_date, latest_action_text, status, url
           FROM bills
           WHERE ($1 = 0 OR congress = $1)
             AND ($2 = '' OR origin_chamber = $2)
             AND ($3 = '' OR bill_type = $3)
             AND ($4 = '' OR status = $4)
             AND ($5 = '' OR title ILIKE '%' || $5 || '%' OR bill_id ILIKE '%' || $5 || '%')
           ORDER BY latest_action_date DESC NULLS LAST, introduced_date DESC NULLS LAST
           LIMIT $6 OFFSET $7"#,
    )
    .bind(congress)
    .bind(&chamber)
    .bind(&bill_type)
    .bind(&status)
    .bind(&q)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let total: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*)
           FROM bills
           WHERE ($1 = 0 OR congress = $1)
             AND ($2 = '' OR origin_chamber = $2)
             AND ($3 = '' OR bill_type = $3)
             AND ($4 = '' OR status = $4)
             AND ($5 = '' OR title ILIKE '%' || $5 || '%' OR bill_id ILIKE '%' || $5 || '%')"#,
    )
    .bind(congress)
    .bind(&chamber)
    .bind(&bill_type)
    .bind(&status)
    .bind(&q)
    .fetch_one(pool)
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(BillsResponse {
        bills,
        total: total.0,
        limit,
        offset,
    }))
}

pub async fn get_bill_by_id(
    State(state): State<Arc<AppState>>,
    Path(bill_id): Path<String>,
) -> Result<Json<BillIntel>, crate::models::AppError> {
    let intel = state
        .repo
        .get_bill(&bill_id)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
        .ok_or_else(|| crate::models::AppError::NotFound(format!("Bill {} not found", bill_id)))?;

    Ok(Json(intel))
}

/// GET /api/bills/{congress}/{bill_type}/{bill_number}/intel
///
/// Returns a complete bill intelligence profile including bill metadata,
/// actions, sponsors, cosponsors, subjects, text versions, related votes,
/// funding overlay, lobbying overlay, and provenance.
pub async fn get_bill_intel(
    State(state): State<Arc<AppState>>,
    Path((congress_str, bill_type, bill_number_str)): Path<(String, String, String)>,
) -> Result<Json<BillIntel>, crate::models::AppError> {
    let congress: i32 = congress_str.parse().map_err(|_| {
        crate::models::AppError::BadRequest(format!("Invalid congress: {}", congress_str))
    })?;
    let bill_number: i32 = bill_number_str.parse().map_err(|_| {
        crate::models::AppError::BadRequest(format!("Invalid bill_number: {}", bill_number_str))
    })?;

    let bill_type = bill_type.to_lowercase();
    let bill_id = schema::build_bill_id(congress, &bill_type, bill_number);

    let cache_key = format!("bills:intel:{}", bill_id);

    // Check cache first
    if let Some(cached) = state.cache.get(&cache_key).await {
        let intel: BillIntel = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(intel));
    }

    let mut intel = state
        .repo
        .get_bill(&bill_id)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
        .ok_or_else(|| {
            crate::models::AppError::NotFound(format!(
                "Bill {} not found in database. Run congress-bills ingest.",
                bill_id
            ))
        })?;

    // Compute additional lobbying overlay per subject/policy area
    let mut keywords: Vec<String> = Vec::new();
    if let Some(pa) = &intel.bill.policy_area {
        keywords.push(pa.to_lowercase());
    }
    for subject in &intel.subjects {
        for word in subject.split_whitespace() {
            let clean = word.trim_matches(|c: char| !c.is_alphanumeric());
            if clean.len() > 3 && !keywords.contains(&clean.to_lowercase()) {
                keywords.push(clean.to_lowercase());
            }
        }
    }

    // Append extra lobbying matches not already captured by the repo query
    let extra_keywords: Vec<String> = keywords
        .iter()
        .filter(|kw| {
            !intel
                .lobbying_overlay
                .iter()
                .any(|m| &m.matched_keyword == *kw)
        })
        .cloned()
        .collect();

    for kw in &extra_keywords {
        if let Ok(matches) = state.repo.find_lobbying_by_subject(kw, 3).await {
            for m in matches {
                if !intel
                    .lobbying_overlay
                    .iter()
                    .any(|ex| ex.filing_uuid == m.filing_uuid)
                {
                    intel.lobbying_overlay.push(m);
                }
            }
        }
    }

    // Cache the result
    let cache_value = serde_json::to_value(&intel)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(intel))
}
