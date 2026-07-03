-- Core schema for intel_backend
-- Migration 0001: enums, tables, indexes, materialized views

-- ============================================================
-- 1. Enum types
-- ============================================================

DO $$ BEGIN
  CREATE TYPE source_run_status AS ENUM ('running','success','partial','failed','auth_missing','rate_limited');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE confidence_level AS ENUM ('verified','high','medium','low','unknown','heuristic');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE fec_transaction_type AS ENUM ('receipt','disbursement','independent_expenditure','candidate_total');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE influence_committee_role AS ENUM ('direct_pac','super_pac','independent_expenditure_filer','ally','watchdog','unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS source_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status source_run_status NOT NULL DEFAULT 'running',
  rows_seen BIGINT NOT NULL DEFAULT 0,
  rows_written BIGINT NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS data_sources (
  source TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  license TEXT NOT NULL,
  base_url TEXT NOT NULL,
  default_ttl_seconds INTEGER NOT NULL,
  confidence confidence_level NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

INSERT INTO data_sources (source, display_name, source_type, license, base_url, default_ttl_seconds, confidence, notes) VALUES
  ('unitedstates_legislators', 'unitedstates/congress-legislators', 'community_dataset', 'CC0', 'https://github.com/unitedstates/congress-legislators', 86400, 'verified', 'Bulk legislator profiles, terms, social media, committee memberships'),
  ('congress_gov', 'Congress.gov API', 'official_api', 'Public Domain (US Gov)', 'https://api.congress.gov/v3', 3600, 'verified', 'Official legislative data: bills, votes, members'),
  ('openfec', 'OpenFEC API', 'official_api', 'Public Domain (US Gov)', 'https://api.open.fec.gov/v1', 3600, 'verified', 'Campaign finance: candidates, committees, receipts, independent expenditures'),
  ('lda', 'Lobbying Disclosure Act API', 'official_api', 'Public Domain (US Gov)', 'https://lda.gov/api', 3600, 'verified', 'Lobbying filings, registrants, clients'),
  ('voteview', 'Voteview', 'academic_dataset', 'CC-BY', 'https://voteview.com', 604800, 'high', 'NOMINATE scores, roll call votes, member data'),
  ('capitoltrades', 'CapitolTrades.com', 'public_scrape', 'Proprietary (scraped)', 'https://www.capitoltrades.com', 7200, 'medium', 'Stock trade disclosures'),
  ('civiq', 'CIV.IQ', 'public_api', 'MIT', 'https://api.civiq.us', 3600, 'high', 'Representative profiles, votes, bills'),
  ('wikidata', 'Wikidata', 'open_knowledge_graph', 'CC0', 'https://www.wikidata.org', 604800, 'medium', 'Entity crosswalks, external IDs'),
  ('manual_influence_seed', 'Manual Influence Seed', 'manual_curation', 'Public Domain (curated)', 'N/A', 86400, 'verified', 'Hand-curated influence network seeds with public citations')
ON CONFLICT (source) DO NOTHING;

CREATE TABLE IF NOT EXISTS members (
  bioguide_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  middle_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  suffix TEXT NOT NULL DEFAULT '',
  official_full_name TEXT NOT NULL DEFAULT '',
  birthday DATE,
  gender TEXT,
  current_party TEXT NOT NULL DEFAULT 'Unknown',
  current_state TEXT NOT NULL DEFAULT '',
  current_district TEXT NOT NULL DEFAULT '',
  current_chamber TEXT NOT NULL DEFAULT '',
  in_office BOOLEAN NOT NULL DEFAULT false,
  depiction_url TEXT,
  website_url TEXT,
  contact_form TEXT,
  office_address TEXT,
  phone TEXT,
  years_in_office NUMERIC,
  next_election DATE,
  hometown TEXT,
  birthplace TEXT,
  education JSONB NOT NULL DEFAULT '[]'::jsonb,
  prior_employment JSONB NOT NULL DEFAULT '[]'::jsonb,
  nominate_dim1 NUMERIC,
  nominate_dim2 NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_source_run_id UUID REFERENCES source_runs(id),
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS member_terms (
  id BIGSERIAL PRIMARY KEY,
  bioguide_id TEXT REFERENCES members(bioguide_id),
  chamber TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT '',
  party TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  senate_class INTEGER,
  how TEXT,
  source TEXT NOT NULL,
  source_run_id UUID REFERENCES source_runs(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_terms_unique ON member_terms(bioguide_id, chamber, state, district, start_date);

CREATE TABLE IF NOT EXISTS member_identifiers (
  bioguide_id TEXT REFERENCES members(bioguide_id),
  scheme TEXT NOT NULL,
  value TEXT NOT NULL,
  source_run_id UUID REFERENCES source_runs(id),
  PRIMARY KEY(bioguide_id, scheme, value),
  UNIQUE(scheme, value)
);

CREATE TABLE IF NOT EXISTS social_accounts (
  bioguide_id TEXT REFERENCES members(bioguide_id),
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  official BOOLEAN NOT NULL DEFAULT true,
  source_run_id UUID REFERENCES source_runs(id),
  PRIMARY KEY(bioguide_id, platform)
);

CREATE TABLE IF NOT EXISTS committees (
  committee_id TEXT PRIMARY KEY,
  chamber TEXT NOT NULL,
  name TEXT NOT NULL,
  thomas_id TEXT,
  senate_committee_id TEXT,
  house_committee_id TEXT,
  jurisdiction TEXT,
  parent_committee_id TEXT REFERENCES committees(committee_id),
  url TEXT,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS committee_memberships (
  id BIGSERIAL PRIMARY KEY,
  committee_id TEXT REFERENCES committees(committee_id),
  bioguide_id TEXT REFERENCES members(bioguide_id),
  congress INTEGER,
  chamber TEXT NOT NULL,
  rank INTEGER,
  title TEXT NOT NULL DEFAULT '',
  party TEXT,
  source_run_id UUID REFERENCES source_runs(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_committee_memberships_unique ON committee_memberships(committee_id, bioguide_id, congress, title);

CREATE TABLE IF NOT EXISTS bills (
  congress INTEGER NOT NULL,
  bill_type TEXT NOT NULL,
  bill_number INTEGER NOT NULL,
  bill_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  introduced_date DATE,
  origin_chamber TEXT,
  policy_area TEXT,
  latest_action_date DATE,
  latest_action_text TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  url TEXT,
  source_run_id UUID REFERENCES source_runs(id),
  PRIMARY KEY(congress, bill_type, bill_number)
);

CREATE TABLE IF NOT EXISTS bill_sponsors (
  id BIGSERIAL PRIMARY KEY,
  bill_id TEXT REFERENCES bills(bill_id),
  bioguide_id TEXT REFERENCES members(bioguide_id),
  sponsor_type TEXT NOT NULL CHECK(sponsor_type IN ('sponsor','cosponsor')),
  sponsorship_date DATE,
  is_original_cosponsor BOOLEAN NOT NULL DEFAULT false,
  source_run_id UUID REFERENCES source_runs(id),
  UNIQUE(bill_id, bioguide_id, sponsor_type)
);

CREATE TABLE IF NOT EXISTS bill_actions (
  id BIGSERIAL PRIMARY KEY,
  bill_id TEXT REFERENCES bills(bill_id),
  action_date DATE,
  action_text TEXT NOT NULL,
  action_type TEXT,
  chamber TEXT,
  source_run_id UUID REFERENCES source_runs(id),
  UNIQUE(bill_id, action_date, action_text)
);

CREATE TABLE IF NOT EXISTS bill_subjects (
  bill_id TEXT REFERENCES bills(bill_id),
  subject TEXT NOT NULL,
  source_run_id UUID REFERENCES source_runs(id),
  PRIMARY KEY(bill_id, subject)
);

CREATE TABLE IF NOT EXISTS bill_text_versions (
  id BIGSERIAL PRIMARY KEY,
  bill_id TEXT REFERENCES bills(bill_id),
  version_code TEXT,
  version_name TEXT,
  format TEXT,
  url TEXT NOT NULL,
  source_run_id UUID REFERENCES source_runs(id),
  UNIQUE(bill_id, version_code, format, url)
);

CREATE TABLE IF NOT EXISTS roll_call_votes (
  vote_id TEXT PRIMARY KEY,
  congress INTEGER NOT NULL,
  chamber TEXT NOT NULL,
  session INTEGER,
  roll_number INTEGER NOT NULL,
  vote_date DATE,
  question TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  bill_id TEXT REFERENCES bills(bill_id),
  source_url TEXT,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS member_votes (
  vote_id TEXT REFERENCES roll_call_votes(vote_id),
  bioguide_id TEXT REFERENCES members(bioguide_id),
  position TEXT NOT NULL,
  party TEXT,
  state TEXT,
  source_run_id UUID REFERENCES source_runs(id),
  PRIMARY KEY(vote_id, bioguide_id)
);

CREATE TABLE IF NOT EXISTS fec_candidates (
  candidate_id TEXT PRIMARY KEY,
  bioguide_id TEXT REFERENCES members(bioguide_id),
  name TEXT NOT NULL,
  party TEXT,
  state TEXT,
  district TEXT,
  office TEXT,
  incumbent_challenge TEXT,
  active_through INTEGER,
  first_file_date DATE,
  last_file_date DATE,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS fec_committees (
  committee_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  committee_type TEXT,
  committee_type_full TEXT,
  designation TEXT,
  designation_full TEXT,
  party TEXT,
  state TEXT,
  treasurer_name TEXT,
  affiliated_committee_name TEXT,
  sponsor_candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS fec_transactions (
  transaction_id TEXT PRIMARY KEY,
  transaction_type fec_transaction_type NOT NULL,
  committee_id TEXT REFERENCES fec_committees(committee_id),
  candidate_id TEXT REFERENCES fec_candidates(candidate_id),
  bioguide_id TEXT REFERENCES members(bioguide_id),
  contributor_name TEXT,
  contributor_committee_id TEXT,
  recipient_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_date DATE,
  cycle INTEGER,
  support_oppose_indicator TEXT,
  employer TEXT,
  occupation TEXT,
  purpose TEXT,
  memo_text TEXT,
  source_url TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS lobbying_registrants (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  state TEXT,
  country TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS lobbying_clients (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT,
  country TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS lobbying_filings (
  filing_uuid TEXT PRIMARY KEY,
  filing_type TEXT,
  filing_year INTEGER,
  filing_period TEXT,
  income NUMERIC,
  expenses NUMERIC,
  registrant_id BIGINT REFERENCES lobbying_registrants(id),
  client_id BIGINT REFERENCES lobbying_clients(id),
  dt_posted TIMESTAMPTZ,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS lobbying_activities (
  id BIGSERIAL PRIMARY KEY,
  filing_uuid TEXT REFERENCES lobbying_filings(filing_uuid),
  issue_code TEXT,
  issue_display TEXT,
  description TEXT,
  government_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS stock_trades (
  trade_id TEXT PRIMARY KEY,
  bioguide_id TEXT REFERENCES members(bioguide_id),
  politician_id TEXT,
  ticker TEXT,
  asset_name TEXT,
  tx_type TEXT NOT NULL,
  amount_min NUMERIC,
  amount_max NUMERIC,
  estimated_value NUMERIC,
  transaction_date DATE,
  disclosure_date DATE,
  filing_url TEXT,
  source TEXT NOT NULL,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS influence_networks (
  network_slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence confidence_level NOT NULL,
  source_citation TEXT NOT NULL,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS influence_network_committees (
  network_slug TEXT REFERENCES influence_networks(network_slug),
  committee_id TEXT NOT NULL,
  committee_name TEXT NOT NULL,
  role influence_committee_role NOT NULL,
  confidence confidence_level NOT NULL,
  source_citation TEXT NOT NULL,
  source_run_id UUID REFERENCES source_runs(id),
  PRIMARY KEY(network_slug, committee_id)
);

CREATE TABLE IF NOT EXISTS entity_resolution_queue (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  source_scheme TEXT NOT NULL,
  source_value TEXT NOT NULL,
  candidate_bioguide_id TEXT REFERENCES members(bioguide_id),
  confidence_score NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_run_id UUID REFERENCES source_runs(id)
);

-- ============================================================
-- 3. Indexes
-- ============================================================

-- B-tree indexes on frequently queried foreign keys and filter columns
CREATE INDEX IF NOT EXISTS idx_fec_transactions_bioguide_cycle ON fec_transactions(bioguide_id, cycle);
CREATE INDEX IF NOT EXISTS idx_fec_transactions_committee_cycle ON fec_transactions(committee_id, cycle);
CREATE INDEX IF NOT EXISTS idx_member_terms_bioguide ON member_terms(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_committee_memberships_bioguide ON committee_memberships(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_bills_latest_action_date ON bills(latest_action_date);
CREATE INDEX IF NOT EXISTS idx_bill_sponsors_bioguide ON bill_sponsors(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_member_votes_bioguide ON member_votes(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_fec_candidates_bioguide ON fec_candidates(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_stock_trades_bioguide ON stock_trades(bioguide_id);
CREATE INDEX IF NOT EXISTS idx_lobbying_filings_registrant ON lobbying_filings(registrant_id);
CREATE INDEX IF NOT EXISTS idx_lobbying_filings_client ON lobbying_filings(client_id);
CREATE INDEX IF NOT EXISTS idx_entity_resolution_queue_status ON entity_resolution_queue(status);
CREATE INDEX IF NOT EXISTS idx_entity_resolution_queue_scheme_value ON entity_resolution_queue(source_scheme, source_value);

-- GIN indexes on raw JSONB fields for ad-hoc debugging queries
CREATE INDEX IF NOT EXISTS idx_fec_transactions_raw_json ON fec_transactions USING gin(raw_json);
CREATE INDEX IF NOT EXISTS idx_lobbying_filings_raw_json ON lobbying_filings USING gin(raw_json);

-- Full-text search indexes (GIN on tsvector expressions)
CREATE INDEX IF NOT EXISTS idx_members_fts ON members USING gin(
  to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(official_full_name, ''))
);

CREATE INDEX IF NOT EXISTS idx_bills_fts ON bills USING gin(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(bill_id, ''))
);

CREATE INDEX IF NOT EXISTS idx_fec_committees_fts ON fec_committees USING gin(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(affiliated_committee_name, ''))
);

CREATE INDEX IF NOT EXISTS idx_lobbying_clients_fts ON lobbying_clients USING gin(
  to_tsvector('english', coalesce(name, ''))
);

CREATE INDEX IF NOT EXISTS idx_lobbying_registrants_fts ON lobbying_registrants USING gin(
  to_tsvector('english', coalesce(name, ''))
);

-- ============================================================
-- 4. Materialized views
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS member_funding_cycle_mv AS
SELECT ft.bioguide_id, ft.cycle,
  COALESCE(SUM(ft.amount) FILTER (WHERE ft.transaction_type = 'receipt'), 0) as direct_receipts,
  COALESCE(SUM(ft.amount) FILTER (WHERE ft.transaction_type = 'receipt' AND ft.committee_id IN (SELECT committee_id FROM fec_committees WHERE committee_type_full ILIKE '%PAC%')), 0) as pac_receipts,
  COALESCE(SUM(ft.amount) FILTER (WHERE ft.transaction_type = 'receipt' AND ft.committee_id NOT IN (SELECT committee_id FROM fec_committees WHERE committee_type_full ILIKE '%PAC%')), 0) as individual_receipts,
  COALESCE(SUM(ft.amount) FILTER (WHERE ft.transaction_type = 'independent_expenditure' AND ft.support_oppose_indicator = 'S'), 0) as independent_expenditures_supporting,
  COALESCE(SUM(ft.amount) FILTER (WHERE ft.transaction_type = 'independent_expenditure' AND ft.support_oppose_indicator = 'O'), 0) as independent_expenditures_opposing
FROM fec_transactions ft
GROUP BY ft.bioguide_id, ft.cycle;

CREATE MATERIALIZED VIEW IF NOT EXISTS member_vote_summary_mv AS
SELECT mv.bioguide_id, rv.congress,
  COUNT(*) as total_votes,
  COUNT(*) FILTER (WHERE mv.position IN ('Not Voting','Not Present')) as missed_votes,
  COUNT(*) FILTER (WHERE mv.position = mv.party) as party_line_votes
FROM member_votes mv
JOIN roll_call_votes rv ON mv.vote_id = rv.vote_id
GROUP BY mv.bioguide_id, rv.congress;

CREATE MATERIALIZED VIEW IF NOT EXISTS influence_network_member_mv AS
SELECT inc.network_slug, ft.bioguide_id, ft.cycle,
  COALESCE(SUM(ft.amount) FILTER (WHERE ft.transaction_type = 'receipt'), 0) as direct_amount,
  COALESCE(SUM(ft.amount) FILTER (WHERE ft.transaction_type = 'independent_expenditure' AND ft.support_oppose_indicator = 'S'), 0) as support_ie_amount,
  COALESCE(SUM(ft.amount) FILTER (WHERE ft.transaction_type = 'independent_expenditure' AND ft.support_oppose_indicator = 'O'), 0) as oppose_ie_amount
FROM influence_network_committees inc
JOIN fec_transactions ft ON inc.committee_id = ft.committee_id
GROUP BY inc.network_slug, ft.bioguide_id, ft.cycle;
