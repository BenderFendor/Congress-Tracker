-- Migration 0010: Update stock_trades view with enrichment function calls
-- The functions were created in migration 0009, so they exist by now.

DROP MATERIALIZED VIEW IF EXISTS stock_trades CASCADE;

CREATE MATERIALIZED VIEW stock_trades AS
SELECT
  'house-' || dt.transaction_id::text AS trade_id,
  dt.bioguide_id,
  dt.bioguide_id AS politician_id,
  dt.ticker,
  dt.asset_name,
  dt.transaction_type AS tx_type,
  dt.amount_min::float8 AS amount_min,
  dt.amount_max::float8 AS amount_max,
  dt.amount_max::float8 AS estimated_value,
  dt.transaction_date,
  dd.filing_date AS disclosure_date,
  dt.filing_url,
  dd.source,
  dt.raw_json,
  -- Enrichment from PL/pgSQL functions (Phase 4)
  COALESCE(tr.sector, '') AS sector,
  COALESCE(tr.industry, '') AS industry,
  (dd.filing_date - dt.transaction_date)::int AS disclosure_lag_days,
  CASE
    WHEN (dd.filing_date - dt.transaction_date) > 45 THEN true
    ELSE false
  END AS late_filing,
  COALESCE(co.committee_names, '[]'::jsonb) AS committee_names,
  COALESCE(co.committee_conflicts, '[]'::jsonb) AS committee_conflicts,
  COALESCE(co.flag_count, 0) AS conflict_flag_count,
  COALESCE(co.severity, '') AS highest_conflict_severity,
  -- Member join
  COALESCE(m.official_full_name, '') AS member_name,
  COALESCE(m.current_chamber, '') AS chamber,
  COALESCE(m.current_state, '') AS state,
  COALESCE(m.current_party, '') AS party
FROM disclosure_transactions dt
JOIN disclosure_documents dd ON dt.document_id = dd.document_id
LEFT JOIN members m ON dt.bioguide_id = m.bioguide_id
-- Ticker resolution
LEFT JOIN LATERAL resolve_ticker_sector(dt.ticker) tr ON true
-- Committee overlap
LEFT JOIN LATERAL committee_overlap(dt.bioguide_id, dt.ticker, tr.sector, tr.industry) co ON true;

CREATE UNIQUE INDEX IF NOT EXISTS stock_trades_trade_id_idx ON stock_trades (trade_id);
CREATE INDEX IF NOT EXISTS stock_trades_tx_date_idx ON stock_trades (transaction_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS stock_trades_ticker_idx ON stock_trades (ticker) WHERE ticker IS NOT NULL;
