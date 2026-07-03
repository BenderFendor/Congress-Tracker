use crate::models::EntityResolutionEntry;
use crate::routes::AppState;
use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ResolutionQueueQuery {
    pub status: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/admin/entity-resolution-queue?status=&limit=
///
/// List entity resolution queue entries, optionally filtered by status.
/// This endpoint is read-only; accept/reject is not implemented in this pass.
pub async fn get_resolution_queue(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ResolutionQueueQuery>,
) -> Result<Json<Vec<EntityResolutionEntry>>, crate::models::AppError> {
    let status = query.status.as_deref();
    let limit = query.limit.unwrap_or(50);

    let entries = state
        .repo
        .get_resolution_queue(status, limit)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(entries))
}
