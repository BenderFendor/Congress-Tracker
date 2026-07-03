use crate::models::{CommitteeAssignment, CommitteeInfo, ProvenanceSource, ProvenanceSummary};
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ListCommitteesQuery {
    pub chamber: Option<String>,
    pub limit: Option<i64>,
}

/// Full committee detail including roster.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitteeDetail {
    pub committee_id: String,
    pub chamber: String,
    pub name: String,
    pub thomas_id: Option<String>,
    pub senate_committee_id: Option<String>,
    pub house_committee_id: Option<String>,
    pub jurisdiction: Option<String>,
    pub parent_committee_id: Option<String>,
    pub url: Option<String>,
    pub roster: Vec<CommitteeAssignment>,
    pub provenance: ProvenanceSummary,
}

/// GET /api/committees?chamber=&limit=
///
/// List committees with optional chamber filter.
pub async fn list_committees(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListCommitteesQuery>,
) -> Result<Json<Vec<CommitteeInfo>>, crate::models::AppError> {
    let chamber = query.chamber.as_deref();
    let limit = query.limit.unwrap_or(100);

    let cache_key = format!("committees:list:{}:{}", chamber.unwrap_or(""), limit);

    // Check cache first
    if let Some(cached) = state.cache.get(&cache_key).await {
        let committees: Vec<CommitteeInfo> = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(committees));
    }

    let pool = state.repo.pool();

    let rows: Vec<CommRow> = sqlx::query_as::<_, CommRow>(
        r#"SELECT committee_id, chamber, name, jurisdiction, thomas_id,
                  senate_committee_id, house_committee_id, url,
                  parent_committee_id
           FROM committees
           WHERE ($1::text IS NULL OR chamber = $1)
           ORDER BY chamber ASC, name ASC
           LIMIT $2"#,
    )
    .bind(chamber)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let committees: Vec<CommitteeInfo> = rows
        .into_iter()
        .map(|r| CommitteeInfo {
            committee_id: r.committee_id,
            chamber: r.chamber,
            name: r.name,
            jurisdiction: r.jurisdiction,
            committee_type: None,
        })
        .collect();

    // Cache the result
    let cache_value = serde_json::to_value(&committees)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(committees))
}

/// GET /api/committees/{committee_id}
///
/// Return a single committee with its full roster of members.
pub async fn get_committee(
    State(state): State<Arc<AppState>>,
    Path(committee_id): Path<String>,
) -> Result<Json<CommitteeDetail>, crate::models::AppError> {
    let cache_key = format!("committee:detail:{}", committee_id);

    // Check cache first
    if let Some(cached) = state.cache.get(&cache_key).await {
        let detail: CommitteeDetail = serde_json::from_value(cached).map_err(|_| {
            crate::models::AppError::Internal("cache deserialization failed".into())
        })?;
        return Ok(Json(detail));
    }

    let pool = state.repo.pool();

    // Load committee row
    let committee_row: Option<CommRow> = sqlx::query_as::<_, CommRow>(
        r#"SELECT committee_id, chamber, name, jurisdiction, thomas_id,
                  senate_committee_id, house_committee_id, url,
                  parent_committee_id
           FROM committees
           WHERE committee_id = $1"#,
    )
    .bind(&committee_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let row = committee_row.ok_or_else(|| {
        crate::models::AppError::NotFound(format!("Committee {} not found", committee_id))
    })?;

    // Load roster
    let roster: Vec<CommitteeAssignment> = sqlx::query_as::<_, RosterRow>(
        r#"SELECT cm.committee_id, c.name, c.chamber,
                  m.bioguide_id, m.first_name, m.last_name, m.current_party AS party,
                  m.current_state AS state, m.current_district AS district,
                  cm.rank, cm.title, cm.congress
           FROM committee_memberships cm
           JOIN committees c ON c.committee_id = cm.committee_id
           LEFT JOIN members m ON m.bioguide_id = cm.bioguide_id
           WHERE cm.committee_id = $1
           ORDER BY cm.congress DESC, cm.rank NULLS LAST"#,
    )
    .bind(&committee_id)
    .fetch_all(pool)
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?
    .into_iter()
    .map(|r| CommitteeAssignment {
        bioguide_id: r.bioguide_id,
        first_name: r.first_name,
        last_name: r.last_name,
        party: r.party,
        state: r.state,
        district: r.district,
        committee_id: Some(r.committee_id),
        name: Some(r.name),
        chamber: Some(r.chamber),
        rank: r.rank,
        title: r.title,
        congress: Some(r.congress),
    })
    .collect();

    let provenance = ProvenanceSummary {
        sources: vec![ProvenanceSource {
            source: "unitedstates_legislators".to_string(),
            status: "loaded".to_string(),
            fetched_at: None,
            confidence: Some("verified".to_string()),
        }],
        warnings: Vec::new(),
    };

    let detail = CommitteeDetail {
        committee_id: row.committee_id,
        chamber: row.chamber,
        name: row.name,
        thomas_id: row.thomas_id,
        senate_committee_id: row.senate_committee_id,
        house_committee_id: row.house_committee_id,
        jurisdiction: row.jurisdiction,
        parent_committee_id: row.parent_committee_id,
        url: row.url,
        roster,
        provenance,
    };

    // Cache the result
    let cache_value = serde_json::to_value(&detail)
        .map_err(|_| crate::models::AppError::Internal("serialization failed".into()))?;
    state.cache.set(cache_key, cache_value).await;

    Ok(Json(detail))
}

// ── Private row types ──────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct CommRow {
    committee_id: String,
    chamber: String,
    name: String,
    jurisdiction: Option<String>,
    thomas_id: Option<String>,
    senate_committee_id: Option<String>,
    house_committee_id: Option<String>,
    url: Option<String>,
    parent_committee_id: Option<String>,
}

#[derive(sqlx::FromRow)]
struct RosterRow {
    committee_id: String,
    name: String,
    chamber: String,
    bioguide_id: Option<String>,
    first_name: Option<String>,
    last_name: Option<String>,
    party: Option<String>,
    state: Option<String>,
    district: Option<String>,
    rank: Option<i32>,
    title: Option<String>,
    congress: i32,
}
