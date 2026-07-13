-- Indexed case-insensitive receipt search for the public browse endpoint.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_fec_canonical_indiv_contributor_trgm
    ON fec_canonical_individual_receipts
    USING GIN (contributor_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_fec_committees_name_trgm
    ON fec_committees
    USING GIN (name gin_trgm_ops);
