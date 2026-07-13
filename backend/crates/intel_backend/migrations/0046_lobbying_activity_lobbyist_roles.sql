-- Allow one lobbyist to retain multiple distinct roles within one LDA activity.

ALTER TABLE lobbying_activity_lobbyists
  DROP CONSTRAINT IF EXISTS lobbying_activity_lobbyists_pkey;

ALTER TABLE lobbying_activity_lobbyists
  ADD COLUMN IF NOT EXISTS id BIGSERIAL;

ALTER TABLE lobbying_activity_lobbyists
  ADD CONSTRAINT lobbying_activity_lobbyists_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX idx_lobbying_activity_lobbyists_semantic
  ON lobbying_activity_lobbyists (
    activity_id,
    lobbyist_id,
    COALESCE(covered_position, ''),
    COALESCE(is_new::text, '')
  );
