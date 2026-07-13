-- Staged Senate eFD report discovery. The original report URL and response
-- payload stay immutable enough to support later parser upgrades and audits.
CREATE TABLE IF NOT EXISTS senate_disclosure_reports (
    id                  BIGSERIAL PRIMARY KEY,
    source_report_id    TEXT NOT NULL UNIQUE,
    filer_name          TEXT NOT NULL,
    report_type         TEXT NOT NULL,
    report_url          TEXT NOT NULL,
    submitted_date      DATE,
    bioguide_id         TEXT REFERENCES members(bioguide_id),
    raw_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_sha256          TEXT,
    status              TEXT NOT NULL DEFAULT 'discovered'
                        CHECK (status IN ('discovered', 'downloaded', 'parsed', 'partial', 'failed', 'review')),
    parser_version      TEXT,
    discovered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_senate_disclosure_reports_filer
    ON senate_disclosure_reports (filer_name, submitted_date DESC);
CREATE INDEX IF NOT EXISTS idx_senate_disclosure_reports_status
    ON senate_disclosure_reports (status, submitted_date DESC);
