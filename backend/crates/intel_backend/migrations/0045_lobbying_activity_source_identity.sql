-- Preserve every source-level discriminator for an LDA lobbying activity.

DROP INDEX IF EXISTS idx_lobbying_activities_semantic_unique;

ALTER TABLE lobbying_activities
  ADD COLUMN IF NOT EXISTS foreign_entity_issues TEXT,
  ADD COLUMN IF NOT EXISTS lobbyist_identity JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS lobbying_activity_lobbyists (
  activity_id BIGINT NOT NULL REFERENCES lobbying_activities(id) ON DELETE CASCADE,
  lobbyist_id BIGINT NOT NULL REFERENCES lobbying_lobbyists(id),
  covered_position TEXT,
  is_new BOOLEAN,
  source_run_id UUID REFERENCES source_runs(id),
  PRIMARY KEY (activity_id, lobbyist_id)
);

CREATE INDEX IF NOT EXISTS idx_lobbying_activity_lobbyists_lobbyist
  ON lobbying_activity_lobbyists (lobbyist_id);

CREATE UNIQUE INDEX idx_lobbying_activities_semantic_unique
  ON lobbying_activities (
    md5(
      length(COALESCE(filing_uuid, ''))::text || ':' || COALESCE(filing_uuid, '') ||
      length(COALESCE(issue_code, ''))::text || ':' || COALESCE(issue_code, '') ||
      length(COALESCE(issue_display, ''))::text || ':' || COALESCE(issue_display, '') ||
      length(COALESCE(description, ''))::text || ':' || COALESCE(description, '') ||
      length(COALESCE(foreign_entity_issues, ''))::text || ':' ||
        COALESCE(foreign_entity_issues, '') ||
      length(government_entities::text)::text || ':' || government_entities::text ||
      length(lobbyist_identity::text)::text || ':' || lobbyist_identity::text
    )
  );

