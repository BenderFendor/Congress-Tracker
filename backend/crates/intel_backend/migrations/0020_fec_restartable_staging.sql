-- Durable checkpoints let a canonicalization or ranking failure resume from
-- already parsed bulk data without downloading or staging millions of rows a
-- second time.

CREATE TABLE IF NOT EXISTS fec_bulk_batches (
    id                       UUID PRIMARY KEY,
    election_cycle           INTEGER NOT NULL,
    individual_sha256        TEXT NOT NULL,
    committee_sha256         TEXT NOT NULL,
    source_run_id            UUID REFERENCES source_runs(id),
    status                   TEXT NOT NULL
        CHECK (status IN ('staging', 'individual_staged', 'staged', 'canonicalized')),
    individual_rows_seen     BIGINT NOT NULL DEFAULT 0,
    individual_rows_written  BIGINT NOT NULL DEFAULT 0,
    individual_rows_skipped  BIGINT NOT NULL DEFAULT 0,
    committee_rows_seen      BIGINT NOT NULL DEFAULT 0,
    committee_rows_written   BIGINT NOT NULL DEFAULT 0,
    committee_rows_skipped   BIGINT NOT NULL DEFAULT 0,
    error_message            TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    staged_at                TIMESTAMPTZ,
    canonicalized_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fec_bulk_batches_restart
    ON fec_bulk_batches(
        election_cycle,
        individual_sha256,
        committee_sha256,
        status,
        created_at DESC
    );

-- Adopt complete staging batches created before checkpoint tracking existed.
WITH batch_counts AS (
    SELECT
        import_batch AS id,
        election_cycle,
        SUM(individual_rows)::BIGINT AS individual_rows,
        SUM(committee_rows)::BIGINT AS committee_rows
    FROM (
        SELECT import_batch, file_year AS election_cycle,
               COUNT(*) AS individual_rows, 0::BIGINT AS committee_rows
        FROM fec_staging_individuals
        GROUP BY import_batch, file_year
        UNION ALL
        SELECT import_batch, file_year AS election_cycle, 0::BIGINT, COUNT(*)
        FROM fec_staging_committee_txns
        GROUP BY import_batch, file_year
    ) counts
    GROUP BY import_batch, election_cycle
), archive_hashes AS (
    SELECT
        batch_counts.*,
        (
            SELECT sha256
            FROM fec_bulk_imports
            WHERE election_cycle = batch_counts.election_cycle
              AND dataset_name = 'indiv' || RIGHT(batch_counts.election_cycle::TEXT, 2)
            ORDER BY checked_at DESC
            LIMIT 1
        ) AS individual_sha256,
        (
            SELECT sha256
            FROM fec_bulk_imports
            WHERE election_cycle = batch_counts.election_cycle
              AND dataset_name = 'oth' || RIGHT(batch_counts.election_cycle::TEXT, 2)
            ORDER BY checked_at DESC
            LIMIT 1
        ) AS committee_sha256
    FROM batch_counts
)
INSERT INTO fec_bulk_batches (
    id,
    election_cycle,
    individual_sha256,
    committee_sha256,
    status,
    individual_rows_seen,
    individual_rows_written,
    committee_rows_seen,
    committee_rows_written,
    staged_at
)
SELECT
    id,
    election_cycle,
    individual_sha256,
    committee_sha256,
    'staged',
    COALESCE((
        SELECT extracted_rows
        FROM fec_bulk_imports
        WHERE election_cycle = archive_hashes.election_cycle
          AND sha256 = archive_hashes.individual_sha256
        ORDER BY checked_at DESC
        LIMIT 1
    ), individual_rows),
    individual_rows,
    COALESCE((
        SELECT extracted_rows
        FROM fec_bulk_imports
        WHERE election_cycle = archive_hashes.election_cycle
          AND sha256 = archive_hashes.committee_sha256
        ORDER BY checked_at DESC
        LIMIT 1
    ), committee_rows),
    committee_rows,
    now()
FROM archive_hashes
WHERE individual_rows > 0
  AND committee_rows > 0
  AND individual_sha256 IS NOT NULL
  AND committee_sha256 IS NOT NULL
ON CONFLICT (id) DO NOTHING;
