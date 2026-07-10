-- Repair installations that applied the first worker migrations before the
-- queue/version and snapshot aggregation fixes landed.

ALTER TABLE ingest_jobs
  ADD COLUMN IF NOT EXISTS document_version_id BIGINT REFERENCES document_versions(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingest_jobs_active_unique
  ON ingest_jobs (
    job_type,
    source_name,
    COALESCE(source_year, 0),
    COALESCE(source_document_id, ''),
    COALESCE(document_version_id, 0)
  )
  WHERE status IN ('pending', 'running');

DROP MATERIALIZED VIEW IF EXISTS member_financial_snapshots;

CREATE MATERIALIZED VIEW member_financial_snapshots AS
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
LEFT JOIN LATERAL (
  SELECT COUNT(da.asset_id) AS asset_count,
         COALESCE(SUM(da.value_min), 0) AS assets_min,
         COALESCE(SUM(da.value_max), 0) AS assets_max
  FROM disclosure_assets da
  JOIN disclosure_filings df ON df.filing_id = da.filing_id
  WHERE df.document_id = dd.document_id
) a ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS transaction_count,
         COUNT(*) FILTER (WHERE dt.transaction_type = 'purchase') AS purchases,
         COUNT(*) FILTER (WHERE dt.transaction_type IN ('sale', 'sale (full)', 'sale (partial)')) AS sales,
         COALESCE(SUM(dt.amount_min) FILTER (WHERE dt.transaction_type = 'purchase'), 0) AS purchases_amount_min,
         COALESCE(SUM(dt.amount_max) FILTER (WHERE dt.transaction_type = 'purchase'), 0) AS purchases_amount_max,
         COALESCE(SUM(dt.amount_min) FILTER (WHERE dt.transaction_type IN ('sale', 'sale (full)', 'sale (partial)')), 0) AS sales_amount_min,
         COALESCE(SUM(dt.amount_max) FILTER (WHERE dt.transaction_type IN ('sale', 'sale (full)', 'sale (partial)')), 0) AS sales_amount_max
  FROM disclosure_transactions dt
  WHERE dt.document_id = dd.document_id
) t ON true
LEFT JOIN LATERAL (
  SELECT COUNT(dl.liability_id) AS liability_count,
         COALESCE(SUM(dl.amount_min), 0) AS liabilities_min,
         COALESCE(SUM(dl.amount_max), 0) AS liabilities_max
  FROM disclosure_liabilities dl
  JOIN disclosure_filings df ON df.filing_id = dl.filing_id
  WHERE df.document_id = dd.document_id
) l ON true
WHERE dd.parse_status = 'parsed';

CREATE UNIQUE INDEX member_financial_snapshots_pk
  ON member_financial_snapshots (bioguide_id, document_id);
