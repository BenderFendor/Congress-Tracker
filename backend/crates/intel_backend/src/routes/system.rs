use crate::routes::AppState;
use axum::extract::State;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, Serialize)]
pub struct DisclosureCoverage {
    pub source: String,
    pub last_checked_at: Option<DateTime<Utc>>,
    pub years_discovered: Vec<i32>,
    pub documents_discovered: i64,
    pub documents_downloaded: i64,
    pub documents_parsed: i64,
    pub documents_with_issues: i64,
    pub transactions_parsed: i64,
    pub backfill_status: String,
    pub oldest_completed_year: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct WorkerHealth {
    pub instances: Vec<WorkerInstance>,
    pub pending_jobs: i64,
    pub failed_jobs: i64,
    pub active_jobs: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WorkerInstance {
    pub instance_id: String,
    pub last_heartbeat: DateTime<Utc>,
    pub current_job_type: Option<String>,
}

/// GET /api/system/disclosure-coverage
///
/// Returns current pipeline coverage statistics.
pub async fn coverage(
    State(state): State<Arc<AppState>>,
) -> Result<Json<DisclosureCoverage>, crate::models::AppError> {
    let years: Vec<(i32,)> = sqlx::query_as(
        "SELECT DISTINCT source_year FROM source_index_entries WHERE source_name = 'house_clerk' ORDER BY source_year",
    )
    .fetch_all(state.repo.pool())
    .await
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;

    let docs_discovered: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM source_index_entries WHERE source_name = 'house_clerk'",
    )
    .fetch_one(state.repo.pool())
    .await
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;

    let docs_downloaded: (i64,) =
        sqlx::query_as("SELECT COUNT(DISTINCT document_id) FROM document_versions")
            .fetch_one(state.repo.pool())
            .await
            .map_err(|error| {
                crate::models::AppError::Internal(format!("database error: {error}"))
            })?;

    let docs_parsed: (i64,) = sqlx::query_as(
        "SELECT COUNT(DISTINCT document_version_id) FROM parse_attempts WHERE status = 'success'",
    )
    .fetch_one(state.repo.pool())
    .await
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;

    let docs_with_issues: (i64,) = sqlx::query_as(
        "SELECT COUNT(DISTINCT parse_attempt_id) FROM parse_issues WHERE resolved = false",
    )
    .fetch_one(state.repo.pool())
    .await
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;

    let transactions_parsed: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM disclosure_transactions")
            .fetch_one(state.repo.pool())
            .await
            .map_err(|error| {
                crate::models::AppError::Internal(format!("database error: {error}"))
            })?;

    let oldest: (Option<i32>,) = sqlx::query_as(
        "SELECT MIN(source_year) FROM source_index_entries WHERE source_name = 'house_clerk'",
    )
    .fetch_one(state.repo.pool())
    .await
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;

    let last_checked: (Option<DateTime<Utc>>,) = sqlx::query_as(
        "SELECT MAX(discovered_at) FROM source_index_entries WHERE source_name = 'house_clerk'",
    )
    .fetch_one(state.repo.pool())
    .await
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;

    Ok(Json(DisclosureCoverage {
        source: "house_clerk".to_string(),
        last_checked_at: last_checked.0,
        years_discovered: years.into_iter().map(|(y,)| y).collect(),
        documents_discovered: docs_discovered.0,
        documents_downloaded: docs_downloaded.0,
        documents_parsed: docs_parsed.0,
        documents_with_issues: docs_with_issues.0,
        transactions_parsed: transactions_parsed.0,
        backfill_status: if oldest.0.is_some() {
            "active".to_string()
        } else {
            "pending".to_string()
        },
        oldest_completed_year: oldest.0,
    }))
}

/// GET /api/system/worker-health
///
/// Returns worker instance status and job queue statistics.
pub async fn worker_health(
    State(state): State<Arc<AppState>>,
) -> Result<Json<WorkerHealth>, crate::models::AppError> {
    let instances: Vec<WorkerInstance> = sqlx::query_as(
        "SELECT instance_id, last_heartbeat, current_job_type FROM worker_heartbeats WHERE last_heartbeat > now() - interval '5 minutes'",
    )
    .fetch_all(state.repo.pool())
    .await
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;

    let pending: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM ingest_jobs WHERE status = 'pending'")
            .fetch_one(state.repo.pool())
            .await
            .map_err(|error| {
                crate::models::AppError::Internal(format!("database error: {error}"))
            })?;

    let failed: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ingest_jobs WHERE status = 'failed'")
        .fetch_one(state.repo.pool())
        .await
        .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;

    let active: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM ingest_jobs WHERE status = 'running'")
            .fetch_one(state.repo.pool())
            .await
            .map_err(|error| {
                crate::models::AppError::Internal(format!("database error: {error}"))
            })?;

    Ok(Json(WorkerHealth {
        instances,
        pending_jobs: pending.0,
        failed_jobs: failed.0,
        active_jobs: active.0,
    }))
}
