use crate::models::AppError;
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use chrono::{DateTime, Utc};
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
    pub cycle: Option<i32>,
    pub source_run_status: Option<String>,
    pub source_updated_at: Option<DateTime<Utc>>,
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

#[derive(Debug, sqlx::FromRow)]
struct CandidateImportCoverage {
    archive_count: i64,
    canonicalized_count: i64,
    source_updated_at: Option<DateTime<Utc>>,
    unresolved_linkage_issues: i64,
    source_run_status: Option<String>,
}

fn candidate_coverage_status(
    archive_count: i64,
    canonicalized_count: i64,
    unresolved_linkage_issues: i64,
    source_run_status: Option<&str>,
    has_committee_links: bool,
) -> (&'static str, &'static str) {
    let import_complete = archive_count == 3
        && canonicalized_count == 3
        && unresolved_linkage_issues == 0
        && source_run_status == Some("success");
    if import_complete {
        return (
            "loaded",
            if has_committee_links {
                "loaded"
            } else {
                "loaded_empty"
            },
        );
    }
    if archive_count > 0 || source_run_status.is_some() {
        ("partial", "partial")
    } else {
        ("not_loaded", "not_loaded")
    }
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

    let coverage_cycle = query.cycle.or(candidate.active_through);

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
    .bind(coverage_cycle)
    .fetch_all(state.repo.pool())
    .await
    .map_err(|error| AppError::Internal(format!("database error: {error}")))?;

    let import_coverage = if let Some(cycle) = coverage_cycle {
        let suffix = cycle.rem_euclid(100);
        Some(
            sqlx::query_as::<_, CandidateImportCoverage>(
                r#"WITH latest_imports AS (
                       SELECT DISTINCT ON (dataset_name)
                              dataset_name, status, canonicalized_at
                       FROM fec_bulk_imports
                       WHERE election_cycle = $1
                         AND dataset_name IN ($2, $3, $4)
                       ORDER BY dataset_name, checked_at DESC, downloaded_at DESC
                   ), latest_run AS (
                       SELECT status::text AS status
                       FROM source_runs
                       WHERE source = 'openfec' AND endpoint = $5
                       ORDER BY started_at DESC
                       LIMIT 1
                   )
                   SELECT COUNT(*)::bigint AS archive_count,
                          COUNT(*) FILTER (WHERE status = 'canonicalized')::bigint
                              AS canonicalized_count,
                          MAX(canonicalized_at) AS source_updated_at,
                          COALESCE((
                              SELECT COUNT(*)::bigint
                              FROM fec_linkage_issues
                              WHERE election_cycle = $1 AND resolved_at IS NULL
                          ), 0)::bigint AS unresolved_linkage_issues,
                          (SELECT status FROM latest_run) AS source_run_status
                   FROM latest_imports"#,
            )
            .bind(cycle)
            .bind(format!("cn{suffix:02}"))
            .bind(format!("cm{suffix:02}"))
            .bind(format!("ccl{suffix:02}"))
            .bind(format!("/files/bulk-downloads/{cycle}"))
            .fetch_one(state.repo.pool())
            .await
            .map_err(|error| AppError::Internal(format!("database error: {error}")))?,
        )
    } else {
        None
    };

    let (candidate_status, committee_status) =
        import_coverage
            .as_ref()
            .map_or(("not_loaded", "not_loaded"), |coverage| {
                candidate_coverage_status(
                    coverage.archive_count,
                    coverage.canonicalized_count,
                    coverage.unresolved_linkage_issues,
                    coverage.source_run_status.as_deref(),
                    !committees.is_empty(),
                )
            });

    let mut warnings = Vec::new();
    if committee_status == "loaded_empty" {
        warnings.push(match coverage_cycle {
            Some(cycle) => format!(
                "The complete cycle {cycle} import reports no official candidate-committee link for candidate {candidate_id}."
            ),
            None => format!(
                "No official candidate-committee link is reported for candidate {candidate_id}."
            ),
        });
    }
    if committee_status == "partial" || committee_status == "not_loaded" {
        warnings.push(format!(
            "FEC candidate and committee-link coverage for {} is {committee_status}; missing links are not evidence that none exist.",
            coverage_cycle.map_or_else(|| "the requested record".to_string(), |cycle| format!("cycle {cycle}"))
        ));
    }
    if let Some(coverage) = import_coverage.as_ref() {
        if coverage.unresolved_linkage_issues > 0 {
            warnings.push(format!(
                "{} official candidate-committee linkage rows remain unresolved for this cycle.",
                coverage.unresolved_linkage_issues
            ));
        }
        if coverage.source_run_status.as_deref() != Some("success") {
            warnings.push(format!(
                "The latest FEC bulk source run is {}; coverage is not terminal.",
                coverage.source_run_status.as_deref().unwrap_or("missing")
            ));
        }
    }

    Ok(Json(CandidateDetailResponse {
        coverage: CandidateCoverage {
            candidate: candidate_status,
            committee_links: committee_status,
            cycle: coverage_cycle,
            source_run_status: import_coverage
                .as_ref()
                .and_then(|coverage| coverage.source_run_status.clone()),
            source_updated_at: import_coverage
                .as_ref()
                .and_then(|coverage| coverage.source_updated_at),
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
    use super::{candidate_coverage_status, validate_candidate_id, validate_cycle};

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

    #[test]
    fn candidate_coverage_requires_terminal_identity_imports() {
        assert_eq!(
            candidate_coverage_status(3, 3, 0, Some("success"), true),
            ("loaded", "loaded")
        );
        assert_eq!(
            candidate_coverage_status(3, 3, 0, Some("success"), false),
            ("loaded", "loaded_empty")
        );
        assert_eq!(
            candidate_coverage_status(3, 3, 0, Some("partial"), true),
            ("partial", "partial")
        );
        assert_eq!(
            candidate_coverage_status(3, 3, 1, Some("success"), true),
            ("partial", "partial")
        );
        assert_eq!(
            candidate_coverage_status(0, 0, 0, None, false),
            ("not_loaded", "not_loaded")
        );
    }
}
