use crate::models::AppError;
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CandidateDetailQuery {
    pub cycle: Option<i32>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CandidateDetail {
    pub candidate_id: String,
    pub name: String,
    pub party: Option<String>,
    pub state: Option<String>,
    pub district: Option<String>,
    pub office: Option<String>,
    pub incumbent_challenge: Option<String>,
    pub active_through: Option<i32>,
    pub first_file_date: Option<String>,
    pub last_file_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct CandidateCommittee {
    pub committee_id: String,
    pub committee_name: String,
    pub election_cycle: i32,
    pub committee_type: Option<String>,
    pub committee_designation: Option<String>,
    pub is_principal: bool,
}

#[derive(Debug, Serialize)]
pub struct CandidateCoverage {
    pub candidate: &'static str,
    pub committee_links: &'static str,
    pub requested_cycle: Option<i32>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CandidateProvenance {
    pub source: &'static str,
    pub source_url: String,
    pub scope: &'static str,
}

#[derive(Debug, Serialize)]
pub struct CandidateDetailResponse {
    pub candidate: CandidateDetail,
    pub committees: Vec<CandidateCommittee>,
    pub coverage: CandidateCoverage,
    pub provenance: CandidateProvenance,
}

fn validate_candidate_id(candidate_id: &str) -> Result<(), AppError> {
    let valid = !candidate_id.is_empty()
        && candidate_id.len() <= 32
        && candidate_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric());
    if valid {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "candidate_id must be a non-empty alphanumeric FEC identifier".to_string(),
        ))
    }
}

fn validate_cycle(cycle: Option<i32>) -> Result<(), AppError> {
    if cycle.is_some_and(|value| value < 1980 || value % 2 != 0) {
        return Err(AppError::BadRequest(
            "cycle must be an even FEC election year at or after 1980".to_string(),
        ));
    }
    Ok(())
}

/// GET /api/elections/candidates/:candidate_id
///
/// Returns one exact FEC candidate identity and its official candidate-committee
/// links. This contract never resolves a congressional Member by name.
pub async fn get_candidate(
    State(state): State<Arc<AppState>>,
    Path(candidate_id): Path<String>,
    Query(query): Query<CandidateDetailQuery>,
) -> Result<Json<CandidateDetailResponse>, AppError> {
    validate_candidate_id(&candidate_id)?;
    validate_cycle(query.cycle)?;

    let candidate: CandidateDetail = sqlx::query_as(
        r#"SELECT candidate_id, name, party, state, district, office,
                  incumbent_challenge, active_through,
                  first_file_date::text AS first_file_date,
                  last_file_date::text AS last_file_date
           FROM fec_candidates
           WHERE candidate_id = $1"#,
    )
    .bind(&candidate_id)
    .fetch_optional(state.repo.pool())
    .await
    .map_err(|error| AppError::Internal(format!("database error: {error}")))?
    .ok_or_else(|| AppError::NotFound(format!("candidate {candidate_id} was not found")))?;

    let committees: Vec<CandidateCommittee> = sqlx::query_as(
        r#"SELECT link.committee_id,
                  committee.name AS committee_name,
                  link.election_cycle,
                  link.committee_type,
                  link.committee_designation,
                  COALESCE(link.committee_designation = 'P', false) AS is_principal
           FROM fec_candidate_committees link
           JOIN fec_committees committee ON committee.committee_id = link.committee_id
           WHERE link.candidate_id = $1
             AND ($2::integer IS NULL OR link.election_cycle = $2)
           ORDER BY link.election_cycle DESC,
                    COALESCE(link.committee_designation = 'P', false) DESC,
                    committee.name ASC,
                    link.committee_id ASC"#,
    )
    .bind(&candidate_id)
    .bind(query.cycle)
    .fetch_all(state.repo.pool())
    .await
    .map_err(|error| AppError::Internal(format!("database error: {error}")))?;

    let mut warnings = Vec::new();
    if committees.is_empty() {
        warnings.push(match query.cycle {
            Some(cycle) => format!(
                "No official candidate-committee link is loaded for candidate {candidate_id} in cycle {cycle}."
            ),
            None => format!(
                "No official candidate-committee link is loaded for candidate {candidate_id}."
            ),
        });
    }

    Ok(Json(CandidateDetailResponse {
        coverage: CandidateCoverage {
            candidate: "loaded",
            committee_links: if committees.is_empty() {
                "not_loaded"
            } else {
                "loaded"
            },
            requested_cycle: query.cycle,
            warnings,
        },
        provenance: CandidateProvenance {
            source: "Federal Election Commission",
            source_url: format!("https://www.fec.gov/data/candidate/{candidate_id}/"),
            scope: "Exact candidate identity and official candidate-committee links",
        },
        candidate,
        committees,
    }))
}

#[cfg(test)]
mod tests {
    use super::{validate_candidate_id, validate_cycle};

    #[test]
    fn candidate_identifiers_are_bounded_and_alphanumeric() {
        assert!(validate_candidate_id("H0CA12345").is_ok());
        assert!(validate_candidate_id("").is_err());
        assert!(validate_candidate_id("H0CA12/345").is_err());
        assert!(validate_candidate_id(&"A".repeat(33)).is_err());
    }

    #[test]
    fn candidate_cycles_are_even_and_bounded() {
        assert!(validate_cycle(None).is_ok());
        assert!(validate_cycle(Some(2026)).is_ok());
        assert!(validate_cycle(Some(2025)).is_err());
        assert!(validate_cycle(Some(1978)).is_err());
    }
}
