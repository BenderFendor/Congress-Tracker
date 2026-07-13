-- Range-safe congressional financial-disclosure warehouse. These tables
-- preserve official bounds and never invent a ceiling for unbounded values.

ALTER TABLE disclosure_filings
    ADD COLUMN IF NOT EXISTS document_version_id BIGINT REFERENCES document_versions(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_disclosure_filings_version
    ON disclosure_filings(document_version_id)
    WHERE document_version_id IS NOT NULL;

ALTER TABLE disclosure_assets
    ADD COLUMN IF NOT EXISTS asset_type TEXT,
    ADD COLUMN IF NOT EXISTS value_is_unbounded BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT 'unresolved',
    ADD COLUMN IF NOT EXISTS raw_row JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE disclosure_liabilities
    ADD COLUMN IF NOT EXISTS date_incurred TEXT,
    ADD COLUMN IF NOT EXISTS amount_is_unbounded BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS raw_row JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS financial_assets (
    id                   BIGSERIAL PRIMARY KEY,
    canonical_name       TEXT NOT NULL,
    asset_type           TEXT NOT NULL,
    ticker               TEXT,
    exchange             TEXT,
    cik                  TEXT,
    figi                 TEXT,
    cusip                TEXT,
    is_publicly_traded   BOOLEAN NOT NULL DEFAULT false,
    resolution_status    TEXT NOT NULL
        CHECK (resolution_status IN ('resolved', 'ambiguous', 'unresolved')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (canonical_name, asset_type)
);

CREATE TABLE IF NOT EXISTS financial_asset_aliases (
    asset_id      BIGINT NOT NULL REFERENCES financial_assets(id) ON DELETE CASCADE,
    alias         TEXT NOT NULL,
    source        TEXT NOT NULL,
    valid_from    DATE,
    valid_to      DATE,
    PRIMARY KEY (asset_id, alias, source)
);

CREATE TABLE IF NOT EXISTS financial_asset_identifiers (
    asset_id      BIGINT NOT NULL REFERENCES financial_assets(id) ON DELETE CASCADE,
    scheme        TEXT NOT NULL,
    value         TEXT NOT NULL,
    source        TEXT NOT NULL,
    PRIMARY KEY (asset_id, scheme, value),
    UNIQUE (scheme, value)
);

CREATE TABLE IF NOT EXISTS corporate_actions (
    id                    BIGSERIAL PRIMARY KEY,
    asset_id              BIGINT REFERENCES financial_assets(id),
    action_type           TEXT NOT NULL,
    effective_date        DATE NOT NULL,
    old_identifier        TEXT,
    new_identifier        TEXT,
    ratio                 NUMERIC,
    source_url            TEXT NOT NULL,
    raw_json              JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (asset_id, action_type, effective_date, old_identifier, new_identifier)
);

CREATE TABLE IF NOT EXISTS financial_snapshots (
    id                              BIGSERIAL PRIMARY KEY,
    bioguide_id                     TEXT NOT NULL REFERENCES members(bioguide_id),
    document_id                     BIGINT NOT NULL REFERENCES disclosure_documents(document_id),
    document_version_id             BIGINT NOT NULL REFERENCES document_versions(id),
    reporting_year                  INTEGER NOT NULL,
    asset_min                       NUMERIC NOT NULL,
    asset_max                       NUMERIC,
    liability_min                   NUMERIC NOT NULL,
    liability_max                   NUMERIC,
    net_worth_min                   NUMERIC,
    net_worth_max                   NUMERIC,
    upper_bound_unavailable         BOOLEAN NOT NULL,
    lower_bound_unavailable         BOOLEAN NOT NULL DEFAULT false,
    personal_residence_unavailable  BOOLEAN NOT NULL DEFAULT true,
    calculation_version             TEXT NOT NULL,
    methodology_warnings            JSONB NOT NULL DEFAULT '[]'::jsonb,
    calculated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_version_id, calculation_version)
);

CREATE INDEX IF NOT EXISTS idx_financial_snapshots_member_year
    ON financial_snapshots(bioguide_id, reporting_year DESC);

CREATE TABLE IF NOT EXISTS snapshot_components (
    id                 BIGSERIAL PRIMARY KEY,
    snapshot_id        BIGINT NOT NULL REFERENCES financial_snapshots(id) ON DELETE CASCADE,
    record_family      TEXT NOT NULL CHECK (record_family IN ('asset', 'liability')),
    source_record_id   BIGINT NOT NULL,
    component_type     TEXT NOT NULL,
    minimum_value      NUMERIC NOT NULL,
    maximum_value      NUMERIC,
    value_is_unbounded BOOLEAN NOT NULL DEFAULT false,
    included           BOOLEAN NOT NULL DEFAULT true,
    exclusion_reason   TEXT,
    UNIQUE (snapshot_id, record_family, source_record_id)
);

CREATE TABLE IF NOT EXISTS reconciliation_issues (
    id                 BIGSERIAL PRIMARY KEY,
    bioguide_id        TEXT NOT NULL REFERENCES members(bioguide_id),
    financial_asset_id BIGINT REFERENCES financial_assets(id),
    from_year          INTEGER NOT NULL,
    to_year            INTEGER NOT NULL,
    issue_type         TEXT NOT NULL,
    expected_state     JSONB NOT NULL,
    reported_state     JSONB NOT NULL,
    explanation        TEXT,
    status             TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'explained', 'resolved', 'wont_fix')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manual_reviews (
    id                   BIGSERIAL PRIMARY KEY,
    review_type          TEXT NOT NULL,
    source_table         TEXT NOT NULL,
    source_record_id     TEXT NOT NULL,
    reason               TEXT NOT NULL,
    parser_confidence    NUMERIC,
    status               TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'resolved')),
    resolution           JSONB,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at          TIMESTAMPTZ,
    UNIQUE (review_type, source_table, source_record_id)
);
