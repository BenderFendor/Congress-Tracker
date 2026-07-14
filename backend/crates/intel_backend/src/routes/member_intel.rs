use crate::models::{MemberVoteSummary, ProvenanceSource, ProvenanceSummary, VotePosition};
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct MemberVotesQuery {
    pub congress: Option<i32>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct MemberVotesResponse {
    pub bioguide_id: String,
    pub congress: i32,
    pub summary: Option<MemberVoteSummary>,
    pub votes: Vec<VotePosition>,
    pub provenance: ProvenanceSummary,
}

/// GET /api/members/{bioguide_id}/votes
///
/// Returns the canonical member vote summary and paginated roll-call
/// positions. This replaces the legacy server's aggregate /api/congress/votes
/// endpoint, which cannot be used when intel_backend is the active server.
pub async fn get_member_votes(
    State(state): State<Arc<AppState>>,
    Path(bioguide_id): Path<String>,
    Query(query): Query<MemberVotesQuery>,
) -> Result<Json<MemberVotesResponse>, crate::models::AppError> {
    let congress = query.congress.unwrap_or(119);
    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let offset = query.offset.unwrap_or(0).max(0);

    let member_exists: Option<(String,)> =
        sqlx::query_as("SELECT bioguide_id FROM members WHERE bioguide_id = $1")
            .bind(&bioguide_id)
            .fetch_optional(state.repo.pool())
            .await
            .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    if member_exists.is_none() {
        return Err(crate::models::AppError::NotFound(format!(
            "Member {} not found",
            bioguide_id
        )));
    }

    let summary = state
        .repo
        .get_member_vote_summary(&bioguide_id, congress)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;
    let votes = state
        .repo
        .get_member_votes_for_congress(&bioguide_id, congress, limit, offset)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;
    let vote_status = if votes.is_empty() { "empty" } else { "loaded" };
    let vote_warnings = if votes.is_empty() {
        vec!["no_vote_positions_loaded_for_congress".to_string()]
    } else {
        Vec::new()
    };

    Ok(Json(MemberVotesResponse {
        bioguide_id,
        congress,
        summary,
        votes,
        provenance: ProvenanceSummary {
            sources: vec![ProvenanceSource {
                source: "congressional_roll_calls".to_string(),
                status: vote_status.to_string(),
                fetched_at: None,
                confidence: Some("verified".to_string()),
            }],
            warnings: vote_warnings,
        },
    }))
}

#[derive(Debug, Deserialize)]
pub struct MemberLegislationQuery {
    pub congress: Option<i32>,
    pub role: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sponsor_offset: Option<i64>,
    pub cosponsor_offset: Option<i64>,
    pub related_offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct MemberLegislationItem {
    pub bill_id: String,
    pub congress: i32,
    pub bill_type: String,
    pub bill_number: i32,
    pub title: String,
    pub status: String,
    pub introduced_date: Option<NaiveDate>,
    pub latest_action_date: Option<NaiveDate>,
    pub latest_action_text: Option<String>,
    pub url: Option<String>,
    pub sponsor_type: String,
    pub sponsorship_date: Option<NaiveDate>,
    pub is_original_cosponsor: bool,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct MemberRelatedLegislationItem {
    pub congress: i32,
    pub item_kind: String,
    pub item_type: Option<String>,
    pub item_number: Option<i32>,
    pub title: Option<String>,
    pub source_url: String,
    pub latest_action_date: Option<NaiveDate>,
    pub latest_action_text: Option<String>,
    pub sponsor_type: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct MemberLegislationCoverageItem {
    pub refresh_congress: i32,
    pub role: String,
    pub status: String,
    pub advertised_count: Option<i64>,
    pub rows_seen: i64,
    pub rows_written: i64,
    pub duplicate_rows: i64,
    pub pages_fetched: i32,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct MemberLegislationLatestAttempt {
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MemberLegislationPage {
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
    pub has_more: bool,
}

impl MemberLegislationPage {
    fn new(total: i64, limit: i64, offset: i64, returned: usize) -> Self {
        Self {
            total,
            limit,
            offset,
            has_more: offset.saturating_add(returned as i64) < total,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct MemberLegislationPagination {
    pub sponsor: MemberLegislationPage,
    pub cosponsor: MemberLegislationPage,
    pub related_items: MemberLegislationPage,
}

#[derive(Debug, Serialize)]
pub struct MemberLegislationResponse {
    pub bioguide_id: String,
    pub congress: Option<i32>,
    pub sponsor: Vec<MemberLegislationItem>,
    pub cosponsor: Vec<MemberLegislationItem>,
    pub related_items: Vec<MemberRelatedLegislationItem>,
    pub pagination: MemberLegislationPagination,
    pub coverage_scope: &'static str,
    pub coverage_snapshot_congress: Option<i32>,
    pub coverage: Vec<MemberLegislationCoverageItem>,
    pub latest_attempt: Option<MemberLegislationLatestAttempt>,
    pub provenance: ProvenanceSummary,
}

/// GET /api/members/{bioguide_id}/legislation
///
/// Returns legislation linked through bill_sponsors. A member search or bill
/// title match is deliberately not used as a substitute for this relation.
pub async fn get_member_legislation(
    State(state): State<Arc<AppState>>,
    Path(bioguide_id): Path<String>,
    Query(query): Query<MemberLegislationQuery>,
) -> Result<Json<MemberLegislationResponse>, crate::models::AppError> {
    let member_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM members WHERE bioguide_id=$1)")
            .bind(&bioguide_id)
            .fetch_one(state.repo.pool())
            .await
            .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;
    if !member_exists {
        return Err(crate::models::AppError::NotFound(format!(
            "Member {} not found",
            bioguide_id
        )));
    }

    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let fallback_offset = query.offset.unwrap_or(0).max(0);
    let sponsor_offset = query.sponsor_offset.unwrap_or(fallback_offset).max(0);
    let cosponsor_offset = query.cosponsor_offset.unwrap_or(fallback_offset).max(0);
    let related_offset = query.related_offset.unwrap_or(fallback_offset).max(0);
    let role = query.role.unwrap_or_default().to_lowercase();
    if !role.is_empty() && role != "sponsor" && role != "cosponsor" {
        return Err(crate::models::AppError::BadRequest(
            "role must be sponsor or cosponsor".to_string(),
        ));
    }

    let sponsor: Vec<MemberLegislationItem> = sqlx::query_as(
        r#"SELECT b.bill_id, b.congress, b.bill_type, b.bill_number, b.title,
                  b.status, b.introduced_date, b.latest_action_date,
                  b.latest_action_text, b.url, bs.sponsor_type, bs.sponsorship_date,
                  bs.is_original_cosponsor
           FROM bill_sponsors bs
           JOIN bills b ON b.bill_id = bs.bill_id
           WHERE bs.bioguide_id = $1
             AND ($2::int IS NULL OR b.congress = $2)
             AND bs.sponsor_type = 'sponsor'
             AND ($3 = '' OR $3 = 'sponsor')
           ORDER BY b.latest_action_date DESC NULLS LAST,
                    b.introduced_date DESC NULLS LAST, b.bill_id
           LIMIT $4 OFFSET $5"#,
    )
    .bind(&bioguide_id)
    .bind(query.congress)
    .bind(&role)
    .bind(limit)
    .bind(sponsor_offset)
    .fetch_all(state.repo.pool())
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let cosponsor: Vec<MemberLegislationItem> = sqlx::query_as(
        r#"SELECT b.bill_id, b.congress, b.bill_type, b.bill_number, b.title,
                  b.status, b.introduced_date, b.latest_action_date,
                  b.latest_action_text, b.url, bs.sponsor_type, bs.sponsorship_date,
                  bs.is_original_cosponsor
           FROM bill_sponsors bs
           JOIN bills b ON b.bill_id = bs.bill_id
           WHERE bs.bioguide_id = $1
             AND ($2::int IS NULL OR b.congress = $2)
             AND bs.sponsor_type = 'cosponsor'
             AND ($3 = '' OR $3 = 'cosponsor')
           ORDER BY b.latest_action_date DESC NULLS LAST,
                    b.introduced_date DESC NULLS LAST, b.bill_id
           LIMIT $4 OFFSET $5"#,
    )
    .bind(&bioguide_id)
    .bind(query.congress)
    .bind(&role)
    .bind(limit)
    .bind(cosponsor_offset)
    .fetch_all(state.repo.pool())
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let related_items: Vec<MemberRelatedLegislationItem> = sqlx::query_as(
        r#"SELECT congress, item_kind, item_type, item_number, title, source_url,
                  latest_action_date, latest_action_text, role AS sponsor_type
           FROM member_legislation_items
           WHERE bioguide_id=$1 AND item_kind <> 'bill'
             AND ($2::int IS NULL OR congress=$2)
             AND ($3='' OR role=$3)
           ORDER BY latest_action_date DESC NULLS LAST, source_url
           LIMIT $4 OFFSET $5"#,
    )
    .bind(&bioguide_id)
    .bind(query.congress)
    .bind(&role)
    .bind(limit)
    .bind(related_offset)
    .fetch_all(state.repo.pool())
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let sponsor_total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)
           FROM bill_sponsors bs
           JOIN bills b ON b.bill_id = bs.bill_id
           WHERE bs.bioguide_id=$1
             AND bs.sponsor_type='sponsor'
             AND ($2::int IS NULL OR b.congress=$2)
             AND ($3='' OR $3='sponsor')"#,
    )
    .bind(&bioguide_id)
    .bind(query.congress)
    .bind(&role)
    .fetch_one(state.repo.pool())
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;
    let cosponsor_total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)
           FROM bill_sponsors bs
           JOIN bills b ON b.bill_id = bs.bill_id
           WHERE bs.bioguide_id=$1
             AND bs.sponsor_type='cosponsor'
             AND ($2::int IS NULL OR b.congress=$2)
             AND ($3='' OR $3='cosponsor')"#,
    )
    .bind(&bioguide_id)
    .bind(query.congress)
    .bind(&role)
    .fetch_one(state.repo.pool())
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;
    let related_total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM member_legislation_items
           WHERE bioguide_id=$1 AND item_kind <> 'bill'
             AND ($2::int IS NULL OR congress=$2)
             AND ($3='' OR role=$3)"#,
    )
    .bind(&bioguide_id)
    .bind(query.congress)
    .bind(&role)
    .fetch_one(state.repo.pool())
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let coverage: Vec<MemberLegislationCoverageItem> = sqlx::query_as(
        r#"SELECT coverage.congress AS refresh_congress, coverage.role, coverage.status,
                  coverage.advertised_count,
                  coverage.rows_seen, coverage.rows_written, coverage.duplicate_rows,
                  coverage.pages_fetched,
                  coverage.error_message
           FROM member_legislation_coverage coverage
           WHERE coverage.bioguide_id=$1
             AND coverage.source_run_id=(
               SELECT prior.source_run_id
               FROM member_legislation_coverage prior
               WHERE prior.bioguide_id=$1 AND prior.status <> 'running'
               ORDER BY prior.finished_at DESC NULLS LAST
               LIMIT 1
             )
           ORDER BY coverage.role"#,
    )
    .bind(&bioguide_id)
    .fetch_all(state.repo.pool())
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let latest_attempt: Option<MemberLegislationLatestAttempt> = sqlx::query_as(
        r#"SELECT status::text AS status, started_at, finished_at, error_message
           FROM source_runs
           WHERE endpoint='/v3/member/{bioguide}/sponsored-and-cosponsored-legislation'
           ORDER BY started_at DESC
           LIMIT 1"#,
    )
    .fetch_optional(state.repo.pool())
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let coverage_loaded = coverage.len() == 2
        && coverage.iter().all(|item| {
            item.status == "loaded"
                && item.advertised_count == Some(item.rows_seen)
                && item.rows_written + item.duplicate_rows == item.rows_seen
        });
    let status = if coverage_loaded {
        "loaded"
    } else if coverage.is_empty() {
        "not_loaded"
    } else {
        "partial"
    };
    let pagination = MemberLegislationPagination {
        sponsor: MemberLegislationPage::new(sponsor_total, limit, sponsor_offset, sponsor.len()),
        cosponsor: MemberLegislationPage::new(
            cosponsor_total,
            limit,
            cosponsor_offset,
            cosponsor.len(),
        ),
        related_items: MemberLegislationPage::new(
            related_total,
            limit,
            related_offset,
            related_items.len(),
        ),
    };
    let coverage_snapshot_congress = coverage.first().map(|item| item.refresh_congress);
    let refresh_warning =
        latest_attempt
            .as_ref()
            .and_then(|attempt| match attempt.status.as_str() {
                "success" => None,
                "running" => Some("member_legislation_refresh_running".to_string()),
                status => Some(match attempt.error_message.as_deref() {
                    Some(error) => format!("member_legislation_latest_attempt_{status}: {error}"),
                    None => format!("member_legislation_latest_attempt_{status}"),
                }),
            });
    Ok(Json(MemberLegislationResponse {
        bioguide_id,
        congress: query.congress,
        sponsor,
        cosponsor,
        related_items,
        pagination,
        coverage_scope: "all_history",
        coverage_snapshot_congress,
        coverage: coverage.clone(),
        latest_attempt,
        provenance: ProvenanceSummary {
            sources: vec![ProvenanceSource {
                source: "congress_gov".to_string(),
                status: status.to_string(),
                fetched_at: None,
                confidence: Some("verified".to_string()),
            }],
            warnings: if status == "loaded" {
                refresh_warning.into_iter().collect()
            } else if coverage.is_empty() {
                let mut warnings = vec!["member_legislation_coverage_not_loaded".to_string()];
                warnings.extend(refresh_warning);
                warnings
            } else {
                let mut warnings: Vec<String> = coverage
                    .iter()
                    .filter_map(|item| {
                        item.error_message
                            .as_ref()
                            .map(|error| format!("{}: {error}", item.role))
                    })
                    .collect();
                warnings.extend(refresh_warning);
                warnings
            },
        },
    }))
}
