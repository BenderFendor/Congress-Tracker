-- Migration 0007: replace stock_trades table with a materialized view
-- Computed from normalized disclosure_transactions + disclosure_documents + members

-- Only rename if the table still exists and the legacy table doesn't
DO $$ BEGIN
  IF EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name = 'stock_trades'
         AND table_type = 'BASE TABLE'
     )
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name = 'stock_trades_legacy'
     ) THEN
    ALTER TABLE stock_trades RENAME TO stock_trades_legacy;
  END IF;
END $$;

-- Drop old view if it exists, then recreate
DROP MATERIALIZED VIEW IF EXISTS stock_trades;

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
  -- Enrichment columns at defaults until Phase 4 ports Rust crates to PG functions
  ''::text AS sector,
  ''::text AS industry,
  (dd.filing_date - dt.transaction_date)::int AS disclosure_lag_days,
  CASE
    WHEN (dd.filing_date - dt.transaction_date) > 45 THEN true
    ELSE false
  END AS late_filing,
  '[]'::jsonb AS committee_names,
  '[]'::jsonb AS committee_conflicts,
  0 AS conflict_flag_count,
  ''::text AS highest_conflict_severity,
  -- Member join
  COALESCE(m.official_full_name, '') AS member_name,
  COALESCE(m.current_chamber, '') AS chamber,
  COALESCE(m.current_state, '') AS state,
  COALESCE(m.current_party, '') AS party
FROM disclosure_transactions dt
JOIN disclosure_documents dd ON dt.document_id = dd.document_id
LEFT JOIN members m ON dt.bioguide_id = m.bioguide_id;

CREATE UNIQUE INDEX IF NOT EXISTS stock_trades_trade_id_idx ON stock_trades (trade_id);
CREATE INDEX IF NOT EXISTS stock_trades_tx_date_idx ON stock_trades (transaction_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS stock_trades_ticker_idx ON stock_trades (ticker) WHERE ticker IS NOT NULL;
