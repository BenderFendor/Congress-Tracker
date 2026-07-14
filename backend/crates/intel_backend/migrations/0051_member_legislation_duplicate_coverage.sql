-- Reconcile official duplicate rows without multiplying canonical Member evidence.

ALTER TABLE member_legislation_coverage
    ADD COLUMN duplicate_rows BIGINT NOT NULL DEFAULT 0 CHECK (duplicate_rows >= 0);

ALTER TABLE member_legislation_coverage
    DROP CONSTRAINT member_legislation_coverage_check;

ALTER TABLE member_legislation_coverage
    ADD CONSTRAINT member_legislation_coverage_check CHECK (
        (status = 'running' AND finished_at IS NULL AND error_message IS NULL)
        OR
        (status = 'loaded' AND finished_at IS NOT NULL AND error_message IS NULL
         AND advertised_count IS NOT NULL
         AND rows_seen = advertised_count
         AND rows_seen = rows_written + duplicate_rows)
        OR
        (status = 'failed' AND finished_at IS NOT NULL
         AND error_message IS NOT NULL AND length(error_message) > 0)
    );
