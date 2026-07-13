-- Migration 0017: make FEC bulk imports restartable, attributable, and honest.

ALTER TABLE fec_bulk_imports
    ADD COLUMN IF NOT EXISTS source_modified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS etag TEXT,
    ADD COLUMN IF NOT EXISTS archive_path TEXT,
    ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS canonicalized_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS source_run_id UUID REFERENCES source_runs(id);

CREATE INDEX IF NOT EXISTS idx_fec_bulk_imports_latest
    ON fec_bulk_imports(dataset_name, downloaded_at DESC);

ALTER TABLE fec_staging_individuals
    ADD COLUMN IF NOT EXISTS record_kind TEXT NOT NULL DEFAULT 'other',
    ADD COLUMN IF NOT EXISTS include_in_totals BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE fec_staging_committee_txns
    ADD COLUMN IF NOT EXISTS relationship_type TEXT NOT NULL DEFAULT 'other',
    ADD COLUMN IF NOT EXISTS include_in_totals BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE fec_canonical_individual_receipts
    ADD COLUMN IF NOT EXISTS contributor_occupation TEXT,
    ADD COLUMN IF NOT EXISTS transaction_type TEXT,
    ADD COLUMN IF NOT EXISTS entity_type TEXT,
    ADD COLUMN IF NOT EXISTS image_num TEXT,
    ADD COLUMN IF NOT EXISTS tran_id TEXT,
    ADD COLUMN IF NOT EXISTS memo_code TEXT,
    ADD COLUMN IF NOT EXISTS memo_text TEXT,
    ADD COLUMN IF NOT EXISTS record_kind TEXT NOT NULL DEFAULT 'contribution',
    ADD COLUMN IF NOT EXISTS include_in_totals BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS source_run_id UUID REFERENCES source_runs(id);

CREATE INDEX IF NOT EXISTS idx_fec_canonical_indiv_browse
    ON fec_canonical_individual_receipts(
        election_cycle,
        committee_id,
        transaction_date DESC,
        sub_id DESC
    );

ALTER TABLE fec_canonical_committee_receipts
    ADD COLUMN IF NOT EXISTS transaction_type TEXT,
    ADD COLUMN IF NOT EXISTS entity_type TEXT,
    ADD COLUMN IF NOT EXISTS image_num TEXT,
    ADD COLUMN IF NOT EXISTS tran_id TEXT,
    ADD COLUMN IF NOT EXISTS memo_code TEXT,
    ADD COLUMN IF NOT EXISTS memo_text TEXT,
    ADD COLUMN IF NOT EXISTS relationship_type TEXT NOT NULL DEFAULT 'other',
    ADD COLUMN IF NOT EXISTS include_in_totals BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS source_run_id UUID REFERENCES source_runs(id);

CREATE INDEX IF NOT EXISTS idx_fec_canonical_comm_browse
    ON fec_canonical_committee_receipts(
        election_cycle,
        recipient_committee_id,
        transaction_date DESC,
        sub_id DESC
    );
