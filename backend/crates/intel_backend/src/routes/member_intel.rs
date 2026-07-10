use crate::models::{MemberVoteSummary, ProvenanceSource, ProvenanceSummary, VotePosition};
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use chrono::NaiveDate;
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
    pub sponsor_type: String,
    pub sponsorship_date: Option<NaiveDate>,
    pub is_original_cosponsor: bool,
}

#[derive(Debug, Serialize)]
pub struct MemberLegislationResponse {
    pub bioguide_id: String,
    pub congress: Option<i32>,
    pub sponsor: Vec<MemberLegislationItem>,
    pub cosponsor: Vec<MemberLegislationItem>,
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
    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let offset = query.offset.unwrap_or(0).max(0);
    let role = query.role.unwrap_or_default().to_lowercase();
    if !role.is_empty() && role != "sponsor" && role != "cosponsor" {
        return Err(crate::models::AppError::BadRequest(
            "role must be sponsor or cosponsor".to_string(),
        ));
    }

    let rows: Vec<MemberLegislationItem> = sqlx::query_as(
        r#"SELECT b.bill_id, b.congress, b.bill_type, b.bill_number, b.title,
                  b.status, b.introduced_date, b.latest_action_date,
                  b.latest_action_text, bs.sponsor_type, bs.sponsorship_date,
                  bs.is_original_cosponsor
           FROM bill_sponsors bs
           JOIN bills b ON b.bill_id = bs.bill_id
           WHERE bs.bioguide_id = $1
             AND ($2::int IS NULL OR b.congress = $2)
             AND ($3 = '' OR bs.sponsor_type = $3)
           ORDER BY b.latest_action_date DESC NULLS LAST,
                    b.introduced_date DESC NULLS LAST, b.bill_id
           LIMIT $4 OFFSET $5"#,
    )
    .bind(&bioguide_id)
    .bind(query.congress)
    .bind(&role)
    .bind(limit)
    .bind(offset)
    .fetch_all(state.repo.pool())
    .await
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    let mut sponsor = Vec::new();
    let mut cosponsor = Vec::new();
    for row in rows {
        if row.sponsor_type == "sponsor" {
            sponsor.push(row);
        } else {
            cosponsor.push(row);
        }
    }

    let status = if sponsor.is_empty() && cosponsor.is_empty() {
        "empty"
    } else {
        "loaded"
    };
    let response_congress = query.congress.or_else(|| {
        sponsor
            .first()
            .map(|item| item.congress)
            .or_else(|| cosponsor.first().map(|item| item.congress))
    });
    Ok(Json(MemberLegislationResponse {
        bioguide_id,
        congress: response_congress,
        sponsor,
        cosponsor,
        provenance: ProvenanceSummary {
            sources: vec![ProvenanceSource {
                source: "congress_gov".to_string(),
                status: status.to_string(),
                fetched_at: None,
                confidence: Some("verified".to_string()),
            }],
            warnings: if status == "empty" {
                vec!["no_sponsorship_rows_loaded_for_filters".to_string()]
            } else {
                Vec::new()
            },
        },
    }))
}
