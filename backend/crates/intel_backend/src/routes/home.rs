use crate::models::AppError;
use crate::routes::AppState;
use axum::extract::State;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, Serialize)]
pub struct HomeSummary {
    pub counts: HomeCounts,
    pub recent_activity: RecentActivity,
    pub sources: Vec<SourceFreshness>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HomeCounts {
    pub legislators: i64,
    pub active_bills: i64,
    pub committees: i64,
    pub votes: i64,
    pub lobbying_filings: i64,
    pub stock_transactions: i64,
    pub candidates: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RecentActivity {
    pub latest_bill_action: Option<String>,
    pub latest_lobbying_filing: Option<DateTime<Utc>>,
    pub latest_stock_disclosure: Option<String>,
    pub latest_source_run: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct SourceFreshness {
    pub source: String,
    pub display_name: Option<String>,
    pub source_type: Option<String>,
    pub default_ttl_seconds: Option<i32>,
    pub endpoint: Option<String>,
    pub status: Option<String>,
    pub fetched_at: Option<DateTime<Utc>>,
    pub rows_seen: Option<i64>,
    pub rows_written: Option<i64>,
    pub error_message: Option<String>,
    #[sqlx(default)]
    pub freshness: String,
}

pub async fn summary(State(state): State<Arc<AppState>>) -> Result<Json<HomeSummary>, AppError> {
    let pool = state.repo.pool();

    let counts: HomeCounts = sqlx::query_as(
        r#"SELECT
             (SELECT COUNT(*) FROM members WHERE in_office = true) AS legislators,
             (SELECT COUNT(*) FROM bills) AS active_bills,
             (SELECT COUNT(*) FROM committees) AS committees,
             (SELECT COUNT(*) FROM roll_call_votes) AS votes,
             (SELECT COUNT(*) FROM lobbying_filings) AS lobbying_filings,
             (SELECT COUNT(*) FROM stock_trades) AS stock_transactions,
             (SELECT COUNT(*) FROM fec_candidates) AS candidates"#,
    )
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    let recent: RecentActivity = sqlx::query_as(
        r#"SELECT
             (SELECT latest_action_date::text FROM bills ORDER BY latest_action_date DESC NULLS LAST LIMIT 1) AS latest_bill_action,
             (SELECT dt_posted FROM lobbying_filings ORDER BY dt_posted DESC NULLS LAST LIMIT 1) AS latest_lobbying_filing,
             (SELECT disclosure_date::text FROM stock_trades ORDER BY disclosure_date DESC NULLS LAST LIMIT 1) AS latest_stock_disclosure,
             (SELECT finished_at FROM source_runs ORDER BY finished_at DESC NULLS LAST LIMIT 1) AS latest_source_run"#,
    )
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    let sources = source_freshness(pool).await?;

    Ok(Json(HomeSummary {
        counts,
        recent_activity: recent,
        sources,
    }))
}
pub async fn source_freshness(pool: &sqlx::PgPool) -> Result<Vec<SourceFreshness>, AppError> {
    let mut sources: Vec<SourceFreshness> = sqlx::query_as(
        r#"WITH latest_runs AS (
             SELECT DISTINCT ON (source, endpoint)
               source, endpoint, status, finished_at, rows_seen, rows_written, error_message
             FROM source_runs
             ORDER BY source, endpoint, started_at DESC
           )
           SELECT ds.source,
                  ds.display_name,
                  ds.source_type,
                  ds.default_ttl_seconds,
                  sr.endpoint,
                  sr.status::text AS status,
                  sr.finished_at AS fetched_at,
                  sr.rows_seen,
                  sr.rows_written,
                  sr.error_message
           FROM data_sources ds
           LEFT JOIN latest_runs sr ON sr.source = ds.source
           ORDER BY ds.source, sr.endpoint"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("database error: {}", e)))?;

    let now = Utc::now();
    for source in &mut sources {
        source.freshness = classify_source_freshness(
            source.status.as_deref(),
            source.fetched_at,
            source.default_ttl_seconds,
            now,
        );
    }
    Ok(sources)
}

fn classify_source_freshness(
    status: Option<&str>,
    fetched_at: Option<DateTime<Utc>>,
    default_ttl_seconds: Option<i32>,
    now: DateTime<Utc>,
) -> String {
    match status {
        Some("failed") => "failed".to_string(),
        Some("partial") => "partial".to_string(),
        Some("success") => {
            let ttl = i64::from(default_ttl_seconds.unwrap_or(86_400));
            match fetched_at {
                Some(fetched_at) if now.signed_duration_since(fetched_at).num_seconds() <= ttl => {
                    "fresh".to_string()
                }
                Some(_) => "stale".to_string(),
                None => "missing".to_string(),
            }
        }
        _ => "missing".to_string(),
    }
}

#[cfg(test)]
mod freshness_tests {
    use super::classify_source_freshness;
    use chrono::{Duration, Utc};

    #[test]
    fn distinguishes_fresh_stale_failed_and_missing_key_runs() {
        let now = Utc::now();
        assert_eq!(
            classify_source_freshness(
                Some("success"),
                Some(now - Duration::seconds(30)),
                Some(60),
                now
            ),
            "fresh"
        );
        assert_eq!(
            classify_source_freshness(
                Some("success"),
                Some(now - Duration::seconds(61)),
                Some(60),
                now
            ),
            "stale"
        );
        assert_eq!(
            classify_source_freshness(Some("failed"), Some(now), Some(60), now),
            "failed"
        );
        assert_eq!(
            classify_source_freshness(Some("partial"), Some(now), Some(60), now),
            "partial"
        );
        assert_eq!(
            classify_source_freshness(Some("auth_missing"), Some(now), Some(60), now),
            "missing"
        );
        assert_eq!(
            classify_source_freshness(Some("rate_limited"), Some(now), Some(60), now),
            "missing"
        );
        assert_eq!(
            classify_source_freshness(None, None, Some(60), now),
            "missing"
        );
    }
}
