-- Migration 0008: Annual report tables + financial snapshots view (Phase 3)

-- Income from outside positions, honoraria, etc.
CREATE TABLE IF NOT EXISTS disclosure_income (
  income_id BIGSERIAL PRIMARY KEY,
  document_version_id BIGINT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  filing_id BIGINT REFERENCES disclosure_filings(filing_id),
  bioguide_id TEXT REFERENCES members(bioguide_id),
  owner_type TEXT NOT NULL DEFAULT 'self',
  source_description TEXT NOT NULL,
  income_type TEXT NOT NULL,
  amount_min NUMERIC,
  amount_max NUMERIC,
  as_of_date DATE,
  page_number INTEGER,
  raw_text TEXT,
  parser_name TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  parse_confidence TEXT NOT NULL DEFAULT 'medium'
);

-- Liabilities (mortgages, loans, etc.)
CREATE TABLE IF NOT EXISTS disclosure_liabilities (
  liability_id BIGSERIAL PRIMARY KEY,
  document_version_id BIGINT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  filing_id BIGINT REFERENCES disclosure_filings(filing_id),
  bioguide_id TEXT REFERENCES members(bioguide_id),
  owner_type TEXT NOT NULL DEFAULT 'self',
  creditor_name TEXT NOT NULL,
  liability_type TEXT NOT NULL,
  amount_min NUMERIC,
  amount_max NUMERIC,
  interest_rate TEXT,
  term TEXT,
  as_of_date DATE,
  page_number INTEGER,
  raw_text TEXT,
  parser_name TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  parse_confidence TEXT NOT NULL DEFAULT 'medium'
);

-- Gifts and travel reimbursements
CREATE TABLE IF NOT EXISTS disclosure_gifts (
  gift_id BIGSERIAL PRIMARY KEY,
  document_version_id BIGINT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  filing_id BIGINT REFERENCES disclosure_filings(filing_id),
  bioguide_id TEXT REFERENCES members(bioguide_id),
  owner_type TEXT NOT NULL DEFAULT 'self',
  source_description TEXT NOT NULL,
  gift_type TEXT NOT NULL,
  value_min NUMERIC,
  value_max NUMERIC,
  event_date DATE,
  travel_destination TEXT,
  page_number INTEGER,
  raw_text TEXT,
  parser_name TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  parse_confidence TEXT NOT NULL DEFAULT 'medium'
);

-- Outside positions (board seats, employment, etc.)
CREATE TABLE IF NOT EXISTS disclosure_positions (
  position_id BIGSERIAL PRIMARY KEY,
  document_version_id BIGINT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  filing_id BIGINT REFERENCES disclosure_filings(filing_id),
  bioguide_id TEXT REFERENCES members(bioguide_id),
  owner_type TEXT NOT NULL DEFAULT 'self',
  organization_name TEXT NOT NULL,
  organization_id BIGINT REFERENCES organizations(organization_id),
  position_title TEXT,
  from_date DATE,
  to_date DATE,
  compensation_min NUMERIC,
  compensation_max NUMERIC,
  page_number INTEGER,
  raw_text TEXT,
  parser_name TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  parse_confidence TEXT NOT NULL DEFAULT 'medium'
);

-- Aggregate each record family independently. Joining the raw one-to-many
-- tables together would multiply rows and inflate every monetary total.
CREATE MATERIALIZED VIEW IF NOT EXISTS member_financial_snapshots AS
WITH filing_ids AS (
  SELECT document_id, array_agg(filing_id) AS ids
  FROM disclosure_filings
  GROUP BY document_id
),
asset_totals AS (
  SELECT fi.document_id,
         COUNT(da.asset_id) AS asset_count,
         COALESCE(SUM(da.value_min), 0) AS assets_min,
         COALESCE(SUM(da.value_max), 0) AS assets_max
  FROM filing_ids fi
  JOIN disclosure_assets da ON da.filing_id = ANY(fi.ids)
  GROUP BY fi.document_id
),
transaction_totals AS (
  SELECT document_id,
         COUNT(*) AS transaction_count,
         COUNT(*) FILTER (WHERE transaction_type = 'purchase') AS purchases,
         COUNT(*) FILTER (WHERE transaction_type IN ('sale', 'sale (full)', 'sale (partial)')) AS sales,
         COALESCE(SUM(amount_min) FILTER (WHERE transaction_type = 'purchase'), 0) AS purchases_amount_min,
         COALESCE(SUM(amount_max) FILTER (WHERE transaction_type = 'purchase'), 0) AS purchases_amount_max,
         COALESCE(SUM(amount_min) FILTER (WHERE transaction_type IN ('sale', 'sale (full)', 'sale (partial)')), 0) AS sales_amount_min,
         COALESCE(SUM(amount_max) FILTER (WHERE transaction_type IN ('sale', 'sale (full)', 'sale (partial)')), 0) AS sales_amount_max
  FROM disclosure_transactions
  GROUP BY document_id
),
liability_totals AS (
  SELECT fi.document_id,
         COUNT(dl.liability_id) AS liability_count,
         COALESCE(SUM(dl.amount_min), 0) AS liabilities_min,
         COALESCE(SUM(dl.amount_max), 0) AS liabilities_max
  FROM filing_ids fi
  JOIN disclosure_liabilities dl ON dl.filing_id = ANY(fi.ids)
  GROUP BY fi.document_id
)
SELECT m.bioguide_id,
       m.official_full_name,
       m.current_party,
       m.current_state,
       m.current_chamber,
       dd.filing_date AS snapshot_date,
       dd.document_id,
       COALESCE(a.asset_count, 0) AS asset_count,
       COALESCE(a.assets_min, 0) AS assets_min,
       COALESCE(a.assets_max, 0) AS assets_max,
       COALESCE(t.transaction_count, 0) AS transaction_count,
       COALESCE(t.purchases, 0) AS purchases,
       COALESCE(t.sales, 0) AS sales,
       COALESCE(t.purchases_amount_min, 0) AS purchases_amount_min,
       COALESCE(t.purchases_amount_max, 0) AS purchases_amount_max,
       COALESCE(t.sales_amount_min, 0) AS sales_amount_min,
       COALESCE(t.sales_amount_max, 0) AS sales_amount_max,
       COALESCE(l.liability_count, 0) AS liability_count,
       COALESCE(l.liabilities_min, 0) AS liabilities_min,
       COALESCE(l.liabilities_max, 0) AS liabilities_max
FROM members m
JOIN disclosure_documents dd ON m.bioguide_id = dd.bioguide_id
LEFT JOIN asset_totals a ON a.document_id = dd.document_id
LEFT JOIN transaction_totals t ON t.document_id = dd.document_id
LEFT JOIN liability_totals l ON l.document_id = dd.document_id
WHERE dd.parse_status = 'parsed';

CREATE UNIQUE INDEX IF NOT EXISTS member_financial_snapshots_pk
  ON member_financial_snapshots (bioguide_id, document_id);
