-- Migration 0004: canonical organizations, disclosure documents, and
-- evidence-backed relationships.

CREATE TABLE IF NOT EXISTS organizations (
  organization_id BIGSERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN (
    'company', 'pac', 'super_pac', 'lobbying_registrant', 'lobbying_client',
    'nonprofit', 'government_recipient', 'other'
  )),
  description TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (canonical_name, organization_type)
);

CREATE TABLE IF NOT EXISTS organization_identifiers (
  organization_id BIGINT NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
  scheme TEXT NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  source_run_id UUID REFERENCES source_runs(id),
  PRIMARY KEY (organization_id, scheme, value),
  UNIQUE (scheme, value)
);

CREATE TABLE IF NOT EXISTS disclosure_documents (
  document_id BIGSERIAL PRIMARY KEY,
  bioguide_id TEXT REFERENCES members(bioguide_id),
  chamber TEXT NOT NULL CHECK (chamber IN ('House', 'Senate', 'Unknown')),
  report_type TEXT NOT NULL,
  filing_date DATE,
  reporting_period_start DATE,
  reporting_period_end DATE,
  source TEXT NOT NULL,
  source_record_id TEXT,
  source_url TEXT NOT NULL,
  raw_sha256 TEXT,
  raw_storage_key TEXT,
  parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN (
    'pending', 'parsed', 'partial', 'rejected', 'failed'
  )),
  parse_error TEXT,
  source_run_id UUID REFERENCES source_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_record_id),
  UNIQUE (source_url)
);

CREATE TABLE IF NOT EXISTS disclosure_holdings (
  holding_id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES disclosure_documents(document_id) ON DELETE CASCADE,
  bioguide_id TEXT REFERENCES members(bioguide_id),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('self', 'spouse', 'dependent', 'joint', 'unknown')),
  asset_name TEXT NOT NULL,
  ticker TEXT,
  organization_id BIGINT REFERENCES organizations(organization_id),
  value_min NUMERIC,
  value_max NUMERIC,
  income_min NUMERIC,
  income_max NUMERIC,
  as_of_date DATE,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (document_id, owner_type, asset_name, ticker)
);

CREATE TABLE IF NOT EXISTS disclosure_transactions (
  transaction_id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES disclosure_documents(document_id) ON DELETE CASCADE,
  bioguide_id TEXT REFERENCES members(bioguide_id),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('self', 'spouse', 'dependent', 'joint', 'unknown')),
  asset_name TEXT NOT NULL,
  ticker TEXT,
  organization_id BIGINT REFERENCES organizations(organization_id),
  transaction_type TEXT NOT NULL,
  amount_min NUMERIC,
  amount_max NUMERIC,
  transaction_date DATE,
  disclosure_date DATE,
  filing_url TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (document_id, owner_type, asset_name, ticker, transaction_type, transaction_date)
);

CREATE TABLE IF NOT EXISTS relationship_evidence (
  relationship_id BIGSERIAL PRIMARY KEY,
  subject_key TEXT NOT NULL,
  object_key TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  evidence_tier TEXT NOT NULL CHECK (evidence_tier IN ('direct', 'derived', 'contextual')),
  confidence confidence_level NOT NULL DEFAULT 'unknown',
  source TEXT NOT NULL,
  source_record_id TEXT,
  source_url TEXT,
  observed_at DATE,
  amount_min NUMERIC,
  amount_max NUMERIC,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_run_id UUID REFERENCES source_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_key, object_key, relation_type, source, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_identifiers_lookup
  ON organization_identifiers(scheme, value);
CREATE INDEX IF NOT EXISTS idx_disclosure_documents_member
  ON disclosure_documents(bioguide_id, filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_disclosure_transactions_member
  ON disclosure_transactions(bioguide_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_evidence_subject
  ON relationship_evidence(subject_key, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_evidence_object
  ON relationship_evidence(object_key, observed_at DESC);

INSERT INTO data_sources
  (source, display_name, source_type, license, base_url, default_ttl_seconds, confidence, notes)
VALUES
  ('house_disclosures', 'House Clerk financial disclosures', 'official_documents', 'Public record', 'https://disclosures-clerk.house.gov/financialdisclosure', 86400, 'verified', 'Annual reports and periodic transaction reports; parser must preserve filing URLs and ranges'),
  ('senate_disclosures', 'Senate eFD financial disclosures', 'official_documents', 'Public record', 'https://efdsearch.senate.gov/search/home/', 86400, 'verified', 'Annual reports and periodic transaction reports; parser must preserve owner type'),
  ('sec_company_identity', 'SEC company identity data', 'official_api', 'Public Domain (US Gov)', 'https://data.sec.gov/', 604800, 'verified', 'CIK and issuer identity crosswalks'),
  ('usaspending', 'USAspending.gov', 'official_api', 'Public Domain (US Gov)', 'https://api.usaspending.gov/', 86400, 'verified', 'Federal award context for canonical organizations')
ON CONFLICT (source) DO NOTHING;
