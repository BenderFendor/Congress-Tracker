use crate::repository::Repository;

impl Repository {
    /// Get stock trades for a member, ordered by transaction date descending.
    pub async fn get_member_trades(
        &self,
        bioguide_id: &str,
        limit: i64,
    ) -> Result<Vec<serde_json::Value>, sqlx::Error> {
        let rows: Vec<(serde_json::Value,)> = sqlx::query_as(
            r#"SELECT raw_json
               FROM stock_trades
               WHERE bioguide_id = $1
               ORDER BY transaction_date DESC NULLS LAST, disclosure_date DESC NULLS LAST
               LIMIT $2"#,
        )
        .bind(bioguide_id)
        .bind(limit)
        .fetch_all(self.pool())
        .await?;

        Ok(rows.into_iter().map(|(j,)| j).collect())
    }

    /// List all stock trades joined with member info, ordered by transaction date descending.
    pub async fn list_trades(
        &self,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<StockTradeRow>, sqlx::Error> {
        sqlx::query_as::<_, StockTradeRow>(
            r#"SELECT
                 st.trade_id, st.bioguide_id, st.politician_id, st.ticker,
                 st.asset_name, st.tx_type,
                 st.amount_min::float8, st.amount_max::float8,
                 st.estimated_value::float8, st.transaction_date, st.disclosure_date,
                 st.filing_url, st.source,
                 st.sector, st.industry, st.disclosure_lag_days, st.late_filing,
                 st.committee_names, st.committee_conflicts,
                 st.conflict_flag_count, st.highest_conflict_severity,
                 COALESCE(m.official_full_name, '') as member_name,
                 COALESCE(m.current_chamber, '') as chamber,
                 COALESCE(m.current_state, '') as state,
                 COALESCE(m.current_party, '') as party
               FROM stock_trades st
               LEFT JOIN members m ON st.bioguide_id = m.bioguide_id
               ORDER BY st.transaction_date DESC NULLS LAST, st.disclosure_date DESC NULLS LAST
               LIMIT $1 OFFSET $2"#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(self.pool())
        .await
    }

    /// Count total row count for stock_trades (for pagination).
    pub async fn count_trades(&self) -> Result<i64, sqlx::Error> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM stock_trades")
            .fetch_one(self.pool())
            .await?;
        Ok(row.0)
    }

    /// List trades for a specific ticker symbol.
    pub async fn list_trades_by_ticker(
        &self,
        ticker: &str,
    ) -> Result<Vec<StockTradeRow>, sqlx::Error> {
        sqlx::query_as::<_, StockTradeRow>(
            r#"SELECT
                 st.trade_id, st.bioguide_id, st.politician_id, st.ticker,
                 st.asset_name, st.tx_type,
                 st.amount_min::float8, st.amount_max::float8,
                 st.estimated_value::float8, st.transaction_date, st.disclosure_date,
                 st.filing_url, st.source,
                 st.sector, st.industry, st.disclosure_lag_days, st.late_filing,
                 st.committee_names, st.committee_conflicts,
                 st.conflict_flag_count, st.highest_conflict_severity,
                 COALESCE(m.official_full_name, '') as member_name,
                 COALESCE(m.current_chamber, '') as chamber,
                 COALESCE(m.current_state, '') as state,
                 COALESCE(m.current_party, '') as party
               FROM stock_trades st
               LEFT JOIN members m ON st.bioguide_id = m.bioguide_id
               WHERE UPPER(st.ticker) = UPPER($1)
               ORDER BY st.transaction_date DESC NULLS LAST"#,
        )
        .bind(ticker)
        .fetch_all(self.pool())
        .await
    }

    /// Get distinct tickers from stock_trades.
    pub async fn list_tickers(&self) -> Result<Vec<String>, sqlx::Error> {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT DISTINCT ticker FROM stock_trades WHERE ticker IS NOT NULL ORDER BY ticker",
        )
        .fetch_all(self.pool())
        .await?;
        Ok(rows.into_iter().map(|(t,)| t).collect())
    }
}

/// Row type for querying stock_trades joined with members.
#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct StockTradeRow {
    pub trade_id: String,
    pub bioguide_id: Option<String>,
    pub politician_id: Option<String>,
    pub ticker: Option<String>,
    pub asset_name: Option<String>,
    pub tx_type: String,
    pub amount_min: Option<f64>,
    pub amount_max: Option<f64>,
    pub estimated_value: Option<f64>,
    pub transaction_date: Option<chrono::NaiveDate>,
    pub disclosure_date: Option<chrono::NaiveDate>,
    pub filing_url: Option<String>,
    pub source: String,
    pub member_name: String,
    pub chamber: String,
    pub state: String,
    pub party: String,
    pub sector: String,
    pub industry: String,
    pub disclosure_lag_days: Option<i32>,
    pub late_filing: bool,
    pub committee_names: serde_json::Value,
    pub committee_conflicts: serde_json::Value,
    pub conflict_flag_count: i32,
    pub highest_conflict_severity: String,
}
