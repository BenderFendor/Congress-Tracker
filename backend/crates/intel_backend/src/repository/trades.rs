use crate::repository::Repository;

const TRADE_PAGE_SELECT: &str = r#"SELECT
    dt.transaction_id AS sort_id,
    dt.bioguide_id,
    dt.ticker,
    dt.asset_name,
    dt.transaction_type AS tx_type,
    dt.amount_min::float8,
    dt.amount_max::float8,
    dt.amount_max::float8 AS estimated_value,
    dt.transaction_date,
    dd.filing_date AS disclosure_date,
    dt.filing_url,
    dd.source,
    COALESCE(m.official_full_name, '') AS member_name,
    COALESCE(m.current_chamber, '') AS chamber,
    COALESCE(m.current_state, '') AS state,
    COALESCE(m.current_party, '') AS party
  FROM disclosure_transactions dt
  JOIN disclosure_documents dd ON dd.document_id = dt.document_id
  LEFT JOIN members m ON m.bioguide_id = dt.bioguide_id"#;

fn paged_trade_sql(filter: &str, page_clause: &str) -> String {
    format!(
        r#"WITH trade_page AS MATERIALIZED (
  {TRADE_PAGE_SELECT}
  WHERE {filter}
  ORDER BY dt.transaction_date DESC NULLS LAST,
           dd.filing_date DESC NULLS LAST,
           dt.transaction_id DESC
  {page_clause}
)
SELECT
    'disclosure-' || page.sort_id::text AS trade_id,
    page.bioguide_id,
    page.bioguide_id AS politician_id,
    page.ticker,
    page.asset_name,
    page.tx_type,
    page.amount_min,
    page.amount_max,
    page.estimated_value,
    page.transaction_date,
    page.disclosure_date,
    page.filing_url,
    page.source,
    page.member_name,
    page.chamber,
    page.state,
    page.party,
    COALESCE(enrichment.sector, '') AS sector,
    COALESCE(enrichment.industry, '') AS industry,
    CASE
      WHEN page.disclosure_date >= page.transaction_date
      THEN (page.disclosure_date - page.transaction_date)::int
      ELSE NULL
    END AS disclosure_lag_days,
    CASE
      WHEN page.disclosure_date >= page.transaction_date
       AND (page.disclosure_date - page.transaction_date) > 45
      THEN true
      ELSE false
    END AS late_filing,
    COALESCE(overlap.committee_names, '[]'::jsonb) AS committee_names,
    COALESCE(overlap.committee_conflicts, '[]'::jsonb) AS committee_conflicts,
    COALESCE(overlap.flag_count, 0)::int AS conflict_flag_count,
    COALESCE(overlap.severity, '') AS highest_conflict_severity
  FROM trade_page page
  LEFT JOIN LATERAL (
    SELECT * FROM resolve_ticker_sector(page.ticker) LIMIT 1
  ) enrichment ON true
  LEFT JOIN LATERAL (
    SELECT * FROM committee_overlap(
      page.bioguide_id,
      page.ticker,
      enrichment.sector,
      enrichment.industry
    ) LIMIT 1
  ) overlap ON true
  ORDER BY page.transaction_date DESC NULLS LAST,
           page.disclosure_date DESC NULLS LAST,
           page.sort_id DESC"#
    )
}

/// Null dates remain visible as explicitly undisclosed. Dated transactions are
/// limited to the product's supported 2012-present window and cannot be later
/// than today. Rows outside this predicate are counted as source anomalies.
const PLAUSIBLE_TRADE_DATE: &str =
    "(dt.transaction_date IS NULL OR dt.transaction_date BETWEEN DATE '2012-01-01' AND CURRENT_DATE)";

