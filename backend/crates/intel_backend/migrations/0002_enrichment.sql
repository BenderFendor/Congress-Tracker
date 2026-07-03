-- Migration 0002: Trade enrichment columns
-- Adds sector, industry, disclosure lag, committee conflicts to stock_trades

ALTER TABLE stock_trades
  ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS disclosure_lag_days INTEGER,
  ADD COLUMN IF NOT EXISTS late_filing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS committee_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS committee_conflicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS conflict_flag_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS highest_conflict_severity TEXT NOT NULL DEFAULT '';
