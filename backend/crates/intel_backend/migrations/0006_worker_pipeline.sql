-- Local installs commonly use a congress_tracker role, but migrations must also
-- work when a deployment uses another database role.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'congress_tracker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES ON disclosure_documents TO congress_tracker;
    GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES ON disclosure_transactions TO congress_tracker;
    GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES ON disclosure_holdings TO congress_tracker;
    GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES ON organizations TO congress_tracker;
    GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES ON organization_identifiers TO congress_tracker;
    GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES ON members TO congress_tracker;
    GRANT SELECT, INSERT, UPDATE ON source_runs TO congress_tracker;
  END IF;
END $$;

-- Migration 0006: worker pipeline tables for automated House Clerk disclosure ingestion
-- Adds job queue, document versioning, parse history, filing metadata

-- Index entries discovered from yearly ZIP archives
CREATE TABLE IF NOT EXISTS source_index_entries (
  source_name TEXT NOT NULL,
  source_year INTEGER NOT NULL,
  source_document_id TEXT NOT NULL,
  filing_type_code TEXT,
  first_name TEXT,
  last_name TEXT,
  state_district TEXT,
  filing_date DATE,
  raw_xml TEXT NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_name, source_year, source_document_id)
);

-- Durable job queue — polled by intel_worker via FOR UPDATE SKIP LOCKED
DO $$ BEGIN
  CREATE TYPE ingest_job_status AS ENUM ('pending','running','completed','failed','skipped');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS ingest_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_year INTEGER,
  source_document_id TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  status ingest_job_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_pending
  ON ingest_jobs(status, available_at, priority, created_at)
  WHERE status = 'pending';

-- Worker heartbeat for health monitoring
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  instance_id TEXT PRIMARY KEY,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_job_type TEXT,
  current_job_id BIGINT
);

-- Versioned document storage — never overwrite a PDF
CREATE TABLE IF NOT EXISTS document_versions (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES disclosure_documents(document_id) ON DELETE CASCADE,
  sha256 TEXT NOT NULL,
  byte_size BIGINT,
  storage_key TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, sha256)
);

ALTER TABLE ingest_jobs
  ADD COLUMN IF NOT EXISTS document_version_id BIGINT REFERENCES document_versions(id) ON DELETE CASCADE;

-- Only one worker may own an active job for a source document/version. A
-- completed download may be enqueued again later to detect a changed PDF.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingest_jobs_active_unique
  ON ingest_jobs (
    job_type,
    source_name,
    COALESCE(source_year, 0),
    COALESCE(source_document_id, ''),
    COALESCE(document_version_id, 0)
  )
  WHERE status IN ('pending', 'running');

-- Parse attempt history
CREATE TABLE IF NOT EXISTS parse_attempts (
  id BIGSERIAL PRIMARY KEY,
  document_version_id BIGINT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  parser_name TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  rows_extracted INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

-- Unparseable content preserved for review
CREATE TABLE IF NOT EXISTS parse_issues (
  id BIGSERIAL PRIMARY KEY,
  parse_attempt_id BIGINT NOT NULL REFERENCES parse_attempts(id) ON DELETE CASCADE,
  page_number INTEGER,
  raw_text TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  issue_detail TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false
);

-- Normalized filing metadata (extends 0004 disclosure_documents)
CREATE TABLE IF NOT EXISTS disclosure_filings (
  filing_id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES disclosure_documents(document_id) ON DELETE CASCADE,
  bioguide_id TEXT REFERENCES members(bioguide_id),
  filing_type TEXT NOT NULL,
  source_filing_type_code TEXT,
  filing_date DATE,
  reporting_period_start DATE,
  reporting_period_end DATE,
  amendment_of_document_id BIGINT REFERENCES disclosure_documents(document_id),
  amendment_confidence TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Asset holdings from annual reports
CREATE TABLE IF NOT EXISTS disclosure_assets (
  asset_id BIGSERIAL PRIMARY KEY,
  document_version_id BIGINT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  filing_id BIGINT REFERENCES disclosure_filings(filing_id),
  bioguide_id TEXT REFERENCES members(bioguide_id),
  owner_type TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  ticker TEXT,
  organization_id BIGINT REFERENCES organizations(organization_id),
  value_min NUMERIC,
  value_max NUMERIC,
  income_min NUMERIC,
  income_max NUMERIC,
  as_of_date DATE,
  page_number INTEGER,
  raw_text TEXT,
  parser_name TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  parse_confidence TEXT NOT NULL DEFAULT 'medium'
);

-- Register the index source
INSERT INTO data_sources
  (source, display_name, source_type, license, base_url, default_ttl_seconds, confidence, notes)
VALUES
  ('house_clerk_index', 'House Clerk yearly disclosure index', 'official_documents',
   'Public record', 'https://disclosures-clerk.house.gov/FinancialDisclosure',
   1800, 'verified',
   'Yearly ZIP archives containing XML index of all House financial disclosures')
ON CONFLICT (source) DO NOTHING;
