use crate::repository::trades::StockTradeRow;
use crate::routes::AppState;
use axum::extract::{Path, Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ListTradesQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct TradesResponse {
    pub trades: Vec<StockTradeRow>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
    pub tickers: Vec<String>,
    pub coverage: TradeCoverage,
}

#[derive(Debug, Serialize)]
pub struct TradeCoverage {
    pub status: &'static str,
    pub message: &'static str,
    pub has_more: bool,
    pub excluded_date_anomalies: i64,
}

const MAX_TRADE_OFFSET: i64 = 100_000;

fn bounded_page(
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<(i64, i64), crate::models::AppError> {
    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);
    if !(1..=200).contains(&limit) {
        return Err(crate::models::AppError::BadRequest(
            "limit must be between 1 and 200".to_string(),
        ));
    }
    if !(0..=MAX_TRADE_OFFSET).contains(&offset) {
        return Err(crate::models::AppError::BadRequest(format!(
            "offset must be between 0 and {MAX_TRADE_OFFSET}"
        )));
    }
    Ok((limit, offset))
}

fn coverage(total: i64, limit: i64, offset: i64, excluded_date_anomalies: i64) -> TradeCoverage {
    TradeCoverage {
        status: if total > 0 { "loaded" } else { "not_loaded" },
        message: if total > 0 && excluded_date_anomalies > 0 {
            "Canonical disclosure transactions are loaded; implausible source dates were excluded."
        } else if total > 0 {
            "Canonical disclosure transaction records are loaded."
        } else if excluded_date_anomalies > 0 {
            "No plausibly dated linked transactions are loaded; source date anomalies were excluded, so this is not evidence of no trading."
        } else {
            "No linked disclosure transactions are loaded; this is a coverage state, not evidence of no trading."
        },
        has_more: offset.saturating_add(limit) < total,
        excluded_date_anomalies,
    }
}

/// GET /api/intel/trades
///
/// Returns paginated stock trades with member details, plus available tickers.
pub async fn list_trades(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListTradesQuery>,
) -> Result<Json<TradesResponse>, crate::models::AppError> {
    let (limit, offset) = bounded_page(query.limit, query.offset)?;

    let (trades, total, tickers, excluded_date_anomalies) = tokio::try_join!(
        state.repo.list_trades(limit, offset),
        state.repo.count_trades(),
        state.repo.list_tickers(),
        state.repo.count_trade_date_anomalies(),
    )
    .map_err(|e| crate::models::AppError::Internal(format!("database error: {}", e)))?;

    Ok(Json(TradesResponse {
        trades,
        total,
        limit,
        offset,
        tickers,
        coverage: coverage(total, limit, offset, excluded_date_anomalies),
    }))
}

/// GET /api/members/:member_id/trades
///
/// Returns a bounded, paginated page keyed by canonical Member/Bioguide ID.
pub async fn member_trades(
    State(state): State<Arc<AppState>>,
    Path(member_id): Path<String>,
    Query(query): Query<ListTradesQuery>,
) -> Result<Json<TradesResponse>, crate::models::AppError> {
    let member_exists = state
        .repo
        .member_exists(&member_id)
        .await
        .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;
    if !member_exists {
        return Err(crate::models::AppError::NotFound(format!(
            "Member {member_id} not found"
        )));
    }
    let (limit, offset) = bounded_page(query.limit, query.offset)?;
    let (trades, total, excluded_date_anomalies) = tokio::try_join!(
        state.repo.list_member_trades(&member_id, limit, offset),
        state.repo.count_member_trades(&member_id),
        state.repo.count_member_trade_date_anomalies(&member_id),
    )
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;

    Ok(Json(TradesResponse {
        trades,
        total,
        limit,
        offset,
        tickers: Vec::new(),
        coverage: coverage(total, limit, offset, excluded_date_anomalies),
    }))
}

/// GET /api/intel/trades/:ticker
///
/// Returns all trades for a specific ticker symbol.
pub async fn trades_by_ticker(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
    Query(query): Query<ListTradesQuery>,
) -> Result<Json<TradesResponse>, crate::models::AppError> {
    let (limit, offset) = bounded_page(query.limit, query.offset)?;
    let (trades, total, excluded_date_anomalies) = tokio::try_join!(
        state.repo.list_trades_by_ticker(&ticker, limit, offset),
        state.repo.count_trades_by_ticker(&ticker),
        state.repo.count_ticker_trade_date_anomalies(&ticker),
    )
    .map_err(|error| crate::models::AppError::Internal(format!("database error: {error}")))?;

    Ok(Json(TradesResponse {
        trades,
        total,
        limit,
        offset,
        tickers: Vec::new(),
        coverage: coverage(total, limit, offset, excluded_date_anomalies),
    }))
}

#[cfg(test)]
mod tests {
    use super::{bounded_page, coverage};

    #[test]
    fn pagination_is_positive_and_bounded() {
        assert_eq!(bounded_page(None, None).unwrap(), (100, 0));
        assert_eq!(
            bounded_page(Some(200), Some(100_000)).unwrap(),
            (200, 100_000)
        );
        assert!(bounded_page(Some(0), Some(0)).is_err());
        assert!(bounded_page(Some(201), Some(0)).is_err());
        assert!(bounded_page(Some(100), Some(-1)).is_err());
        assert!(bounded_page(Some(100), Some(100_001)).is_err());
    }

    #[test]
    fn coverage_reports_excluded_source_date_anomalies() {
        let state = coverage(3, 2, 0, 4);
        assert_eq!(state.status, "loaded");
        assert_eq!(state.excluded_date_anomalies, 4);
        assert!(state.message.contains("implausible source dates"));
    }
}
