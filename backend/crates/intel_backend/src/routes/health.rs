use crate::models::HealthResponse;
use crate::routes::AppState;
use axum::extract::State;
use axum::Json;

/// GET /api/health
///
/// Returns server health status including database connectivity and cache size.
pub async fn health_check(State(state): State<std::sync::Arc<AppState>>) -> Json<HealthResponse> {
    let db_ok = state.repo.db.health().await;
    let cache_size = state.cache.entry_count();
    Json(HealthResponse {
        status: if db_ok {
            "ok".to_string()
        } else {
            "degraded".to_string()
        },
        db: db_ok,
        cache_size,
    })
}
