-- Migration 0009: Enrichment columns + PL/pgSQL functions (Phase 4)

-- ── Ticker resolution lookup table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticker_lookup (
  ticker TEXT PRIMARY KEY,
  sector TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT ''
);

-- Seed with common congressional trade tickers
INSERT INTO ticker_lookup (ticker, sector, industry, company_name) VALUES
  ('AAPL', 'Technology', 'Consumer Electronics', 'Apple Inc.'),
  ('AMGN', 'Healthcare', 'Biotechnology', 'Amgen Inc.'),
  ('ADP', 'Technology', 'Software - Application', 'Automatic Data Processing'),
  ('BA', 'Industrials', 'Aerospace & Defense', 'The Boeing Company'),
  ('CB', 'Financial Services', 'Insurance - Property & Casualty', 'Chubb Limited'),
  ('CVX', 'Energy', 'Oil & Gas Integrated', 'Chevron Corporation'),
  ('HD', 'Consumer Cyclical', 'Home Improvement Retail', 'The Home Depot Inc.'),
  ('ITW', 'Industrials', 'Specialty Industrial Machinery', 'Illinois Tool Works Inc.'),
  ('JPM', 'Financial Services', 'Banks - Diversified', 'JPMorgan Chase & Co.'),
  ('LLY', 'Healthcare', 'Drug Manufacturers - General', 'Eli Lilly and Company'),
  ('LMT', 'Industrials', 'Aerospace & Defense', 'Lockheed Martin Corporation'),
  ('META', 'Technology', 'Internet Content & Information', 'Meta Platforms Inc.'),
  ('MSFT', 'Technology', 'Software - Infrastructure', 'Microsoft Corporation'),
  ('NFLX', 'Technology', 'Entertainment', 'Netflix Inc.'),
  ('NVDA', 'Technology', 'Semiconductors', 'NVIDIA Corporation'),
  ('PFE', 'Healthcare', 'Drug Manufacturers - General', 'Pfizer Inc.'),
  ('PG', 'Consumer Defensive', 'Household & Personal Products', 'Procter & Gamble Co.'),
  ('RTX', 'Industrials', 'Aerospace & Defense', 'RTX Corporation'),
  ('TSLA', 'Technology', 'Auto Manufacturers', 'Tesla Inc.'),
  ('XOM', 'Energy', 'Oil & Gas Integrated', 'Exxon Mobil Corporation')
ON CONFLICT (ticker) DO NOTHING;

