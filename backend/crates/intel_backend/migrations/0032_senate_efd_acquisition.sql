-- Immutable Senate eFD search pages and report acquisition metadata.

CREATE TABLE IF NOT EXISTS senate_efd_search_pages (
    id                   BIGSERIAL PRIMARY KEY,
    submitted_start_date TEXT NOT NULL,
    submitted_end_date   TEXT NOT NULL,
    page_start           INTEGER NOT NULL,
    page_length          INTEGER NOT NULL,
    raw_payload          JSONB NOT NULL,
    raw_sha256           TEXT NOT NULL,
    source_run_id        UUID REFERENCES source_runs(id),
    fetched_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (submitted_start_date, submitted_end_date, page_start, raw_sha256)
);

ALTER TABLE senate_disclosure_reports
    ADD COLUMN IF NOT EXISTS content_sha256 TEXT,
    ADD COLUMN IF NOT EXISTS content_type TEXT,
    ADD COLUMN IF NOT EXISTS raw_storage_key TEXT,
    ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS parse_error TEXT,
    ADD COLUMN IF NOT EXISTS document_id BIGINT REFERENCES disclosure_documents(document_id),
    ADD COLUMN IF NOT EXISTS document_version_id BIGINT REFERENCES document_versions(id);
