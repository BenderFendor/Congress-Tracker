-- Per-member, per-role terminal coverage for exhaustive Congress.gov legislation ingestion.

CREATE TABLE member_legislation_coverage (
    source_run_id UUID NOT NULL REFERENCES source_runs(id) ON DELETE CASCADE,
    bioguide_id TEXT NOT NULL REFERENCES members(bioguide_id),
    congress INTEGER NOT NULL CHECK (congress > 0),
    role TEXT NOT NULL CHECK (role IN ('sponsor', 'cosponsor')),
    status TEXT NOT NULL CHECK (status IN ('running', 'loaded', 'failed')),
    advertised_count BIGINT CHECK (advertised_count IS NULL OR advertised_count >= 0),
    rows_seen BIGINT NOT NULL DEFAULT 0 CHECK (rows_seen >= 0),
    rows_written BIGINT NOT NULL DEFAULT 0 CHECK (rows_written >= 0),
    pages_fetched INTEGER NOT NULL DEFAULT 0 CHECK (pages_fetched >= 0),
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    PRIMARY KEY (source_run_id, bioguide_id, congress, role),
    CHECK (
        (status = 'running' AND finished_at IS NULL AND error_message IS NULL)
        OR
        (status = 'loaded' AND finished_at IS NOT NULL AND error_message IS NULL
         AND advertised_count IS NOT NULL AND rows_seen = advertised_count)
        OR
        (status = 'failed' AND finished_at IS NOT NULL
         AND error_message IS NOT NULL AND length(error_message) > 0)
    )
);

CREATE INDEX idx_member_legislation_coverage_member
    ON member_legislation_coverage (bioguide_id, congress, role, finished_at DESC);
CREATE INDEX idx_member_legislation_coverage_run_status
    ON member_legislation_coverage (source_run_id, status);