impl Repository {
    /// List canonical disclosure transactions, newest first.
    ///
    /// This deliberately reads the normalized disclosure warehouse instead of
    /// the optional `stock_trades` materialized view. Public reads therefore
    /// remain available even when that derived view has not been refreshed.
    pub async fn list_trades(
        &self,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<StockTradeRow>, sqlx::Error> {
        let sql = paged_trade_sql(PLAUSIBLE_TRADE_DATE, "LIMIT $1 OFFSET $2");
        sqlx::query_as::<_, StockTradeRow>(&sql)
            .bind(limit)
            .bind(offset)
            .fetch_all(self.pool())
            .await
    }

    pub async fn count_trades(&self) -> Result<i64, sqlx::Error> {
        let sql =
            format!("SELECT COUNT(*) FROM disclosure_transactions dt WHERE {PLAUSIBLE_TRADE_DATE}");
        sqlx::query_scalar(&sql).fetch_one(self.pool()).await
    }

    pub async fn count_trade_date_anomalies(&self) -> Result<i64, sqlx::Error> {
        let sql = format!(
            "SELECT COUNT(*) FROM disclosure_transactions dt WHERE NOT {PLAUSIBLE_TRADE_DATE}"
        );
        sqlx::query_scalar(&sql).fetch_one(self.pool()).await
    }

    /// List a bounded page for one canonical Member/Bioguide identifier.
    pub async fn list_member_trades(
        &self,
        bioguide_id: &str,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<StockTradeRow>, sqlx::Error> {
        let filter = format!("dt.bioguide_id = $1 AND {PLAUSIBLE_TRADE_DATE}");
        let sql = paged_trade_sql(&filter, "LIMIT $2 OFFSET $3");
        sqlx::query_as::<_, StockTradeRow>(&sql)
            .bind(bioguide_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(self.pool())
            .await
    }

    pub async fn count_member_trades(&self, bioguide_id: &str) -> Result<i64, sqlx::Error> {
        let sql = format!(
            "SELECT COUNT(*) FROM disclosure_transactions dt \
             WHERE dt.bioguide_id = $1 AND {PLAUSIBLE_TRADE_DATE}"
        );
        sqlx::query_scalar(&sql)
            .bind(bioguide_id)
            .fetch_one(self.pool())
            .await
    }

    pub async fn count_member_trade_date_anomalies(
        &self,
        bioguide_id: &str,
    ) -> Result<i64, sqlx::Error> {
        let sql = format!(
            "SELECT COUNT(*) FROM disclosure_transactions dt \
             WHERE dt.bioguide_id = $1 AND NOT {PLAUSIBLE_TRADE_DATE}"
        );
        sqlx::query_scalar(&sql)
            .bind(bioguide_id)
            .fetch_one(self.pool())
            .await
    }

    pub async fn member_exists(&self, bioguide_id: &str) -> Result<bool, sqlx::Error> {
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM members WHERE bioguide_id = $1)")
            .bind(bioguide_id)
            .fetch_one(self.pool())
            .await
    }

    pub async fn list_trades_by_ticker(
        &self,
        ticker: &str,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<StockTradeRow>, sqlx::Error> {
        let filter = format!("UPPER(dt.ticker) = UPPER($1) AND {PLAUSIBLE_TRADE_DATE}");
        let sql = paged_trade_sql(&filter, "LIMIT $2 OFFSET $3");
        sqlx::query_as::<_, StockTradeRow>(&sql)
            .bind(ticker)
            .bind(limit)
            .bind(offset)
            .fetch_all(self.pool())
            .await
    }

    pub async fn count_trades_by_ticker(&self, ticker: &str) -> Result<i64, sqlx::Error> {
        let sql = format!(
            "SELECT COUNT(*) FROM disclosure_transactions dt \
             WHERE UPPER(dt.ticker) = UPPER($1) AND {PLAUSIBLE_TRADE_DATE}"
        );
        sqlx::query_scalar(&sql)
            .bind(ticker)
            .fetch_one(self.pool())
            .await
    }

    pub async fn count_ticker_trade_date_anomalies(
        &self,
        ticker: &str,
    ) -> Result<i64, sqlx::Error> {
        let sql = format!(
            "SELECT COUNT(*) FROM disclosure_transactions dt \
             WHERE UPPER(dt.ticker) = UPPER($1) AND NOT {PLAUSIBLE_TRADE_DATE}"
        );
        sqlx::query_scalar(&sql)
            .bind(ticker)
            .fetch_one(self.pool())
            .await
    }

    pub async fn list_tickers(&self) -> Result<Vec<String>, sqlx::Error> {
        let sql = format!(
            "SELECT DISTINCT dt.ticker FROM disclosure_transactions dt \
             WHERE dt.ticker IS NOT NULL AND BTRIM(dt.ticker) <> '' \
             AND {PLAUSIBLE_TRADE_DATE} ORDER BY dt.ticker"
        );
        let rows: Vec<(String,)> = sqlx::query_as(&sql).fetch_all(self.pool()).await?;
        Ok(rows.into_iter().map(|(ticker,)| ticker).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::{paged_trade_sql, PLAUSIBLE_TRADE_DATE};

    #[test]
    fn plausible_date_contract_preserves_null_and_bounds_dated_rows() {
        assert!(PLAUSIBLE_TRADE_DATE.contains("transaction_date IS NULL"));
        assert!(PLAUSIBLE_TRADE_DATE.contains("DATE '2012-01-01'"));
        assert!(PLAUSIBLE_TRADE_DATE.contains("CURRENT_DATE"));
    }

    #[test]
    fn enrichment_runs_after_the_bounded_page() {
        let sql = paged_trade_sql(PLAUSIBLE_TRADE_DATE, "LIMIT $1 OFFSET $2");
        assert!(sql.contains("WITH trade_page AS MATERIALIZED"));
        assert!(sql.find("LIMIT $1 OFFSET $2") < sql.find("resolve_ticker_sector"));
        assert!(sql.find("LIMIT $1 OFFSET $2") < sql.find("committee_overlap"));
    }
}

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