-- ── Function: resolve ticker ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION resolve_ticker_sector(p_ticker TEXT)
RETURNS TABLE(sector TEXT, industry TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT tl.sector, tl.industry
  FROM ticker_lookup tl
  WHERE UPPER(tl.ticker) = UPPER(p_ticker)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT ''::text, ''::text;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SET search_path FROM CURRENT;

-- ── Function: committee overlap severity ─────────────────────────────────────

-- Maps a ticker/sector/industry against a member's committees and returns
-- the overlap severity and a JSONB array of conflicts.
-- Adapted from the Rust committee_detector crate logic.

CREATE OR REPLACE FUNCTION committee_overlap(
  p_bioguide_id TEXT,
  p_ticker TEXT,
  p_sector TEXT,
  p_industry TEXT
) RETURNS TABLE(
  severity TEXT,
  committee_names JSONB,
  committee_conflicts JSONB,
  flag_count INTEGER
) AS $$
DECLARE
  v_committees TEXT[];
  v_conflicts JSONB := '[]'::jsonb;
  v_highest TEXT := '';
  v_count INTEGER := 0;
  v_committee TEXT;
  v_cur_severity TEXT;
  v_description TEXT;
BEGIN
  -- Get the member's current committee names
  SELECT ARRAY_AGG(DISTINCT c.name)
  INTO v_committees
  FROM committee_memberships cm
  JOIN committees c ON cm.committee_id = c.committee_id
  WHERE cm.bioguide_id = p_bioguide_id;

  IF v_committees IS NULL OR p_sector = '' THEN
    RETURN QUERY SELECT ''::text, '[]'::jsonb, '[]'::jsonb, 0;
    RETURN;
  END IF;

  FOREACH v_committee IN ARRAY v_committees LOOP
    -- Direct overlap: sector/industry is clearly under the committee's jurisdiction
    IF (v_committee ILIKE '%Armed Services%' AND (p_sector = 'Industrials' AND p_industry ILIKE '%Defense%')) OR
       (v_committee ILIKE '%Armed Services%' AND p_sector = 'Industrials' AND p_industry ILIKE '%Aerospace%') OR
       (v_committee ILIKE '%Energy%' AND p_sector = 'Energy') OR
       (v_committee ILIKE '%Financial Services%' AND p_sector = 'Financial Services') OR
       (v_committee ILIKE '%Health%' AND p_sector = 'Healthcare') OR
       (v_committee ILIKE '%Ways and Means%' AND p_sector = 'Healthcare') OR
       (v_committee ILIKE '%Commerce%' AND p_sector = 'Technology') OR
       (v_committee ILIKE '%Judiciary%' AND p_sector = 'Technology') OR
       (v_committee ILIKE '%Agriculture%' AND p_sector = 'Consumer Defensive') OR
       (v_committee ILIKE '%Banking%' AND p_sector = 'Financial Services') OR
       (v_committee ILIKE '%Intelligence%' AND p_sector = 'Technology') OR
       (v_committee ILIKE '%Foreign Relations%' AND p_sector = 'Energy') OR
       (v_committee ILIKE '%Small Business%' AND p_sector = 'Consumer Cyclical') OR
       (v_committee ILIKE '%Appropriations%') OR
       (v_committee ILIKE '%Budget%') THEN
      v_cur_severity := 'DIRECT OVERLAP';
      v_description := v_committee || ' has direct oversight of ' || p_sector || ' sector';
    -- Adjacent: committee jurisdiction relates to sector
    ELSIF (v_committee ILIKE '%Armed Services%' AND p_sector = 'Technology') OR
          (v_committee ILIKE '%Health%' AND p_sector = 'Technology') OR
          (v_committee ILIKE '%Commerce%' AND p_sector = 'Industrials') OR
          (v_committee ILIKE '%Oversight%') OR
          (v_committee ILIKE '%Homeland Security%') THEN
      v_cur_severity := 'ADJACENT';
      v_description := v_committee || ' has adjacent jurisdiction over ' || p_sector || ' sector';
    ELSE
      CONTINUE;
    END IF;

    v_conflicts := v_conflicts || jsonb_build_object(
      'ticker', COALESCE(p_ticker, ''),
      'sector', COALESCE(p_sector, ''),
      'industry', COALESCE(p_industry, ''),
      'committee', v_committee,
      'severity', v_cur_severity,
      'description', v_description
    );
    v_count := v_count + 1;
    IF v_highest = '' OR (v_cur_severity = 'DIRECT OVERLAP' AND v_highest != 'DIRECT OVERLAP') THEN
      v_highest := v_cur_severity;
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    COALESCE(v_highest, 'CLEAN'),
    COALESCE(to_jsonb(v_committees), '[]'::jsonb),
    v_conflicts,
    v_count;
END;
$$ LANGUAGE plpgsql STABLE SET search_path FROM CURRENT;

-- ── Lobbying overlap column on disclosure_transactions ───────────────────────

ALTER TABLE disclosure_transactions
  ADD COLUMN IF NOT EXISTS lobbying_overlap BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lobbying_overlap_details JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── Contract overlap column ──────────────────────────────────────────────────

ALTER TABLE disclosure_transactions
  ADD COLUMN IF NOT EXISTS contract_overlap BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_overlap_details JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── Bill overlap column ──────────────────────────────────────────────────────

ALTER TABLE disclosure_transactions
  ADD COLUMN IF NOT EXISTS bill_window_overlap BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bill_window_overlap_details JSONB NOT NULL DEFAULT '{}'::jsonb;
