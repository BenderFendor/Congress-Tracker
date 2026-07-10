use crate::models::AppError;
use crate::routes::{home, AppState};
use axum::extract::State;
use axum::Json;
use std::sync::Arc;

#[derive(Debug, serde::Serialize)]
pub struct CoverageResponse {
    pub sources: Vec<home::SourceFreshness>,
    pub summary: CoverageSummary,
}

#[derive(Debug, serde::Serialize)]
pub struct CoverageSummary {
    pub total: usize,
    pub successful: usize,
    pub stale_or_missing: usize,
    pub failed: usize,
}

pub async fn status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<home::SourceFreshness>>, AppError> {
    Ok(Json(home::source_freshness(state.repo.pool()).await?))
}

pub async fn coverage(
    State(state): State<Arc<AppState>>,
) -> Result<Json<CoverageResponse>, AppError> {
    let sources = home::source_freshness(state.repo.pool()).await?;
    let successful = sources
        .iter()
        .filter(|source| source.freshness == "fresh")
        .count();
    let failed = sources
        .iter()
        .filter(|source| source.freshness == "failed")
        .count();

    Ok(Json(CoverageResponse {
        summary: CoverageSummary {
            total: sources.len(),
            successful,
            stale_or_missing: sources.len().saturating_sub(successful),
            failed,
        },
        sources,
    }))
}
