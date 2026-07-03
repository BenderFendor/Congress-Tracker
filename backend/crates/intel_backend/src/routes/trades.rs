use crate::repository::trades::StockTradeRow;
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct ListTradesQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub ticker: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TradesResponse {
    pub trades: Vec<StockTradeRow>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
    pub tickers: Vec<String>,
}

/// GET /api/intel/trades
///
/// Returns paginated stock trades with member details, plus available tickers.
pub async fn list_trades(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListTradesQuery>,
) -> Result<Json<TradesResponse>, crate::models::AppError> {
    let limit = query.limit.unwrap_or(100).min(1000);
    let offset = query.offset.unwrap_or(0);

    let (trades, total, tickers) = tokio::try_join!(
        state.repo.list_trades(limit, offset),
        state.repo.count_trades(),
        state.repo.list_tickers(),
    )
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(TradesResponse {
        trades,
        total,
        limit,
        offset,
        tickers,
    }))
}

/// GET /api/intel/trades/:ticker
///
/// Returns all trades for a specific ticker symbol.
pub async fn trades_by_ticker(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<Json<Vec<StockTradeRow>>, crate::models::AppError> {
    let trades = state
        .repo
        .list_trades_by_ticker(&ticker)
        .await
        .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(trades))
}
