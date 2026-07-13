//! Range-safe financial disclosure snapshots.
//!
//! A snapshot is an annual filing calculation, not an exact wealth estimate.
//! Nullable bounds are intentional: an unbounded disclosure category cannot
//! produce a finite upper (or lower) bound.

use crate::models::{ProvenanceSource, ProvenanceSummary};
use crate::routes::AppState;
use axum::extract::{Query, State};
use axum::Json;
use chrono::Datelike;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct SnapshotQuery {
    pub year: Option<i32>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct FinancialSnapshot {
    pub bioguide_id: String,
    pub member_name: String,
    pub chamber: String,
    pub state: String,
    pub reporting_year: i32,
    pub asset_min: f64,
    pub asset_max: Option<f64>,
    pub liability_min: f64,
    pub liability_max: Option<f64>,
    pub net_worth_min: Option<f64>,
    pub net_worth_max: Option<f64>,
    pub upper_bound_unavailable: bool,
    pub lower_bound_unavailable: bool,
    pub personal_residence_unavailable: bool,
    pub calculation_version: String,
    pub methodology_warnings: serde_json::Value,
    pub calculated_at: String,
}

#[derive(Debug, Serialize)]
pub struct FinancialSnapshotResponse {
    pub snapshots: Vec<FinancialSnapshot>,
    pub coverage: String,
    pub provenance: ProvenanceSummary,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SenateDisclosureReport {
    pub source_report_id: String,
    pub filer_name: String,
    pub report_type: String,
    pub report_url: String,
    pub submitted_date: Option<String>,
    pub bioguide_id: Option<String>,
    pub status: String,
    pub discovered_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SenateReportQuery {
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SenateDisclosureResponse {
    pub reports: Vec<SenateDisclosureReport>,
    pub coverage: String,
    pub provenance: ProvenanceSummary,
}

/// GET /api/financial-snapshots?year=2025&limit=200
pub async fn list_financial_snapshots(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SnapshotQuery>,
) -> Result<Json<FinancialSnapshotResponse>, crate::models::AppError> {
    let limit = query.limit.unwrap_or(600).clamp(1, 2_000);
    let year = query.year.unwrap_or_else(|| chrono::Utc::now().year());
    let snapshots = sqlx::query_as::<_, FinancialSnapshot>(
        r#"WITH latest AS (
               SELECT DISTINCT ON (fs.bioguide_id)
                      fs.bioguide_id,
                      m.official_full_name AS member_name,
                      m.current_chamber AS chamber,
                      m.current_state AS state,
                      fs.reporting_year,
                      fs.asset_min::float8 AS asset_min,
                      fs.asset_max::float8 AS asset_max,
                      fs.liability_min::float8 AS liability_min,
                      fs.liability_max::float8 AS liability_max,
                      fs.net_worth_min::float8 AS net_worth_min,
                      fs.net_worth_max::float8 AS net_worth_max,
                      fs.upper_bound_unavailable,
                      fs.lower_bound_unavailable,
                      fs.personal_residence_unavailable,
                      fs.calculation_version,
                      fs.methodology_warnings,
                      fs.calculated_at::text AS calculated_at
                 FROM financial_snapshots fs
                 JOIN members m ON m.bioguide_id = fs.bioguide_id
                WHERE fs.reporting_year <= $1
                ORDER BY fs.bioguide_id, fs.reporting_year DESC, fs.calculated_at DESC
           )
           SELECT * FROM latest
           ORDER BY net_worth_min DESC NULLS LAST, member_name
           LIMIT $2"#,
    )
    .bind(year)
    .bind(limit)
    .fetch_all(state.repo.pool())
    .await
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;

    let coverage = if snapshots.is_empty() {
        "empty"
    } else {
        "loaded"
    };
    let warnings = if snapshots.is_empty() {
        vec!["no_annual_disclosure_snapshots_loaded".to_string()]
    } else {
        Vec::new()
    };
    let contributing_sources: Vec<(String, String)> = sqlx::query_as(
        r#"SELECT documents.source, MAX(snapshots.calculated_at)::text
           FROM financial_snapshots snapshots
           JOIN disclosure_documents documents
             ON documents.document_id = snapshots.document_id
           WHERE snapshots.reporting_year <= $1
           GROUP BY documents.source
           ORDER BY documents.source"#,
    )
    .bind(year)
    .fetch_all(state.repo.pool())
    .await
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;
    Ok(Json(FinancialSnapshotResponse {
        snapshots,
        coverage: coverage.to_string(),
        provenance: ProvenanceSummary {
            sources: contributing_sources
                .into_iter()
                .map(|(source, calculated_at)| ProvenanceSource {
                    source,
                    status: "loaded".to_string(),
                    fetched_at: Some(calculated_at),
                    confidence: Some("reported_ranges".to_string()),
                })
                .collect(),
            warnings,
        },
    }))
}

/// GET /api/senate-disclosures?limit=100
pub async fn list_senate_disclosures(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SenateReportQuery>,
) -> Result<Json<SenateDisclosureResponse>, crate::models::AppError> {
    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let reports = sqlx::query_as::<_, SenateDisclosureReport>(
        r#"SELECT source_report_id, filer_name, report_type, report_url,
                  submitted_date::text AS submitted_date, bioguide_id, status,
                  discovered_at::text AS discovered_at
             FROM senate_disclosure_reports
            ORDER BY submitted_date DESC NULLS LAST, discovered_at DESC
            LIMIT $1"#,
    )
    .bind(limit)
    .fetch_all(state.repo.pool())
    .await
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;
    let terms_accepted = crate::senate_efd::operator_terms_accepted(
        std::env::var(crate::senate_efd::TERMS_ACCEPTANCE_ENV)
            .ok()
            .as_deref(),
    );
    let ambiguous_identity_count = reports
        .iter()
        .filter(|report| report.bioguide_id.is_none())
        .count();
    let parser_failure_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM senate_disclosure_reports WHERE parse_error IS NOT NULL",
    )
    .fetch_one(state.repo.pool())
    .await
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;
    let coverage = crate::senate_efd::coverage_status_detailed(
        reports.len(),
        terms_accepted,
        ambiguous_identity_count,
        parser_failure_count as usize,
    );
    Ok(Json(SenateDisclosureResponse {
        reports,
        coverage: coverage.to_string(),
        provenance: ProvenanceSummary {
            sources: vec![ProvenanceSource {
                source: "senate_efd".to_string(),
                status: coverage.to_string(),
                fetched_at: None,
                confidence: Some("official_report_links".to_string()),
            }],
            warnings: if coverage == "missing_filing" {
                vec!["senate_efd_no_filing_discovered".to_string()]
            } else if coverage == "missing_consent" {
                vec!["senate_efd_requires_explicit_operator_terms_acceptance".to_string()]
            } else if coverage == "ambiguous_identity" {
                vec!["senate_efd_member_identity_requires_review".to_string()]
            } else if coverage == "parser_failure" {
                vec!["senate_efd_parser_failure_requires_review".to_string()]
            } else {
                Vec::new()
            },
        },
    }))
}
