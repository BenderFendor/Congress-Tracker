-- Canonical Schedule B operating disbursements remain separate from receipts.

CREATE TABLE IF NOT EXISTS fec_operating_disbursement_rows (
    election_cycle       INTEGER NOT NULL,
    committee_id         TEXT NOT NULL,
    amendment_indicator  TEXT,
    report_year          INTEGER,
    report_type          TEXT,
    image_number         TEXT,
    line_number          TEXT,
    form_type            TEXT,
    schedule_type        TEXT,
    recipient_name       TEXT NOT NULL,
    city                 TEXT,
    state                TEXT,
    zip_code             TEXT,
    transaction_date     DATE,
    amount               NUMERIC NOT NULL,
    primary_general      TEXT,
    purpose              TEXT,
    category_code        TEXT,
    category_description TEXT,
    memo_code            TEXT,
    memo_text            TEXT,
    entity_type          TEXT,
    sub_id               BIGINT NOT NULL,
    file_number          BIGINT,
    transaction_id       TEXT,
    back_reference_id    TEXT,
    raw_row              TEXT NOT NULL,
    source_sha256        TEXT NOT NULL,
    source_run_id        UUID REFERENCES source_runs(id),
    ingested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (election_cycle, sub_id)
);

CREATE TABLE IF NOT EXISTS fec_canonical_operating_disbursements (
    election_cycle       INTEGER NOT NULL,
    committee_id         TEXT NOT NULL,
    source_record_id     TEXT NOT NULL,
    amendment_indicator  TEXT,
    report_year          INTEGER,
    report_type          TEXT,
    image_number         TEXT,
    line_number          TEXT,
    form_type            TEXT,
    schedule_type        TEXT,
    recipient_name       TEXT NOT NULL,
    city                 TEXT,
    state                TEXT,
    zip_code             TEXT,
    transaction_date     DATE,
    amount               NUMERIC NOT NULL,
    primary_general      TEXT,
    purpose              TEXT,
    category_code        TEXT,
    category_description TEXT,
    memo_code            TEXT,
    memo_text            TEXT,
    entity_type          TEXT,
    sub_id               BIGINT NOT NULL,
    file_number          BIGINT,
    transaction_id       TEXT,
    back_reference_id    TEXT,
    source_url           TEXT NOT NULL,
    source_sha256        TEXT NOT NULL,
    source_run_id        UUID REFERENCES source_runs(id),
    canonicalized_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (election_cycle, committee_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_fec_disbursements_cycle_date
    ON fec_canonical_operating_disbursements
       (election_cycle, transaction_date DESC, sub_id DESC);
CREATE INDEX IF NOT EXISTS idx_fec_disbursements_committee_cycle
    ON fec_canonical_operating_disbursements
       (committee_id, election_cycle, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fec_disbursements_recipient_search
    ON fec_canonical_operating_disbursements
    USING GIN (to_tsvector('simple', recipient_name || ' ' || COALESCE(purpose, '')));

CREATE TABLE IF NOT EXISTS fec_disbursement_cycle_counts (
    election_cycle INTEGER PRIMARY KEY,
    item_count      BIGINT NOT NULL,
    refreshed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
