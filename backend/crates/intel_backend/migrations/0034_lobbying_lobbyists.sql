-- Normalize stable Senate LDA lobbyist identifiers and their filing roles.

CREATE TABLE IF NOT EXISTS lobbying_lobbyists (
  id BIGINT PRIMARY KEY,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  suffix TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_run_id UUID REFERENCES source_runs(id)
);

CREATE TABLE IF NOT EXISTS lobbying_filing_lobbyists (
  filing_uuid TEXT NOT NULL REFERENCES lobbying_filings(filing_uuid) ON DELETE CASCADE,
  lobbyist_id BIGINT NOT NULL REFERENCES lobbying_lobbyists(id),
  covered_position TEXT,
  is_new BOOLEAN,
  source_run_id UUID REFERENCES source_runs(id),
  PRIMARY KEY (filing_uuid, lobbyist_id)
);

CREATE INDEX IF NOT EXISTS idx_lobbying_lobbyists_name
  ON lobbying_lobbyists (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_lobbying_filing_lobbyists_lobbyist
  ON lobbying_filing_lobbyists (lobbyist_id);
