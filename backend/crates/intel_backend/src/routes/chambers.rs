use crate::models::ChamberDashboard;
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct DashboardQuery {
    pub congress: Option<i32>,
}

/// GET /api/chambers/{chamber}/dashboard?congress=119
///
/// Returns a chamber-level dashboard with member count, party breakdown,
/// average ideology score, and total direct campaign receipts.
pub async fn get_dashboard(
    State(state): State<Arc<AppState>>,
    Path(chamber): Path<String>,
    Query(query): Query<DashboardQuery>,
) -> Result<Json<ChamberDashboard>, crate::models::AppError> {
    let congress = query.congress.unwrap_or(119);
    let chamber_lower = chamber.to_lowercase();

    let cache_key = format!("chambers:dashboard:{}:{}", chamber_lower, congress);

    // Check cache first
    if let Some(cached) = state.cache.get(&cache_key).await {
        let dashboard: ChamberDashboard = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(dashboard));
    }

    let pool = state.repo.pool();

    // Member count for chamber
    let member_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint
           FROM members
           WHERE LOWER(current_chamber) = $1
             AND in_office = true"#,
    )
    .bind(&chamber_lower)
    .fetch_one(pool)
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    // Party breakdown
    let party_rows: Vec<(String, i64)> = sqlx::query_as(
        r#"SELECT current_party, COUNT(*)::bigint AS cnt
           FROM members
           WHERE LOWER(current_chamber) = $1
             AND in_office = true
           GROUP BY current_party
           ORDER BY cnt DESC"#,
    )
    .bind(&chamber_lower)
    .fetch_all(pool)
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let mut party_breakdown = HashMap::new();
    for (party, cnt) in party_rows {
        party_breakdown.insert(party, cnt);
    }

    // Average NOMINATE dimension 1 score for current members
    let avg_nominate: Option<f64> = sqlx::query_scalar(
        r#"SELECT AVG(nominate_dim1)::double precision
           FROM members
           WHERE LOWER(current_chamber) = $1
             AND in_office = true
             AND nominate_dim1 IS NOT NULL"#,
    )
    .bind(&chamber_lower)
    .fetch_optional(pool)
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
    .flatten();

    // Total direct receipts from the materialized view for this congress
    let total_receipts: f64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(direct_receipts), 0)::double precision
           FROM member_funding_cycle_mv mfv
           JOIN members m ON m.bioguide_id = mfv.bioguide_id
           WHERE LOWER(m.current_chamber) = $1
             AND mfv.cycle = $2"#,
    )
    .bind(&chamber_lower)
    .bind(congress)
    .fetch_one(pool)
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let dashboard = ChamberDashboard {
        chamber: chamber_lower,
        congress,
        member_count,
        party_breakdown,
        avg_nominate_dim1: avg_nominate,
        total_direct_receipts: total_receipts,
    };

    // Cache the result
    let cache_value = serde_json::to_value(&dashboard)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(dashboard))
}
