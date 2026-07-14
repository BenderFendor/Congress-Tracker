-- Require every advertised Member-legislation row to reach its atomic bill/member upsert.

UPDATE member_legislation_coverage
SET status = 'failed',
    error_message = 'migration 49: legacy loaded coverage did not record one persisted item per advertised row'
WHERE status = 'loaded' AND rows_written <> rows_seen;

ALTER TABLE member_legislation_coverage
    DROP CONSTRAINT member_legislation_coverage_check;

ALTER TABLE member_legislation_coverage
    ADD CONSTRAINT member_legislation_coverage_check CHECK (
        (status = 'running' AND finished_at IS NULL AND error_message IS NULL)
        OR
        (status = 'loaded' AND finished_at IS NOT NULL AND error_message IS NULL
         AND advertised_count IS NOT NULL
         AND rows_seen = advertised_count
         AND rows_written = rows_seen)
        OR
        (status = 'failed' AND finished_at IS NOT NULL
         AND error_message IS NOT NULL AND length(error_message) > 0)
    );
