-- Add trigram indexes for fuzzy name/issue search across lobbying, FEC, and congressional entities.
-- These indexes accelerate ILIKE '%term%' queries and enable similarity()-ranked search.
-- pg_trgm extension already enabled in migration 0030.
-- Note: CONCURRENTLY omitted because SQLx runs migrations in transactions and
-- CREATE INDEX CONCURRENTLY requires running outside a transaction block.

CREATE INDEX IF NOT EXISTS idx_lobbying_clients_name_trgm
    ON lobbying_clients USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_lobbying_registrants_name_trgm
    ON lobbying_registrants USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_lobbying_activities_issue_trgm
    ON lobbying_activities USING gin (issue_display gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_fec_candidates_name_trgm
    ON fec_candidates USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_committees_name_trgm
    ON committees USING gin (name gin_trgm_ops);
