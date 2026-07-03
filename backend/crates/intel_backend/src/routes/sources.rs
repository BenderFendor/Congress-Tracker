use crate::models::AppError;
use crate::routes::{home, AppState};
use axum::extract::State;
use axum::Json;
use std::sync::Arc;

pub async fn status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<home::SourceFreshness>>, AppError> {
    Ok(Json(home::source_freshness(state.repo.pool()).await?))
}
